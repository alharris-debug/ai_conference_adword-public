"use client";

import { BadgeDollarSign, Coins, Percent as PercentIcon, Target, TrendingUp, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { DashboardModel, MetricSet, TrendPoint } from "@/lib/types";
import { delta, formatCents, formatCount, formatPct, formatRoas } from "@/lib/format";
import { ExpandableCard } from "@/components/ui/Expandable";
import { Delta, Money, Percent, Ratio, Stat } from "@/components/ui/primitives";
import { LeadsCustomersChart, Legend, SERIES, SpendRevenueChart, Sparkline } from "@/components/charts/charts";
import { Lottie } from "@/components/lottie/Lottie";

interface Kpi {
  id: string;
  label: string;
  icon: ReactNode;
  value: (m: MetricSet) => number | null;
  render: (v: number | null) => ReactNode;
  text: (v: number | null) => string;
  lowerIsBetter: boolean;
  neutral?: boolean;
  formula: string;
  definition: string;
  spark: (t: TrendPoint[]) => number[];
  sparkColor: string;
  chart: "money" | "counts";
}

const KPIS: Kpi[] = [
  {
    id: "spend",
    label: "Spend",
    icon: <Coins size={16} />,
    value: (m) => m.spendCents,
    render: (v) => <Money cents={v} compact />,
    text: (v) => formatCents(v),
    lowerIsBetter: true,
    neutral: true,
    formula: "Σ cost of every Google Ads export row dated in the quarter",
    definition: "Total Google Ads cost in the period, summed in integer cents from the raw campaign-by-day export. Lower spend is only 'good' if revenue holds, so the delta is colored on its own.",
    spark: (t) => t.map((p) => p.spendCents),
    sparkColor: SERIES.spend,
    chart: "money",
  },
  {
    id: "revenue",
    label: "Revenue",
    icon: <BadgeDollarSign size={16} />,
    value: (m) => m.revenueCents,
    render: (v) => <Money cents={v} compact />,
    text: (v) => formatCents(v),
    lowerIsBetter: false,
    formula: "Σ amount of closed-won opportunities with a close date in the quarter",
    definition: "Booked revenue from Google Ads leads, on the selected basis (first-year contract value or lifetime value). Open deals are shown separately as pipeline.",
    spark: (t) => t.map((p) => p.revenueCents),
    sparkColor: SERIES.revenue,
    chart: "money",
  },
  {
    id: "cpl",
    label: "CPL",
    icon: <Target size={16} />,
    value: (m) => m.cplCents,
    render: (v) => <Money cents={v} />,
    text: (v) => formatCents(v),
    lowerIsBetter: true,
    formula: "spend ÷ Salesforce leads created in the quarter",
    definition: "Cost per lead. Leads are counted in Salesforce (de-duplicated, attributed by utm_campaign), not Google's conversion count, so this is the number the sales team would recognize.",
    spark: (t) => t.map((p) => p.leads),
    sparkColor: SERIES.leads,
    chart: "counts",
  },
  {
    id: "cpa",
    label: "CPA",
    icon: <Users size={16} />,
    value: (m) => m.cpaCents,
    render: (v) => <Money cents={v} />,
    text: (v) => formatCents(v),
    lowerIsBetter: true,
    formula: "spend ÷ customers closed-won in the quarter",
    definition: "Cost per acquisition: what it cost in ads to win one customer. Because of the 30–45 day sales cycle, some of this quarter's spend will close next quarter.",
    spark: (t) => t.map((p) => p.customers),
    sparkColor: SERIES.customers,
    chart: "counts",
  },
  {
    id: "roas",
    label: "ROAS",
    icon: <TrendingUp size={16} />,
    value: (m) => m.roas,
    render: (v) => <Ratio value={v} />,
    text: (v) => formatRoas(v),
    lowerIsBetter: false,
    formula: "revenue ÷ spend",
    definition: "Return on ad spend: dollars of booked revenue per dollar of Google Ads cost. 1.00x means spend equals revenue.",
    spark: (t) => t.map((p) => p.revenueCents),
    sparkColor: SERIES.revenue,
    chart: "money",
  },
  {
    id: "romi",
    label: "ROMI",
    icon: <PercentIcon size={16} />,
    value: (m) => m.romi,
    render: (v) => <Percent value={v} />,
    text: (v) => formatPct(v),
    lowerIsBetter: false,
    formula: "(revenue − spend) ÷ spend",
    definition: "Return on marketing investment: the profit on ad spend as a percentage. 100% means every ad dollar brought back two dollars of revenue.",
    spark: (t) => t.map((p) => p.revenueCents - p.spendCents),
    sparkColor: SERIES.revenue,
    chart: "money",
  },
];

export function KpiStrip({ model }: { model: DashboardModel }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
      {KPIS.map((k) => (
        <KpiTile key={k.id} kpi={k} model={model} />
      ))}
    </div>
  );
}

function KpiTile({ kpi, model }: { kpi: Kpi; model: DashboardModel }) {
  const v = kpi.value(model.account);
  const p = kpi.value(model.accountPrevious);
  const d = delta(v, p);
  const good = d === null || kpi.neutral ? null : kpi.lowerIsBetter ? d < 0 : d > 0;
  // The animated arrow points in the direction of change, so only use it when up is also good (or down also bad).
  const showLottie = good !== null && Math.abs(d ?? 0) >= 0.005 && good === (d ?? 0) > 0;
  const prevLabel = model.previousPeriod.label;

  const expanded = (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={`${model.period.label}`} hint={model.period.isPartial ? "quarter to date" : "complete quarter"}>
          <span className="num">{kpi.text(v)}</span>
        </Stat>
        <Stat label={prevLabel} hint="previous quarter">
          <span className="num">{kpi.text(p)}</span>
        </Stat>
        <Stat label="Change" hint={`vs. ${prevLabel}`}>
          <Delta value={d} lowerIsBetter={kpi.lowerIsBetter} neutral={kpi.neutral} label={null} className="text-base" />
        </Stat>
        <Stat label="Basis">{model.basis === "contract" ? "Contract value" : "Lifetime value"}</Stat>
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="text-[11px] font-medium tracking-wide text-ink-3 uppercase">Formula</div>
        <div className="num mt-1 text-sm text-ink">{kpi.formula}</div>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{kpi.definition}</p>
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium text-ink">Weekly, {model.period.label}</div>
          <Legend items={kpi.chart === "money" ? [{ label: "Spend", color: SERIES.spend }, { label: "Revenue", color: SERIES.revenue }] : [{ label: "Leads", color: SERIES.leads }, { label: "Customers", color: SERIES.customers }]} />
        </div>
        {kpi.chart === "money" ? <SpendRevenueChart data={model.accountTrend} height={260} /> : <LeadsCustomersChart data={model.accountTrend} height={260} />}
      </div>
      {(kpi.id === "cpl" || kpi.id === "cpa") && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Leads">{formatCount(model.account.leads)}</Stat>
          <Stat label="Google conversions" hint="Google's own count, for comparison">
            {formatCount(model.account.googleConversions)}
          </Stat>
          <Stat label="Customers">{formatCount(model.account.customers)}</Stat>
          <Stat label="Lead → customer">{formatPct(model.account.leadToCustomerRate, 1)}</Stat>
        </div>
      )}
    </div>
  );

  return (
    <ExpandableCard id={`kpi-${kpi.id}`} title={kpi.label} subtitle={kpi.formula} icon={kpi.icon} expanded={expanded} bodyClassName="pt-1">
      <div className="text-2xl font-semibold tracking-tight text-ink sm:text-[26px]">{kpi.render(v)}</div>
      <div className="mt-1 flex items-center gap-1.5 whitespace-nowrap">
        {showLottie && <Lottie key={`${kpi.id}-${good}`} name={good ? "trend-up" : "trend-down"} size={20} loop={false} />}
        <Delta value={d} lowerIsBetter={kpi.lowerIsBetter} neutral={kpi.neutral} label={null} hideIcon={showLottie} />
        <span className="text-[11px] text-ink-3">vs {prevLabel}</span>
      </div>
      <div className="mt-2 -mx-1">
        <Sparkline data={kpi.spark(model.accountTrend)} color={kpi.sparkColor} height={30} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-3">
        <span>
          {prevLabel}: <span className="num">{kpi.text(p)}</span>
        </span>
        {kpi.id === "revenue" && model.account.pipelineCents > 0 && (
          <span>
            Pipeline <span className="num">{formatCents(model.account.pipelineCents, { compact: true })}</span>
          </span>
        )}
      </div>
    </ExpandableCard>
  );
}
