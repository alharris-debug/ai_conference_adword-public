// The quarterly CRO memo. Claude gets a facts sheet computed by the metric
// engine and writes the narrative. It never computes numbers: dollar impacts
// are recalculated here from the computed spend, and every recommendation is
// compared against the rule-based suggestion so overrides are visible.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { BudgetAction, DashboardModel, MetricSet } from "../types";
import { ROLE_LABELS } from "../data/config";
import { formatCents, formatPct, formatRoas } from "../format";

export const MEMO_MODEL = "claude-opus-5-5";

const ACTIONS = ["increase", "hold", "optimize", "decrease"] as const;

const MemoSchema = z.object({
  headline: z.string().describe("One sentence, at most 15 words, stating the quarter's bottom line."),
  executiveSummary: z.string().describe("3-4 sentences for the CRO. Quote the numbers from the facts exactly."),
  accountAssessment: z.string().describe("2-3 sentences on account health vs. goal, ROMI and CPA."),
  recommendations: z
    .array(
      z.object({
        campaignId: z.string(),
        action: z.enum(ACTIONS),
        changePct: z.number().describe("Budget change for next quarter as a fraction, e.g. 0.2 for +20%, -0.3 for -30%."),
        rationale: z.string().describe("1-2 sentences citing that campaign's numbers."),
      }),
    )
    .describe("Exactly one entry per campaign, best opportunity first."),
  productLineInsights: z.array(z.string()).describe("2-4 bullets comparing product lines."),
  risks: z.array(z.string()).describe("1-3 bullets: what could make these recommendations wrong."),
  dataCaveats: z.array(z.string()).describe("1-3 bullets drawn from the data checks that the CRO should know."),
  nextQuarterFocus: z.array(z.string()).describe("2-3 concrete actions for the marketing team."),
});

export type MemoDraft = z.infer<typeof MemoSchema>;

export interface MemoRecommendation {
  campaignId: string;
  campaignName: string;
  action: BudgetAction;
  changePct: number;
  changeCents: number; // computed here from the period's spend, never by the AI
  rationale: string;
  ruleAction: BudgetAction;
  ruleChangePct: number;
  overridesRule: boolean;
}

export interface Memo extends Omit<MemoDraft, "recommendations"> {
  recommendations: MemoRecommendation[];
  netBudgetChangeCents: number;
  model: string;
  generatedAt: string;
  source: "claude" | "fallback";
  warnings: string[];
}

const SYSTEM = `You are a senior performance-marketing analyst at AutoVitals, a software company that sells to auto repair shops. You write the quarterly Google Ads budget recommendation for the Chief Revenue Officer.

Rules:
- Use only the numbers in the facts sheet, quoted exactly as written. Never calculate new figures, totals or percentages yourself.
- Judge each campaign by its role: brand and retargeting support the rest of the account; awareness is judged mostly on cost per lead; direct-response and competitor campaigns are judged on revenue.
- Each campaign comes with a rule-based suggestion. Follow it unless the facts give a clear reason not to, and if you depart from it, say why in the rationale.
- Keep budget changes between -50% and +50%.
- Plain business language. No jargon the CRO would need explained.`;

function metricsLine(m: MetricSet) {
  return `spend ${formatCents(m.spendCents)}, leads ${m.leads}, customers ${m.customers}, revenue ${formatCents(m.revenueCents)}, CPL ${formatCents(m.cplCents)}, CPA ${formatCents(m.cpaCents)}, ROAS ${formatRoas(m.roas)}, ROMI ${formatPct(m.romi)}`;
}

export function buildFacts(model: DashboardModel): string {
  const basis = model.basis === "contract" ? "first-year contract value" : "customer lifetime value";
  const lines: string[] = [
    `PERIOD: ${model.period.label} (${model.period.start} to ${model.period.end})${model.period.isPartial ? `, quarter in progress (${formatPct(model.period.elapsedFraction)} elapsed)` : ""}`,
    `REVENUE BASIS: ${basis}`,
    "",
    `ACCOUNT: ${metricsLine(model.account)}`,
    `ACCOUNT PREVIOUS QUARTER (${model.previousPeriod.label}): ${metricsLine(model.accountPrevious)}`,
    `ACCOUNT HEALTH SCORE: ${model.accountScore.value}/100 (${model.accountScore.status})`,
  ];
  if (model.goal) {
    lines.push(
      `GOALS: revenue ${formatCents(model.goal.revenueGoalCents)} (contract basis), contract revenue so far ${formatCents(model.account.contractRevenueCents)}, attainment ${formatPct(model.account.contractRevenueCents / model.goal.revenueGoalCents)}; ROMI target ${formatPct(model.goal.targetRomi)}; CPA target ${formatCents(model.goal.targetCpaCents)}`,
    );
  }
  lines.push("", "CAMPAIGNS (ranked by score):");
  for (const c of model.campaigns) {
    const s = model.suggestions.find((x) => x.campaignId === c.campaign.id)!;
    lines.push(
      `- id=${c.campaign.id} | ${c.campaign.name} | product line ${c.campaign.productLine} | role ${ROLE_LABELS[c.campaign.role]} | rank ${c.rank} | score ${c.score.value}/100 (${c.score.status})`,
      `  this quarter: ${metricsLine(c.metrics)}`,
      `  previous quarter: ${metricsLine(c.previous)}`,
      `  targets: CPL ${formatCents(c.campaign.targets.cplCents)}, CPA ${formatCents(c.campaign.targets.cpaCents)}, ROAS ${formatRoas(c.campaign.targets.roas)}`,
      `  Google-reported conversions: ${c.metrics.googleConversions} vs. Salesforce leads ${c.metrics.leads}`,
      `  rule-based suggestion: ${s.action} ${formatPct(s.changePct)} (${formatCents(s.changeCents)}), reason: ${s.reason}`,
    );
  }
  lines.push("", "PRODUCT LINES:");
  for (const p of model.productLines) {
    lines.push(`- ${p.productLine}: ${metricsLine(p.metrics)} | previous: ${metricsLine(p.previous)}`);
  }
  lines.push(
    "",
    `UNATTRIBUTED GOOGLE ADS LEADS (no usable UTM): ${model.unattributed.leads} leads, ${model.unattributed.customers} customers, ${formatCents(model.unattributed.revenueCents)} revenue`,
    `MATURING: ${model.maturing.leads} leads from the last ${model.maturing.windowDays} days are still inside the sales cycle; open pipeline from them ${formatCents(model.maturing.openPipelineCents)}`,
    "",
    "DATA CHECKS:",
    ...model.checks.map((c) => `- [${c.status.toUpperCase()}] ${c.label}: ${c.summary}`),
  );
  return lines.join("\n");
}

/** Attach deterministic dollar amounts and rule comparisons to the AI's recommendations. */
export function finalizeMemo(draft: MemoDraft, model: DashboardModel, source: Memo["source"]): Memo {
  const warnings: string[] = [];
  const recs: MemoRecommendation[] = [];
  for (const c of model.campaigns) {
    const rule = model.suggestions.find((s) => s.campaignId === c.campaign.id)!;
    const ai = draft.recommendations.find((r) => r.campaignId === c.campaign.id);
    if (!ai) warnings.push(`AI gave no recommendation for ${c.campaign.name}; showing the rule-based suggestion.`);
    const changePct = Math.max(-0.5, Math.min(0.5, ai?.changePct ?? rule.changePct));
    const action = ai?.action ?? rule.action;
    recs.push({
      campaignId: c.campaign.id,
      campaignName: c.campaign.name,
      action,
      changePct,
      changeCents: Math.round(c.metrics.spendCents * changePct),
      rationale: ai?.rationale ?? rule.reason,
      ruleAction: rule.action,
      ruleChangePct: rule.changePct,
      overridesRule: action !== rule.action || Math.abs(changePct - rule.changePct) > 0.001,
    });
  }
  const unknown = draft.recommendations.filter((r) => !model.campaigns.some((c) => c.campaign.id === r.campaignId));
  if (unknown.length) warnings.push(`Ignored ${unknown.length} recommendation(s) for unknown campaign ids.`);
  const order = new Map(draft.recommendations.map((r, i) => [r.campaignId, i]));
  recs.sort((a, b) => (order.get(a.campaignId) ?? 99) - (order.get(b.campaignId) ?? 99));

  return {
    ...draft,
    recommendations: recs,
    netBudgetChangeCents: recs.reduce((s, r) => s + r.changeCents, 0),
    model: source === "claude" ? MEMO_MODEL : "rule-based fallback",
    generatedAt: new Date().toISOString(),
    source,
    warnings,
  };
}

export async function generateMemo(model: DashboardModel): Promise<Memo> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MEMO_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(MemoSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Write the ${model.period.label} Google Ads recommendation memo for the CRO from these facts.\n\n<facts>\n${buildFacts(model)}\n</facts>`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined to write the memo.");
  if (response.stop_reason === "max_tokens") throw new Error("The memo was cut off before it finished.");
  if (!response.parsed_output) throw new Error("The memo came back in an unexpected format.");
  return finalizeMemo(response.parsed_output, model, "claude");
}

/** Used when there is no API key or the call fails, so the demo still works. */
export function fallbackMemo(model: DashboardModel, reason: string): Memo {
  const top = model.campaigns[0];
  const bottom = model.campaigns[model.campaigns.length - 1];
  const draft: MemoDraft = {
    headline: `${model.period.label}: account health ${model.accountScore.value}/100, ROMI ${formatPct(model.account.romi)}.`,
    executiveSummary: `Google Ads spent ${formatCents(model.account.spendCents)} and closed ${model.account.customers} customers worth ${formatCents(model.account.revenueCents)} (ROAS ${formatRoas(model.account.roas)}). ${top.campaign.name} leads the account; ${bottom.campaign.name} trails it.`,
    accountAssessment: `CPL ${formatCents(model.account.cplCents)}, CPA ${formatCents(model.account.cpaCents)}, ROMI ${formatPct(model.account.romi)}.`,
    recommendations: model.suggestions.map((s) => ({ campaignId: s.campaignId, action: s.action, changePct: s.changePct, rationale: s.reason })),
    productLineInsights: [],
    risks: [],
    dataCaveats: model.checks.filter((c) => c.status !== "pass").map((c) => c.summary),
    nextQuarterFocus: [],
  };
  const memo = finalizeMemo(draft, model, "fallback");
  memo.warnings.unshift(`AI memo unavailable (${reason}). Showing rule-based recommendations only.`);
  return memo;
}
