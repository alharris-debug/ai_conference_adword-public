"use client";

import { motion } from "framer-motion";
import { Layers } from "lucide-react";
import type { DashboardModel } from "@/lib/types";
import { delta, formatCents, formatCount, formatPct, formatRoas } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ExpandableCard } from "@/components/ui/Expandable";
import { Delta, RoleBadge, STATUS_TONE } from "@/components/ui/primitives";
import { Legend, SERIES, SpendRevenueBars } from "@/components/charts/charts";

export function ProductLines({ model }: { model: DashboardModel }) {
  const lines = [...model.productLines].sort((a, b) => b.metrics.revenueCents - a.metrics.revenueCents);
  const rows = lines.map((p) => ({ name: p.productLine, spendCents: p.metrics.spendCents, revenueCents: p.metrics.revenueCents, roas: p.metrics.roas }));
  const best = lines.reduce<(typeof lines)[number] | null>((acc, p) => (p.metrics.roas !== null && (acc === null || (acc.metrics.roas ?? -1) < p.metrics.roas) ? p : acc), null);

  const summary = (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-2">
          {best ? (
            <>
              <span className="font-medium text-ink">{best.productLine}</span> returns the most per ad dollar at <span className="num text-ink">{formatRoas(best.metrics.roas)}</span>.
            </>
          ) : (
            "No product line has revenue yet."
          )}
        </p>
        <Legend items={[{ label: "Spend", color: SERIES.spend }, { label: "Revenue", color: SERIES.revenue }]} />
      </div>
      <SpendRevenueBars rows={rows} height={220} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {lines.map((p) => (
          <div key={p.productLine} className="rounded-xl border border-border bg-surface px-3 py-2">
            <div className="truncate text-xs font-medium text-ink">{p.productLine}</div>
            <div className="num mt-0.5 text-lg font-semibold text-ink">{formatRoas(p.metrics.roas)}</div>
            <div className="flex items-center justify-between text-[11px] text-ink-3">
              <span>ROAS</span>
              <Delta value={delta(p.metrics.roas, p.previous.roas)} label={null} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const expanded = (
    <div className="grid gap-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-ink">Spend vs. revenue by product line</div>
            <Legend items={[{ label: "Spend", color: SERIES.spend }, { label: "Revenue", color: SERIES.revenue }]} />
          </div>
          <SpendRevenueBars rows={rows} height={260} layout="vertical" />
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-[11px] tracking-wide text-ink-3 uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Product line</th>
                <th className="px-3 py-2 text-right font-medium">Spend</th>
                <th className="px-3 py-2 text-right font-medium">Revenue</th>
                <th className="px-3 py-2 text-right font-medium">Leads</th>
                <th className="px-3 py-2 text-right font-medium">Cust.</th>
                <th className="px-3 py-2 text-right font-medium">CPA</th>
                <th className="px-3 py-2 text-right font-medium">ROMI</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((p) => (
                <tr key={p.productLine} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-ink">{p.productLine}</td>
                  <td className="num px-3 py-2 text-right text-ink">{formatCents(p.metrics.spendCents, { compact: true })}</td>
                  <td className="num px-3 py-2 text-right text-ink">{formatCents(p.metrics.revenueCents, { compact: true })}</td>
                  <td className="num px-3 py-2 text-right text-ink-2">{formatCount(p.metrics.leads)}</td>
                  <td className="num px-3 py-2 text-right text-ink-2">{formatCount(p.metrics.customers)}</td>
                  <td className="num px-3 py-2 text-right text-ink-2">{formatCents(p.metrics.cpaCents)}</td>
                  <td className="num px-3 py-2 text-right text-ink">{formatPct(p.metrics.romi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-campaign breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        {lines.map((p, i) => {
          const campaigns = model.campaigns.filter((c) => p.campaignIds.includes(c.campaign.id));
          const maxRev = Math.max(1, ...campaigns.map((c) => Math.max(c.metrics.revenueCents, c.metrics.spendCents)));
          return (
            <motion.div key={p.productLine} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.05 * i } }} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between">
                <div className="font-semibold text-ink">{p.productLine}</div>
                <div className="text-xs text-ink-3">
                  {campaigns.length} campaign{campaigns.length === 1 ? "" : "s"} · ROAS <span className="num text-ink">{formatRoas(p.metrics.roas)}</span> · prev <span className="num">{formatRoas(p.previous.roas)}</span>
                </div>
              </div>
              <div className="mt-3 grid gap-3">
                {campaigns.map((c) => {
                  const tone = STATUS_TONE[c.score.status];
                  return (
                    <div key={c.campaign.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={cn("num text-xs font-semibold", tone.text)}>{c.score.value}</span>
                          <span className="truncate font-medium text-ink">{c.campaign.name}</span>
                          <RoleBadge role={c.campaign.role} />
                        </span>
                        <span className="num text-xs text-ink-3">
                          ROAS {formatRoas(c.metrics.roas)} · CPA {formatCents(c.metrics.cpaCents)}
                        </span>
                      </div>
                      <div className="mt-1.5 grid gap-1">
                        <Bar label="Spend" cents={c.metrics.spendCents} max={maxRev} color={SERIES.spend} />
                        <Bar label="Revenue" cents={c.metrics.revenueCents} max={maxRev} color={SERIES.revenue} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  return (
    <ExpandableCard id="product-lines" icon={<Layers size={16} />} title="Product lines" subtitle="Which product line earns the most per ad dollar · expand for the per-campaign breakdown" expanded={expanded} sheetClassName="max-w-6xl">
      {summary}
    </ExpandableCard>
  );
}

function Bar({ label, cents, max, color }: { label: string; cents: number; max: number; color: string }) {
  return (
    <div className="grid grid-cols-[56px_1fr_72px] items-center gap-2 text-[11px]">
      <span className="text-ink-3">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <motion.div className="h-full rounded-r-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${(cents / max) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      </div>
      <span className="num text-right text-ink">{formatCents(cents, { compact: true })}</span>
    </div>
  );
}
