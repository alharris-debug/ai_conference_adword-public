"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ChevronDown, Trophy } from "lucide-react";
import { useState } from "react";
import type { BudgetSuggestion, CampaignMetrics, DashboardModel, ScoreComponent } from "@/lib/types";
import { delta, formatCents, formatCount, formatPct, formatRoas } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ExpandableCard, Collapse } from "@/components/ui/Expandable";
import { ActionChip, Delta, Money, Percent, Ratio, RoleBadge, STATUS_TONE, Stat, StatusBadge } from "@/components/ui/primitives";
import { Legend, ScoreBar, SERIES, SpendRevenueChart } from "@/components/charts/charts";
import { Lottie } from "@/components/lottie/Lottie";

const GRID = "md:grid-cols-[2rem_minmax(200px,1.6fr)_minmax(120px,1fr)_repeat(4,minmax(76px,0.7fr))_repeat(2,minmax(84px,0.8fr))_minmax(150px,1.1fr)_2rem]";

export function Leaderboard({ model }: { model: DashboardModel }) {
  const list = (wide: boolean) => <Rows model={model} wide={wide} />;
  return (
    <ExpandableCard
      id="leaderboard"
      icon={<Trophy size={16} />}
      title="Campaign leaderboard"
      subtitle={`Ranked by score against each campaign's role targets · ${model.campaigns.length} campaigns · click a row for the drill-down`}
      bodyClassName="px-2 pb-3 sm:px-3"
      expanded={<div className="-mx-2 sm:-mx-3">{list(true)}</div>}
      sheetClassName="max-w-7xl"
    >
      {list(false)}
    </ExpandableCard>
  );
}

function Rows({ model, wide }: { model: DashboardModel; wide: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <LayoutGroup id={wide ? "lb-wide" : "lb"}>
      <div className="min-w-0">
        <div className={cn("hidden items-center gap-3 px-3 pb-2 text-[11px] font-medium tracking-wide text-ink-3 uppercase md:grid", GRID)}>
          <span>#</span>
          <span>Campaign</span>
          <span>Score</span>
          <span className="text-right">CPL</span>
          <span className="text-right">CPA</span>
          <span className="text-right">ROAS</span>
          <span className="text-right">ROMI</span>
          <span className="text-right">Spend</span>
          <span className="text-right">Revenue</span>
          <span>Next quarter</span>
          <span />
        </div>
        <div className="flex flex-col gap-1.5">
          {model.campaigns.map((c) => (
            <CampaignRow
              key={c.campaign.id}
              c={c}
              suggestion={model.suggestions.find((s) => s.campaignId === c.campaign.id)!}
              model={model}
              open={openId === c.campaign.id}
              onToggle={() => setOpenId(openId === c.campaign.id ? null : c.campaign.id)}
            />
          ))}
        </div>
      </div>
    </LayoutGroup>
  );
}

function CampaignRow({ c, suggestion, model, open, onToggle }: { c: CampaignMetrics; suggestion: BudgetSuggestion; model: DashboardModel; open: boolean; onToggle: () => void }) {
  const tone = STATUS_TONE[c.score.status];
  const m = c.metrics;
  return (
    <motion.div layout="position" transition={{ type: "spring", stiffness: 320, damping: 32 }} className={cn("rounded-xl border transition-colors", open ? "border-border-strong bg-surface-2" : "border-transparent hover:bg-surface")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn("ring-focus grid w-full grid-cols-[2rem_1fr_auto] items-center gap-x-3 gap-y-2 rounded-xl px-3 py-2.5 text-left md:gap-3", GRID)}
      >
        {/* rank */}
        <span className="num grid h-7 w-7 place-items-center rounded-lg bg-surface-2 text-xs font-semibold text-ink-2">{c.rank}</span>
        {/* name */}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{c.campaign.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <RoleBadge role={c.campaign.role} />
            <span className="text-[11px] text-ink-3">
              {c.campaign.productLine} · {c.campaign.channel}
            </span>
          </span>
        </span>
        {/* score (desktop) */}
        <span className="hidden min-w-0 items-center gap-2 md:flex">
          <ScoreBar value={c.score.value} color={tone.var} className="flex-1" />
          <span className={cn("num w-7 text-right text-sm font-semibold", tone.text)}>{c.score.value}</span>
        </span>
        <Cell className="hidden md:block">
          <Money cents={m.cplCents} />
        </Cell>
        <Cell className="hidden md:block">
          <Money cents={m.cpaCents} />
        </Cell>
        <Cell className="hidden md:block">
          <Ratio value={m.roas} />
        </Cell>
        <Cell className="hidden md:block">
          <Percent value={m.romi} />
        </Cell>
        <Cell className="hidden md:block">
          <Money cents={m.spendCents} compact />
        </Cell>
        <Cell className="hidden md:block">
          <Money cents={m.revenueCents} compact />
        </Cell>
        <span className="hidden md:block">
          <ActionChip action={suggestion.action} changePct={suggestion.changePct} changeCents={suggestion.changeCents} />
        </span>
        {/* chevron */}
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="grid h-7 w-7 place-items-center justify-self-end text-ink-3">
          <ChevronDown size={16} />
        </motion.span>

        {/* mobile summary */}
        <span className="col-span-3 grid grid-cols-2 gap-2 md:hidden">
          <span className="col-span-2 flex items-center gap-2">
            <ScoreBar value={c.score.value} color={tone.var} className="flex-1" />
            <span className={cn("num text-sm font-semibold", tone.text)}>{c.score.value}</span>
          </span>
          <MobileStat label="CPL" value={formatCents(m.cplCents)} />
          <MobileStat label="CPA" value={formatCents(m.cpaCents)} />
          <MobileStat label="ROAS" value={formatRoas(m.roas)} />
          <MobileStat label="ROMI" value={formatPct(m.romi)} />
          <span className="col-span-2">
            <ActionChip action={suggestion.action} changePct={suggestion.changePct} changeCents={suggestion.changeCents} />
          </span>
        </span>
      </button>
      <Collapse open={open}>
        <AnimatePresence>{open && <RowDetail c={c} suggestion={suggestion} model={model} />}</AnimatePresence>
      </Collapse>
    </motion.div>
  );
}

const Cell = ({ children, className }: { children: React.ReactNode; className?: string }) => <span className={cn("num text-right text-sm text-ink", className)}>{children}</span>;
const MobileStat = ({ label, value }: { label: string; value: string }) => (
  <span className="flex items-baseline justify-between rounded-lg bg-surface px-2 py-1 text-xs">
    <span className="text-ink-3">{label}</span>
    <span className="num font-medium text-ink">{value}</span>
  </span>
);

function fmtComp(c: ScoreComponent, v: number | null) {
  return v === null ? "—" : c.metric === "roas" ? formatRoas(v) : formatCents(v);
}

function RowDetail({ c, suggestion, model }: { c: CampaignMetrics; suggestion: BudgetSuggestion; model: DashboardModel }) {
  const m = c.metrics;
  const p = c.previous;
  const tone = STATUS_TONE[c.score.status];
  const convGap = m.leads > 0 ? (m.googleConversions - m.leads) / m.leads : null;
  const rows: { label: string; now: string; prev: string; d: number | null; lower?: boolean; neutral?: boolean }[] = [
    { label: "Spend", now: formatCents(m.spendCents), prev: formatCents(p.spendCents), d: delta(m.spendCents, p.spendCents), neutral: true },
    { label: "Leads", now: formatCount(m.leads), prev: formatCount(p.leads), d: delta(m.leads, p.leads) },
    { label: "Customers", now: formatCount(m.customers), prev: formatCount(p.customers), d: delta(m.customers, p.customers) },
    { label: "Revenue", now: formatCents(m.revenueCents), prev: formatCents(p.revenueCents), d: delta(m.revenueCents, p.revenueCents) },
    { label: "CPL", now: formatCents(m.cplCents), prev: formatCents(p.cplCents), d: delta(m.cplCents, p.cplCents), lower: true },
    { label: "CPA", now: formatCents(m.cpaCents), prev: formatCents(p.cpaCents), d: delta(m.cpaCents, p.cpaCents), lower: true },
    { label: "ROAS", now: formatRoas(m.roas), prev: formatRoas(p.roas), d: delta(m.roas, p.roas) },
    { label: "ROMI", now: formatPct(m.romi), prev: formatPct(p.romi), d: delta(m.romi, p.romi) },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.1 } }} exit={{ opacity: 0 }} className="grid gap-4 border-t border-border px-3 pt-4 pb-4 lg:grid-cols-[1.3fr_1fr]">
      {/* Chart */}
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium text-ink">Weekly spend vs. revenue · {model.period.label}</div>
          <Legend items={[{ label: "Spend", color: SERIES.spend }, { label: "Revenue (close date)", color: SERIES.revenue }]} />
        </div>
        <SpendRevenueChart data={c.trend} height={200} compact />
        <div className="mt-3 rounded-xl border border-border bg-surface p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={c.score.status} />
            <span className="font-medium text-ink">Rule-based suggestion:</span>
            <ActionChip action={suggestion.action} changePct={suggestion.changePct} changeCents={suggestion.changeCents} />
          </div>
          <p className="mt-2 text-ink-2">{suggestion.reason}</p>
        </div>
      </div>

      {/* Targets + comparison */}
      <div className="grid min-w-0 gap-3">
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex items-center justify-between bg-surface px-3 py-2 text-[11px] font-medium tracking-wide text-ink-3 uppercase">
            <span>Vs. {c.campaign.role} targets</span>
            <span>
              Score <span className={cn("num", tone.text)}>{c.score.value}</span>
            </span>
          </div>
          {c.score.components.map((comp) => {
            const good = comp.attainment >= 1;
            return (
              <div key={comp.metric} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-t border-border px-3 py-2 text-sm">
                <span className="text-ink">{comp.label}</span>
                <span className="num text-right text-ink">
                  {fmtComp(comp, comp.actual)} <span className="text-ink-3">/ {fmtComp(comp, comp.target)}</span>
                </span>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <motion.div className="h-full rounded-full" style={{ background: good ? "var(--good)" : comp.attainment >= 0.75 ? "var(--watch)" : "var(--bad)" }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (comp.attainment / 1.5) * 100)}%` }} />
                </div>
                <span className="num text-right text-xs text-ink-3">
                  {formatPct(comp.attainment)} · w {formatPct(comp.weight)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 bg-surface px-3 py-2 text-[11px] font-medium tracking-wide text-ink-3 uppercase">
            <span>Metric</span>
            <span className="text-right">{model.period.label}</span>
            <span className="text-right">{model.previousPeriod.label}</span>
            <span className="text-right">Δ</span>
          </div>
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 border-t border-border px-3 py-1.5 text-sm">
              <span className="text-ink-2">{r.label}</span>
              <span className="num text-right text-ink">{r.now}</span>
              <span className="num text-right text-ink-3">{r.prev}</span>
              <span className="text-right">
                <Delta value={r.d} lowerIsBetter={r.lower} neutral={r.neutral} label={null} />
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Google conversions" hint="Google Ads form fills">
            <span className="num">{formatCount(m.googleConversions)}</span>
          </Stat>
          <Stat
            label="Salesforce leads"
            hint={
              convGap === null ? "no leads" : (
                <span className={cn("inline-flex items-center gap-1", Math.abs(convGap) > 0.2 ? "text-watch" : "text-ink-3")}>
                  {Math.abs(convGap) > 0.2 && <Lottie name="status-warn" size={14} loop={false} />}
                  Google reports {convGap > 0 ? "+" : ""}
                  {formatPct(convGap)} vs. Salesforce
                </span>
              )
            }
          >
            <span className="num">{formatCount(m.leads)}</span>
          </Stat>
        </div>
      </div>
    </motion.div>
  );
}
