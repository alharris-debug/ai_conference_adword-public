"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { AlertTriangle, Check, Copy, FileText, Printer, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { Memo } from "@/lib/ai/memo";
import type { DashboardModel } from "@/lib/types";
import { formatCents, formatPct } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Overlay } from "@/components/ui/Expandable";
import { ACTION_LABEL, ActionChip, AiLabel, Button, Label } from "@/components/ui/primitives";
import { Lottie } from "@/components/lottie/Lottie";
import type { MemoState } from "./Dashboard";

const THINKING = [
  "Reading 8 campaigns and their role targets…",
  "Tying spend out to the Google Ads export…",
  "Matching Salesforce leads by utm_campaign…",
  "Comparing each campaign to its role's benchmarks…",
  "Checking the quarter against the CRO's goal…",
  "Weighing the rule-based budget suggestions…",
  "Drafting recommendations and the dollar impact…",
  "Writing the data caveats…",
  "Polishing the executive summary…",
];

export function MemoPanel({ open, onClose, state, model, onRetry }: { open: boolean; onClose: () => void; state?: MemoState; model: DashboardModel; onRetry: () => void }) {
  const basis = model.basis === "contract" ? "Contract value" : "Lifetime value";
  return (
    <Overlay
      open={open}
      onClose={onClose}
      icon={<Sparkles size={18} />}
      title={`CRO memo · ${model.period.label}`}
      subtitle={`Google Ads budget recommendation · ${basis} basis${model.period.isPartial ? " · quarter to date" : ""}`}
      className="max-w-4xl"
      printable
    >
      <AnimatePresence mode="wait">
        {!state || state.status === "loading" ? (
          <Thinking key="thinking" />
        ) : state.status === "error" ? (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid place-items-center gap-4 py-16 text-center">
            <Lottie name="status-fail" size={64} loop={false} label="Error" />
            <div className="text-lg font-semibold text-ink">The memo could not be generated</div>
            <p className="max-w-md text-sm text-ink-2">{state.message}</p>
            <Button variant="primary" onClick={onRetry}>
              <RefreshCw size={14} /> Try again
            </Button>
          </motion.div>
        ) : (
          <MemoView key="memo" memo={state.memo} model={model} onRetry={onRetry} />
        )}
      </AnimatePresence>
    </Overlay>
  );
}

function Thinking() {
  const [i, setI] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const a = setInterval(() => setI((x) => (x + 1) % THINKING.length), 3200);
    const b = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, []);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="grid place-items-center gap-6 py-10 text-center sm:py-16">
      <div className="relative">
        <span className="absolute inset-0 -z-10 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand)_35%,transparent),transparent_70%)] blur-2xl" />
        <Lottie name="ai-orb" size={160} label="Thinking" />
      </div>
      <div>
        <div className="text-lg font-semibold tracking-tight text-ink">Writing the memo from the computed numbers</div>
        <div className="relative mt-2 h-6 overflow-hidden text-sm text-ink-2">
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ y: 14, opacity: 0, filter: "blur(3px)" }} animate={{ y: 0, opacity: 1, filter: "blur(0px)" }} exit={{ y: -14, opacity: 0, filter: "blur(3px)" }} transition={{ duration: 0.35 }}>
              {THINKING[i]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="grid w-full max-w-md gap-2">
        {[0.9, 0.7, 0.8].map((w, k) => (
          <div key={k} className="shimmer h-3 rounded-full" style={{ width: `${w * 100}%`, animationDelay: `${k * 0.2}s` }} />
        ))}
      </div>
      <div className="num text-xs text-ink-3">
        {elapsed}s elapsed · usually about 30s · the AI never computes a number, it only writes
      </div>
    </motion.div>
  );
}

function MemoView({ memo, model, onRetry }: { memo: Memo; model: DashboardModel; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  const [burst, setBurst] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setBurst(false), 1400);
    return () => clearTimeout(t);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(memoToMarkdown(memo, model));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  const print = () => {
    document.body.classList.add("printing-memo");
    const done = () => document.body.classList.remove("printing-memo");
    window.addEventListener("afterprint", done, { once: true });
    window.print();
    setTimeout(done, 2000);
  };

  const generated = new Date(memo.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const net = memo.netBudgetChangeCents;
  const overrides = memo.recommendations.filter((r) => r.overridesRule).length;

  const item: Variants = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.article initial="hidden" animate="show" exit={{ opacity: 0 }} variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="grid gap-6">
      {/* Toolbar */}
      <motion.div variants={item} className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <AiLabel model={memo.model} />
          <span className="num text-xs text-ink-3">{generated}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={copy} aria-live="polite">
            {copied ? <Check size={14} className="text-good" /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy as Markdown"}
          </Button>
          <Button onClick={print}>
            <Printer size={14} /> Print
          </Button>
          <Button variant="ghost" onClick={onRetry} title="Regenerate (calls the AI again)">
            <RefreshCw size={14} />
          </Button>
        </div>
      </motion.div>

      {memo.warnings.length > 0 && (
        <motion.div variants={item} className="flex gap-3 rounded-xl border border-[color-mix(in_oklab,var(--watch)_40%,transparent)] bg-watch-soft p-3 text-sm text-ink">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-watch" />
          <ul className="grid gap-1">
            {memo.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Print-only header */}
      <div className="hidden print:block">
        <div className="text-xs text-ink-3">AutoVitals · Google Ads budget recommendation · {model.period.label} · {model.basis === "contract" ? "contract value" : "lifetime value"} basis</div>
        <div className="text-xs text-ink-3">
          AI-generated text ({memo.model}), numbers verified by the metric engine · {generated}
        </div>
      </div>

      {/* Headline */}
      <motion.header variants={item} className="relative">
        {burst && (
          <span className="no-print pointer-events-none absolute -top-8 right-0 sm:-right-6" aria-hidden>
            <Lottie name="success-burst" size={80} loop={false} />
          </span>
        )}
        <Label>Headline</Label>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{memo.headline}</h1>
      </motion.header>

      <Section title="Executive summary" variants={item}>
        <p className="text-[15px] leading-relaxed text-ink">{memo.executiveSummary}</p>
      </Section>

      <Section title="Account assessment" variants={item}>
        <p className="leading-relaxed text-ink-2">{memo.accountAssessment}</p>
      </Section>

      {/* Recommendations */}
      <Section
        title="Budget recommendations"
        variants={item}
        aside={
          <span className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
            {overrides > 0 && (
              <span className="rounded-full bg-[color-mix(in_oklab,var(--brand-2)_18%,transparent)] px-2 py-0.5 font-medium text-[var(--brand-2)]">
                {overrides} AI override{overrides > 1 ? "s" : ""} of the rule
              </span>
            )}
            <span>
              Net budget change{" "}
              <span className={cn("num font-semibold", net > 0 ? "text-good" : net < 0 ? "text-bad" : "text-ink")}>
                {net > 0 ? "+" : ""}
                {formatCents(net)}
              </span>{" "}
              / quarter
            </span>
          </span>
        }
      >
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-[11px] tracking-wide text-ink-3 uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Campaign</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 text-right font-medium">$ impact</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Rationale</th>
              </tr>
            </thead>
            <tbody>
              {memo.recommendations.map((r) => (
                <tr key={r.campaignId} className="print-break-inside border-t border-border align-top">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-ink">{r.campaignName}</div>
                    {r.overridesRule && (
                      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--brand-2)_18%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-2)]">
                        AI departed from rule · rule said {ACTION_LABEL[r.ruleAction].toLowerCase()} {r.ruleChangePct !== 0 ? `${r.ruleChangePct > 0 ? "+" : ""}${formatPct(r.ruleChangePct)}` : ""}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-ink-2 md:hidden">{r.rationale}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <ActionChip action={r.action} changePct={r.changePct} changeCents={r.changeCents} />
                  </td>
                  <td className={cn("num px-3 py-2.5 text-right font-medium", r.changeCents > 0 ? "text-good" : r.changeCents < 0 ? "text-bad" : "text-ink-3")}>
                    {r.changeCents > 0 ? "+" : ""}
                    {formatCents(r.changeCents)}
                  </td>
                  <td className="hidden px-3 py-2.5 text-ink-2 md:table-cell">{r.rationale}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface font-medium">
                <td className="px-3 py-2.5 text-ink" colSpan={2}>
                  Net change next quarter
                </td>
                <td className={cn("num px-3 py-2.5 text-right", net > 0 ? "text-good" : net < 0 ? "text-bad" : "text-ink")}>
                  {net > 0 ? "+" : ""}
                  {formatCents(net)}
                </td>
                <td className="hidden px-3 py-2.5 text-xs text-ink-3 md:table-cell">Dollar amounts = change % × this quarter&apos;s spend, computed in code.</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Product line insights" variants={item}>
          <Bullets items={memo.productLineInsights} empty="No product line insights in this memo." />
        </Section>
        <Section title="Risks" variants={item}>
          <Bullets items={memo.risks} empty="No risks listed." tone="bad" />
        </Section>
        <Section title="Data caveats" variants={item}>
          <Bullets items={memo.dataCaveats} empty="No data caveats: every check passed." tone="watch" />
        </Section>
        <Section title="Next-quarter focus" variants={item}>
          <Bullets items={memo.nextQuarterFocus} empty="No focus items in this memo." tone="brand" />
        </Section>
      </div>

      <motion.footer variants={item} className="border-t border-border pt-4 text-xs text-ink-3">
        <AiLabel model={memo.model} className="mb-2" /> Generated {generated}. Every figure in this memo was computed by the deterministic metric engine from the Google Ads export and Salesforce records; the AI only wrote the words around them.
      </motion.footer>
    </motion.article>
  );
}

function Section({ title, children, aside, variants }: { title: string; children: React.ReactNode; aside?: React.ReactNode; variants: Variants }) {
  return (
    <motion.section variants={variants} className="print-break-inside">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <FileText size={14} className="text-brand" /> {title}
        </h2>
        {aside}
      </div>
      {children}
    </motion.section>
  );
}

function Bullets({ items, empty, tone = "ink" }: { items: string[]; empty: string; tone?: "ink" | "bad" | "watch" | "brand" }) {
  const dot = { ink: "bg-ink-3", bad: "bg-bad", watch: "bg-watch", brand: "bg-brand" }[tone];
  if (!items.length) return <p className="text-sm text-ink-3">{empty}</p>;
  return (
    <ul className="grid gap-2">
      {items.map((t) => (
        <li key={t} className="flex gap-2.5 text-sm leading-relaxed text-ink-2">
          <span className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function memoToMarkdown(memo: Memo, model: DashboardModel): string {
  const lines = [
    `# ${memo.headline}`,
    "",
    `_AI-generated text (${memo.model}) · numbers verified by the metric engine · ${model.period.label} · ${model.basis === "contract" ? "contract value" : "lifetime value"} basis · ${memo.generatedAt}_`,
    "",
    ...(memo.warnings.length ? ["> " + memo.warnings.join("\n> "), ""] : []),
    "## Executive summary",
    memo.executiveSummary,
    "",
    "## Account assessment",
    memo.accountAssessment,
    "",
    "## Budget recommendations",
    "",
    "| Campaign | Action | Change | $ impact | Rationale |",
    "|---|---|---|---|---|",
    ...memo.recommendations.map(
      (r) =>
        `| ${r.campaignName} | ${ACTION_LABEL[r.action]}${r.overridesRule ? ` (AI override; rule: ${ACTION_LABEL[r.ruleAction]} ${formatPct(r.ruleChangePct)})` : ""} | ${r.changePct > 0 ? "+" : ""}${formatPct(r.changePct)} | ${r.changeCents > 0 ? "+" : ""}${formatCents(r.changeCents)} | ${r.rationale.replace(/\|/g, "/")} |`,
    ),
    "",
    `**Net budget change next quarter: ${memo.netBudgetChangeCents > 0 ? "+" : ""}${formatCents(memo.netBudgetChangeCents)}**`,
    "",
    "## Product line insights",
    ...memo.productLineInsights.map((t) => `- ${t}`),
    "",
    "## Risks",
    ...memo.risks.map((t) => `- ${t}`),
    "",
    "## Data caveats",
    ...memo.dataCaveats.map((t) => `- ${t}`),
    "",
    "## Next-quarter focus",
    ...memo.nextQuarterFocus.map((t) => `- ${t}`),
    "",
  ];
  return lines.join("\n");
}
