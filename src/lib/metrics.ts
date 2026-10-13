// Deterministic metric engine. Every number on the dashboard comes from here:
// pure functions over the source rows, integer cents, and no AI involvement.

import type {
  BudgetSuggestion,
  Campaign,
  CampaignMetrics,
  CampaignRole,
  Cents,
  DashboardModel,
  MetricSet,
  Period,
  ProductLineMetrics,
  QuarterGoal,
  RevenueBasis,
  Score,
  ScoreComponent,
  ScoreStatus,
  SfOpportunity,
  TrendPoint,
} from "./types";
import { MATURING_WINDOW_DAYS, ROLE_WEIGHTS } from "./data/config";
import { addDays, previousQuarterKey, quarterPeriod, weekStartOf } from "./dates";
import { runIntegrityChecks } from "./reconcile";
import { UNATTRIBUTED, type Index } from "./attribution";

export { UNATTRIBUTED, normalizeUtm, attributeLead, buildIndex, type Index } from "./attribution";

const inRange = (date: string | null, p: { start: string; end: string }) =>
  date !== null && date >= p.start && date <= p.end;

export function revenueOf(opp: SfOpportunity, basis: RevenueBasis): Cents {
  return basis === "contract" ? opp.AmountCents : opp.LifetimeValueCents;
}

export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/**
 * Metrics for the given campaigns over a period.
 * - Spend, clicks, impressions and Google conversions: ad rows dated in the period.
 * - Leads and opportunities: created in the period.
 * - Customers and revenue: closed-won with CloseDate in the period (booked revenue).
 * - Pipeline: open opportunities from leads created in the period.
 * Pass UNATTRIBUTED in `campaignIds` to include leads with no matching UTM.
 */
export function computeMetricSet(
  idx: Index,
  campaignIds: Set<string>,
  period: { start: string; end: string },
  basis: RevenueBasis,
): MetricSet {
  let spendCents = 0;
  let impressions = 0;
  let clicks = 0;
  let googleConversions = 0;
  for (const row of idx.ds.ads) {
    if (!campaignIds.has(row.campaignId) || !inRange(row.date, period)) continue;
    spendCents += row.costCents;
    impressions += row.impressions;
    clicks += row.clicks;
    googleConversions += row.conversions;
  }

  let leads = 0;
  for (const lead of idx.ds.leads) {
    if (inRange(lead.CreatedDate, period) && campaignIds.has(idx.leadCampaign.get(lead.Id)!)) leads++;
  }

  let opportunities = 0;
  let customers = 0;
  let contractRevenueCents = 0;
  let ltvRevenueCents = 0;
  let pipelineCents = 0;
  for (const opp of idx.ds.opportunities) {
    if (!campaignIds.has(idx.leadCampaign.get(opp.LeadId) ?? UNATTRIBUTED)) continue;
    if (inRange(opp.CreatedDate, period)) opportunities++;
    if (opp.IsWon && inRange(opp.CloseDate, period)) {
      customers++;
      contractRevenueCents += opp.AmountCents;
      ltvRevenueCents += opp.LifetimeValueCents;
    }
    if (!opp.IsClosed) {
      const lead = idx.leadById.get(opp.LeadId);
      if (lead && inRange(lead.CreatedDate, period)) pipelineCents += revenueOf(opp, basis);
    }
  }

  const revenueCents = basis === "contract" ? contractRevenueCents : ltvRevenueCents;
  return {
    spendCents,
    impressions,
    clicks,
    ctr: ratio(clicks, impressions),
    googleConversions,
    leads,
    opportunities,
    customers,
    revenueCents,
    contractRevenueCents,
    ltvRevenueCents,
    pipelineCents,
    cplCents: ratio(spendCents, leads),
    cpaCents: ratio(spendCents, customers),
    roas: ratio(revenueCents, spendCents),
    romi: spendCents > 0 ? (revenueCents - spendCents) / spendCents : null,
    leadToCustomerRate: ratio(customers, leads),
  };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const clampAttainment = (x: number) => Math.max(0, Math.min(1.5, x));

/** Attainment where lower is better (CPL, CPA). Missing actual = 0 (no leads or customers at all). */
function lowerIsBetter(actual: number | null, target: number) {
  return actual === null || actual <= 0 ? 0 : clampAttainment(target / actual);
}

function higherIsBetter(actual: number | null, target: number) {
  return actual === null || target <= 0 ? 0 : clampAttainment(actual / target);
}

export function statusFor(value: number): ScoreStatus {
  return value >= 75 ? "on-target" : value >= 50 ? "watch" : "underperforming";
}

/** 1.0 weighted attainment (exactly on target) scores 75; 1.33 or better scores 100. */
export function scoreFrom(components: ScoreComponent[]): Score {
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const weighted = components.reduce((s, c) => s + c.attainment * c.weight, 0) / (totalWeight || 1);
  const value = Math.round(Math.max(0, Math.min(100, weighted * 75)));
  return { value, status: statusFor(value), components };
}

/**
 * Campaign score against its role's targets. ROAS targets are set on the
 * contract basis, so the lifetime-value view scales the ROAS target by the
 * period's LTV ÷ contract ratio to keep the bar comparable.
 */
export function campaignScore(campaign: Campaign, m: MetricSet, basis: RevenueBasis): Score {
  const w = ROLE_WEIGHTS[campaign.role as CampaignRole];
  const ltvFactor = basis === "ltv" && m.contractRevenueCents > 0 ? m.ltvRevenueCents / m.contractRevenueCents : 1;
  const roasTarget = campaign.targets.roas * ltvFactor;
  return scoreFrom([
    { metric: "cpl", label: "Cost per lead", actual: m.cplCents, target: campaign.targets.cplCents, attainment: lowerIsBetter(m.cplCents, campaign.targets.cplCents), weight: w.cpl },
    { metric: "cpa", label: "Cost per acquisition", actual: m.cpaCents, target: campaign.targets.cpaCents, attainment: lowerIsBetter(m.cpaCents, campaign.targets.cpaCents), weight: w.cpa },
    { metric: "roas", label: "ROAS", actual: m.roas, target: roasTarget, attainment: higherIsBetter(m.roas, roasTarget), weight: w.roas },
  ]);
}

/**
 * Account health: revenue vs. the quarterly goal (pro-rated for a partial
 * quarter), ROMI vs. target, CPA vs. target. Goals are on the contract basis,
 * so revenue pacing always uses contract revenue.
 */
export function accountScore(m: MetricSet, goal: QuarterGoal | null, period: Period): Score {
  if (!goal) return scoreFrom([]);
  const proratedGoal = Math.round(goal.revenueGoalCents * period.elapsedFraction);
  const contractRomi = m.spendCents > 0 ? (m.contractRevenueCents - m.spendCents) / m.spendCents : null;
  return scoreFrom([
    { metric: "revenue", label: period.isPartial ? "Revenue vs. pro-rated goal" : "Revenue vs. goal", actual: m.contractRevenueCents, target: proratedGoal, attainment: higherIsBetter(m.contractRevenueCents, proratedGoal), weight: 0.5 },
    { metric: "romi", label: "ROMI vs. target", actual: contractRomi, target: goal.targetRomi, attainment: higherIsBetter(contractRomi, goal.targetRomi), weight: 0.3 },
    { metric: "cpa", label: "CPA vs. target", actual: m.cpaCents, target: goal.targetCpaCents, attainment: lowerIsBetter(m.cpaCents, goal.targetCpaCents), weight: 0.2 },
  ]);
}

// ---------------------------------------------------------------------------
// Budget suggestions (rule-based; the AI memo explains them, it does not invent them)
// ---------------------------------------------------------------------------

/** Brand and retargeting feed the rest of the account, so they are never cut by more than 10%. */
const PROTECTED_ROLES: CampaignRole[] = ["brand", "retargeting"];

export function suggestBudget(cm: Pick<CampaignMetrics, "campaign" | "metrics" | "previous" | "score">): BudgetSuggestion {
  const { campaign, metrics, score } = cm;
  const prevRoas = cm.previous.roas;
  const trendingDown = prevRoas !== null && metrics.roas !== null && metrics.roas < prevRoas * 0.85;
  let action: BudgetSuggestion["action"];
  let changePct: number;
  let reason: string;

  if (score.value >= 90) {
    action = "increase";
    changePct = 0.2;
    reason = "Beating its targets by a wide margin; more budget should scale revenue.";
  } else if (score.value >= 75) {
    action = trendingDown ? "hold" : "increase";
    changePct = trendingDown ? 0 : 0.1;
    reason = trendingDown ? "On target, but ROAS fell more than 15% vs. last quarter." : "On target; modest increase to capture more volume.";
  } else if (score.value >= 50) {
    action = "optimize";
    changePct = 0;
    reason = "Below target on at least one metric; hold budget and fix keywords, ads and landing pages first.";
  } else {
    action = "decrease";
    changePct = -0.3;
    reason = "Well below target; move budget to stronger campaigns.";
  }

  if (PROTECTED_ROLES.includes(campaign.role) && changePct < -0.1) {
    changePct = -0.1;
    reason += " Capped at −10% because this campaign supports the rest of the account.";
  }

  return {
    campaignId: campaign.id,
    action,
    changePct,
    changeCents: Math.round(metrics.spendCents * changePct),
    reason,
  };
}

// ---------------------------------------------------------------------------
// Trends and the full dashboard model
// ---------------------------------------------------------------------------

export function weeklyTrend(idx: Index, campaignIds: Set<string>, period: { start: string; end: string }, basis: RevenueBasis): TrendPoint[] {
  const weeks = new Map<string, TrendPoint>();
  const bucket = (date: string) => {
    const key = weekStartOf(date);
    let point = weeks.get(key);
    if (!point) {
      point = { weekStart: key, spendCents: 0, revenueCents: 0, leads: 0, customers: 0 };
      weeks.set(key, point);
    }
    return point;
  };
  for (const row of idx.ds.ads) {
    if (campaignIds.has(row.campaignId) && inRange(row.date, period)) bucket(row.date).spendCents += row.costCents;
  }
  for (const lead of idx.ds.leads) {
    if (inRange(lead.CreatedDate, period) && campaignIds.has(idx.leadCampaign.get(lead.Id)!)) bucket(lead.CreatedDate).leads++;
  }
  for (const opp of idx.ds.opportunities) {
    if (opp.IsWon && inRange(opp.CloseDate, period) && campaignIds.has(idx.leadCampaign.get(opp.LeadId) ?? UNATTRIBUTED)) {
      const point = bucket(opp.CloseDate!);
      point.customers++;
      point.revenueCents += revenueOf(opp, basis);
    }
  }
  return [...weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function buildDashboard(idx: Index, quarterKey: string, basis: RevenueBasis): DashboardModel {
  const { ds } = idx;
  const period = quarterPeriod(quarterKey, ds.asOf);
  const previousPeriod = quarterPeriod(previousQuarterKey(quarterKey), ds.asOf);
  const goal = ds.goals.find((g) => g.quarter === quarterKey) ?? null;
  const allIds = new Set(ds.campaigns.map((c) => c.id));

  const account = computeMetricSet(idx, allIds, period, basis);
  const accountPrevious = computeMetricSet(idx, allIds, previousPeriod, basis);

  const unscored = ds.campaigns.map((campaign) => {
    const ids = new Set([campaign.id]);
    const metrics = computeMetricSet(idx, ids, period, basis);
    return {
      campaign,
      metrics,
      previous: computeMetricSet(idx, ids, previousPeriod, basis),
      score: campaignScore(campaign, metrics, basis),
      trend: weeklyTrend(idx, ids, period, basis),
    };
  });
  const campaigns: CampaignMetrics[] = [...unscored]
    .sort((a, b) => b.score.value - a.score.value || (b.metrics.romi ?? -Infinity) - (a.metrics.romi ?? -Infinity))
    .map((c, i) => ({ ...c, rank: i + 1 }));

  const lines = [...new Set(ds.campaigns.map((c) => c.productLine))];
  const productLines: ProductLineMetrics[] = lines.map((productLine) => {
    const ids = new Set(ds.campaigns.filter((c) => c.productLine === productLine).map((c) => c.id));
    return {
      productLine,
      campaignIds: [...ids],
      metrics: computeMetricSet(idx, ids, period, basis),
      previous: computeMetricSet(idx, ids, previousPeriod, basis),
    };
  });

  const unattributedSet = computeMetricSet(idx, new Set([UNATTRIBUTED]), period, basis);

  const maturingStart = addDays(period.end, -(MATURING_WINDOW_DAYS - 1));
  const maturingWindow = { start: maturingStart > period.start ? maturingStart : period.start, end: period.end };
  let maturingLeads = 0;
  for (const lead of ds.leads) {
    if (inRange(lead.CreatedDate, maturingWindow) && idx.leadCampaign.get(lead.Id) !== UNATTRIBUTED) maturingLeads++;
  }
  let openPipelineCents = 0;
  for (const opp of ds.opportunities) {
    const lead = idx.leadById.get(opp.LeadId);
    if (!opp.IsClosed && lead && inRange(lead.CreatedDate, maturingWindow) && idx.leadCampaign.get(lead.Id) !== UNATTRIBUTED) {
      openPipelineCents += revenueOf(opp, basis);
    }
  }

  return {
    period,
    previousPeriod,
    basis,
    goal,
    account,
    accountPrevious,
    accountScore: accountScore(account, goal, period),
    campaigns,
    productLines,
    accountTrend: weeklyTrend(idx, allIds, period, basis),
    unattributed: {
      leads: unattributedSet.leads,
      customers: unattributedSet.customers,
      revenueCents: unattributedSet.revenueCents,
    },
    maturing: { leads: maturingLeads, openPipelineCents, windowDays: MATURING_WINDOW_DAYS },
    suggestions: campaigns.map(suggestBudget),
    checks: runIntegrityChecks(idx, period, account, campaigns),
  };
}
