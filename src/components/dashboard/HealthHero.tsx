"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Gauge as GaugeIcon, Info } from "lucide-react";
import type { DashboardModel, ScoreComponent } from "@/lib/types";
import { delta, formatCents, formatPct, formatRoas } from "@/lib/format";
import { Gauge } from "@/components/charts/charts";
import { ExpandableCard } from "@/components/ui/Expandable";
import { Delta, Integer, Label, Money, Percent, STATUS_TONE, Stat, StatusBadge } from "@/components/ui/primitives";
import { Lottie } from "@/components/lottie/Lottie";

const PULSE = { "on-target": "pulse-good", watch: "pulse-watch", underperforming: "pulse-bad" } as const;
const ICON = { "on-target": "status-check", watch: "status-warn", underperforming: "status-fail" } as const;

function fmtComponent(c: ScoreComponent, v: number | null) {
  if (v === null) return "—";
  return c.metric === "revenue" || c.metric === "cpa" || c.metric === "cpl" ? formatCents(v) : c.metric === "roas" ? formatRoas(v) : formatPct(v);
}

export function HealthHero({ model }: { model: DashboardModel }) {
  const reduced = useReducedMotion();
  const { accountScore: score, account, accountPrevious: prev, period, goal } = model;
  const tone = STATUS_TONE[score.status];
  const revenueComp = score.components.find((c) => c.metric === "revenue");
  const romiComp = score.components.find((c) => c.metric === "romi");
  const goalPct = revenueComp && revenueComp.target > 0 ? Math.min(1, (revenueComp.actual ?? 0) / revenueComp.target) : 0;

  const summary = (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr] lg:gap-10">
      {/* Gauge */}
      <div className="relative mx-auto grid place-items-center lg:mx-0">
        <span className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 224, height: 224 }} aria-hidden>
          <Lottie name={PULSE[score.status]} size={224} />
        </span>
        <Gauge value={score.value} color={tone.var} size={224}>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <span className={`num text-6xl font-semibold tracking-tighter ${tone.text}`}>
                <Integer value={score.value} />
              </span>
            </div>
            <div className="mt-1 text-[11px] font-medium tracking-wide text-ink-3 uppercase">Health score</div>
            <div className="mt-2 flex justify-center">
              <Lottie key={score.status} name={ICON[score.status]} size={30} loop={false} label={tone.label} />
            </div>
          </div>
        </Gauge>
      </div>

      {/* Narrative + progress */}
      <div className="flex min-w-0 flex-col justify-center gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={score.status} />
            <span className="text-xs text-ink-3">
              {period.label}
              {period.isPartial ? ` · ${formatPct(period.elapsedFraction)} of the quarter elapsed` : " · complete"}
            </span>
          </div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            {score.status === "on-target" ? "The account is on target." : score.status === "watch" ? "The account needs a closer look." : "The account is behind plan."}{" "}
            <span className="text-ink-2">
              Revenue is at <Percent value={revenueComp && revenueComp.target > 0 ? (revenueComp.actual ?? 0) / revenueComp.target : null} /> of {period.isPartial ? "the pro-rated goal" : "goal"}, {model.basis === "ltv" ? "contract " : ""}ROMI{" "}
              <Percent value={romiComp?.actual ?? null} /> against a {goal ? formatPct(goal.targetRomi) : "—"} target.
            </span>
          </h3>
        </div>

        {/* Goal progress */}
        <div>
          <div className="mb-1.5 flex items-end justify-between gap-3">
            <Label>{period.isPartial ? "Contract revenue vs. pro-rated goal" : "Contract revenue vs. goal"}</Label>
            <span className="num text-sm text-ink-2">
              <Money cents={account.contractRevenueCents} compact /> <span className="text-ink-3">/ {revenueComp ? formatCents(revenueComp.target, { compact: true }) : "—"}</span>
              {goal && period.isPartial && <span className="text-ink-3"> · full-quarter goal {formatCents(goal.revenueGoalCents, { compact: true })}</span>}
            </span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, color-mix(in oklab, ${tone.var} 60%, transparent), ${tone.var})` }}
              initial={{ width: 0 }}
              animate={{ width: `${goalPct * 100}%` }}
              transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 70, damping: 18 }}
            />
            <motion.div
              className="absolute inset-y-0 w-24 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)]"
              initial={{ x: "-120%" }}
              animate={{ x: reduced ? "-120%" : "600%" }}
              transition={reduced ? { duration: 0 } : { duration: 2.4, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
            />
          </div>
        </div>

        {/* QoQ deltas */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniDelta label="Revenue" value={formatCents(account.revenueCents, { compact: true })} d={delta(account.revenueCents, prev.revenueCents)} />
          <MiniDelta label="Spend" value={formatCents(account.spendCents, { compact: true })} d={delta(account.spendCents, prev.spendCents)} neutral />
          <MiniDelta label="Customers" value={String(account.customers)} d={delta(account.customers, prev.customers)} />
          <MiniDelta label="ROMI" value={formatPct(account.romi)} d={delta(account.romi, prev.romi)} />
        </div>
      </div>
    </div>
  );

  const expanded = (
    <div className="grid gap-6">
      {summary}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-[11px] tracking-wide text-ink-3 uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Component</th>
                <th className="px-4 py-2.5 text-right font-medium">Actual</th>
                <th className="px-4 py-2.5 text-right font-medium">Target</th>
                <th className="px-4 py-2.5 text-right font-medium">Attainment</th>
                <th className="px-4 py-2.5 text-right font-medium">Weight</th>
              </tr>
            </thead>
            <tbody>
              {score.components.map((c) => {
                const good = c.attainment >= 1;
                return (
                  <tr key={c.metric} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-ink">{c.label}</td>
                    <td className="num px-4 py-3 text-right text-ink">{fmtComponent(c, c.actual)}</td>
                    <td className="num px-4 py-3 text-right text-ink-2">{fmtComponent(c, c.target)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
                          <motion.div className="h-full rounded-full" style={{ background: good ? "var(--good)" : c.attainment >= 0.75 ? "var(--watch)" : "var(--bad)" }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, (c.attainment / 1.5) * 100)}%` }} />
                        </div>
                        <span className={`num ${good ? "text-good" : "text-watch"}`}>{formatPct(c.attainment)}</span>
                      </div>
                    </td>
                    <td className="num px-4 py-3 text-right text-ink-2">{formatPct(c.weight)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-ink-2">
          <div className="mb-2 flex items-center gap-2 font-medium text-ink">
            <Info size={15} className="text-brand" /> How the score is built
          </div>
          <p>
            Each component compares the account to its target and is clamped between 0% and 150% attainment. The weighted average is multiplied by 75, so <span className="num text-ink">exactly on target = 75</span>, and 133% or better = 100.
          </p>
          <ul className="mt-3 space-y-1.5">
            <li>
              <span className="text-ink">Revenue (50%)</span>: contract revenue booked in the quarter vs. the CRO&apos;s goal{period.isPartial ? ", pro-rated by days elapsed" : ""}.
            </li>
            <li>
              <span className="text-ink">ROMI (30%)</span>: (contract revenue − spend) ÷ spend vs. the quarter&apos;s ROMI target.
            </li>
            <li>
              <span className="text-ink">CPA (20%)</span>: spend ÷ closed customers vs. the CPA target; lower is better.
            </li>
          </ul>
          <p className="mt-3 text-xs text-ink-3">Thresholds: on target ≥ 75 · watch ≥ 50 · underperforming below 50. Goals are set on the contract basis, so the score does not change with the revenue toggle.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`${model.previousPeriod.label} revenue`}>{formatCents(prev.revenueCents, { compact: true })}</Stat>
        <Stat label={`${model.previousPeriod.label} spend`}>{formatCents(prev.spendCents, { compact: true })}</Stat>
        <Stat label={`${model.previousPeriod.label} ROMI`}>{formatPct(prev.romi)}</Stat>
        <Stat label={`${model.previousPeriod.label} CPA`}>{formatCents(prev.cpaCents)}</Stat>
      </div>
    </div>
  );

  return (
    <ExpandableCard
      id="health"
      icon={<GaugeIcon size={16} />}
      title="Account health"
      subtitle={`Revenue vs. goal, ROMI and CPA against ${period.label} targets · expand for the components`}
      className="bg-[radial-gradient(60%_80%_at_0%_0%,color-mix(in_oklab,var(--brand)_10%,transparent),transparent_70%)]"
      expanded={expanded}
    >
      {summary}
    </ExpandableCard>
  );
}

function MiniDelta({ label, value, d, lowerIsBetter, neutral }: { label: string; value: string; d: number | null; lowerIsBetter?: boolean; neutral?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <Label>{label}</Label>
      <div className="num mt-0.5 text-base font-semibold text-ink">{value}</div>
      <Delta value={d} lowerIsBetter={lowerIsBetter} neutral={neutral} label={null} className="mt-0.5" />
    </div>
  );
}
