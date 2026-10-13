"use client";

import { Hourglass, LineChart } from "lucide-react";
import type { DashboardModel } from "@/lib/types";
import { addDays } from "@/lib/dates";
import { formatCents, formatCount } from "@/lib/format";
import { ExpandableCard } from "@/components/ui/Expandable";
import { Money, Stat } from "@/components/ui/primitives";
import { LeadsCustomersChart, Legend, SERIES, SpendRevenueChart } from "@/components/charts/charts";
import { Lottie } from "@/components/lottie/Lottie";

export function Trends({ model }: { model: DashboardModel }) {
  const { accountTrend, maturing, period } = model;
  const maturingFrom = addDays(period.end, -(maturing.windowDays - 1));
  const maturingInPeriod = maturingFrom > period.start ? maturingFrom : period.start;
  const legend = [
    { label: "Spend", color: SERIES.spend },
    { label: "Revenue (close date)", color: SERIES.revenue },
    { label: `Maturing · last ${maturing.windowDays} days`, color: "var(--watch)", dashed: true },
  ];

  const maturingNote = (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-[color-mix(in_oklab,var(--watch)_8%,transparent)] px-3 py-2.5 text-sm">
      <Lottie name="loading" size={26} />
      <span className="text-ink-2">
        <span className="font-medium text-ink">{formatCount(maturing.leads)} leads</span> from the last {maturing.windowDays} days are still inside the 30–45 day sales cycle, with{" "}
        <span className="num font-medium text-ink">
          <Money cents={maturing.openPipelineCents} compact />
        </span>{" "}
        of open pipeline. Revenue in the shaded weeks will keep rising.
      </span>
    </div>
  );

  const summary = (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-ink-2">Weekly, {period.label}</div>
        <Legend items={legend} />
      </div>
      <SpendRevenueChart data={accountTrend} height={220} maturingFrom={maturingInPeriod} compact />
      {maturingNote}
    </div>
  );

  const expanded = (
    <div className="grid gap-6">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium text-ink">Spend vs. revenue · {period.label}</div>
          <Legend items={legend} />
        </div>
        <SpendRevenueChart data={accountTrend} height={300} maturingFrom={maturingInPeriod} />
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium text-ink">Leads and customers · {period.label}</div>
          <Legend items={[{ label: "Leads (created)", color: SERIES.leads }, { label: "Customers (closed)", color: SERIES.customers }, { label: "Maturing", color: "var(--watch)", dashed: true }]} />
        </div>
        <LeadsCustomersChart data={accountTrend} height={240} maturingFrom={maturingInPeriod} />
      </div>
      {maturingNote}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Maturing leads" hint={`created since ${maturingInPeriod}`}>
          {formatCount(maturing.leads)}
        </Stat>
        <Stat label="Open pipeline from them" hint={model.basis === "contract" ? "contract value" : "lifetime value"}>
          {formatCents(maturing.openPipelineCents, { compact: true })}
        </Stat>
        <Stat label="Pipeline, whole quarter" hint="open opportunities from leads created in the period">
          {formatCents(model.account.pipelineCents, { compact: true })}
        </Stat>
        <Stat label="Weeks with data">{formatCount(accountTrend.length)}</Stat>
      </div>
      <div className="flex items-start gap-2 rounded-xl border border-border bg-surface p-4 text-sm text-ink-2">
        <Hourglass size={16} className="mt-0.5 shrink-0 text-watch" />
        <p>
          Revenue is booked on the opportunity&apos;s close date, which lands 30–45 days after the click. The last {maturing.windowDays} days of any quarter therefore understate the return on that spend. Judge those weeks on leads, and let the next quarter&apos;s report settle the revenue.
        </p>
      </div>
    </div>
  );

  return (
    <ExpandableCard id="trends" icon={<LineChart size={16} />} title="Trends" subtitle="Weekly spend vs. revenue, with the maturing window · expand for leads and customers" expanded={expanded}>
      {summary}
    </ExpandableCard>
  );
}
