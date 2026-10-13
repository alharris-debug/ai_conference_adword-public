"use client";

// Recharts wrappers. Chart series order is fixed: spend = series-1 (blue),
// revenue = series-2 (orange). Status colors are never reused as series.

import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";
import { Area, AreaChart, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCents, formatCount, formatRoas } from "@/lib/format";
import type { TrendPoint } from "@/lib/types";
import { cn } from "@/lib/cn";

export const SERIES = {
  spend: "var(--series-1)",
  revenue: "var(--series-2)",
  leads: "var(--series-3)",
  customers: "var(--series-6)",
};

const weekLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

const compactDollars = (cents: number) => formatCents(cents, { compact: true });

interface TipRow {
  name: string;
  value: number;
  color?: string;
  kind: "money" | "count" | "roas";
}

function TipBox({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="glass-solid min-w-[180px] px-3 py-2 text-xs" style={{ borderRadius: 12 }}>
      <div className="mb-1.5 font-medium text-ink-2">{title}</div>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="inline-flex items-center gap-1.5 text-ink-3">
            {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
            {r.name}
          </span>
          <span className="num font-medium text-ink">{r.kind === "money" ? formatCents(r.value) : r.kind === "roas" ? formatRoas(r.value) : formatCount(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Recharts hands the row back as an opaque record; this narrows it to the row type we passed in. */
const rowOf = <T,>(payload: unknown): T => (payload as { payload: T }[])[0].payload;

// ---------------------------------------------------------------------------
// Sparkline: a single series, no axes.
// ---------------------------------------------------------------------------
export function Sparkline({ data, color, className, height = 36 }: { data: number[]; color: string; className?: string; height?: number }) {
  const id = `spark-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#${id})`} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weekly spend (bars) vs revenue (line), same $ axis. Optional maturing window.
// ---------------------------------------------------------------------------
export function SpendRevenueChart({
  data,
  height = 240,
  maturingFrom,
  compact = false,
}: {
  data: TrendPoint[];
  height?: number;
  /** ISO date; weeks on/after it are shaded as "still maturing". */
  maturingFrom?: string;
  compact?: boolean;
}) {
  const reduced = useReducedMotion();
  const rows = data.map((p) => ({ ...p, label: weekLabel(p.weekStart) }));
  const firstMaturing = maturingFrom ? rows.find((r) => r.weekStart >= maturingFrom || weekEnd(r.weekStart) >= maturingFrom)?.label : undefined;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: compact ? -16 : 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={compact ? "preserveStartEnd" : "preserveEnd"} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={compactDollars} width={compact ? 56 : 64} />
          {firstMaturing && (
            <ReferenceArea x1={firstMaturing} x2={rows[rows.length - 1].label} fill="var(--watch)" fillOpacity={0.08} stroke="var(--watch)" strokeOpacity={0.35} strokeDasharray="4 4" ifOverflow="extendDomain" />
          )}
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = rowOf<TrendPoint & { label: string }>(payload);
              return (
                <TipBox
                  title={`Week of ${p.label}`}
                  rows={[
                    { name: "Spend", value: p.spendCents, color: SERIES.spend, kind: "money" },
                    { name: "Revenue", value: p.revenueCents, color: SERIES.revenue, kind: "money" },
                    { name: "Leads", value: p.leads, kind: "count" },
                    { name: "Customers", value: p.customers, kind: "count" },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="spendCents" name="Spend" fill={SERIES.spend} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={!reduced} animationDuration={700} />
          <Line type="monotone" dataKey="revenueCents" name="Revenue" stroke={SERIES.revenue} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, stroke: "var(--surface-solid)", fill: SERIES.revenue }} activeDot={{ r: 5 }} isAnimationActive={!reduced} animationDuration={900} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function weekEnd(weekStart: string) {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Weekly leads vs customers (counts).
// ---------------------------------------------------------------------------
export function LeadsCustomersChart({ data, height = 200, maturingFrom }: { data: TrendPoint[]; height?: number; maturingFrom?: string }) {
  const reduced = useReducedMotion();
  const rows = data.map((p) => ({ ...p, label: weekLabel(p.weekStart) }));
  const firstMaturing = maturingFrom ? rows.find((r) => weekEnd(r.weekStart) >= maturingFrom)?.label : undefined;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
          {firstMaturing && <ReferenceArea x1={firstMaturing} x2={rows[rows.length - 1].label} fill="var(--watch)" fillOpacity={0.08} stroke="var(--watch)" strokeOpacity={0.35} strokeDasharray="4 4" />}
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = rowOf<TrendPoint & { label: string }>(payload);
              return (
                <TipBox
                  title={`Week of ${p.label}`}
                  rows={[
                    { name: "Leads", value: p.leads, color: SERIES.leads, kind: "count" },
                    { name: "Customers", value: p.customers, color: SERIES.customers, kind: "count" },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="leads" name="Leads" fill={SERIES.leads} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={!reduced} animationDuration={700} />
          <Line type="monotone" dataKey="customers" name="Customers" stroke={SERIES.customers} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, stroke: "var(--surface-solid)", fill: SERIES.customers }} isAnimationActive={!reduced} animationDuration={900} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product lines / campaigns: spend vs revenue grouped bars.
// ---------------------------------------------------------------------------
export interface BarRow {
  name: string;
  spendCents: number;
  revenueCents: number;
  roas: number | null;
}

export function SpendRevenueBars({ rows, height = 240, layout = "horizontal" }: { rows: BarRow[]; height?: number; layout?: "horizontal" | "vertical" }) {
  const reduced = useReducedMotion();
  const vertical = layout === "vertical";
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} layout={vertical ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, bottom: 0, left: vertical ? 8 : 0 }} barCategoryGap="28%" barGap={3}>
          <CartesianGrid vertical={vertical} horizontal={!vertical} />
          {vertical ? (
            <>
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={compactDollars} />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={120} tick={{ fill: "var(--text-2)", fontFamily: "var(--font-sans)", fontSize: 12 }} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--text-2)", fontFamily: "var(--font-sans)", fontSize: 12 }} interval={0} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={compactDollars} width={64} />
            </>
          )}
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = rowOf<BarRow>(payload);
              return (
                <TipBox
                  title={p.name}
                  rows={[
                    { name: "Spend", value: p.spendCents, color: SERIES.spend, kind: "money" },
                    { name: "Revenue", value: p.revenueCents, color: SERIES.revenue, kind: "money" },
                    ...(p.roas !== null ? [{ name: "ROAS", value: p.roas, kind: "roas" as const }] : []),
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="spendCents" name="Spend" fill={SERIES.spend} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={24} isAnimationActive={!reduced} animationDuration={700} />
          <Bar dataKey="revenueCents" name="Revenue" fill={SERIES.revenue} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={24} isAnimationActive={!reduced} animationDuration={700}>
            {rows.map((r) => (
              <Cell key={r.name} fill={SERIES.revenue} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Legend({ items, className }: { items: { label: string; color: string; dashed?: boolean }[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3", className)}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.dashed ? "transparent" : i.color, border: i.dashed ? `1.5px dashed ${i.color}` : undefined }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Radial gauge 0–100 (custom SVG, animated with Framer).
// ---------------------------------------------------------------------------
export function Gauge({ value, color, size = 220, stroke = 14, children }: { value: number; color: string; size?: number; stroke?: number; children?: React.ReactNode }) {
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = 0.75; // 270° sweep
  const dash = c * arc;
  const target = Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block" style={{ transform: "rotate(135deg)" }}>
        <defs>
          <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
        {/* tick marks at 50 and 75 */}
        {[0.5, 0.75].map((t) => {
          const a = t * arc * 2 * Math.PI;
          const x1 = size / 2 + (r - stroke) * Math.cos(a);
          const y1 = size / 2 + (r - stroke) * Math.sin(a);
          const x2 = size / 2 + (r + stroke * 0.9) * Math.cos(a);
          const y2 = size / 2 + (r + stroke * 0.9) * Math.sin(a);
          return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--border-strong)" strokeWidth={1.5} />;
        })}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          initial={{ strokeDashoffset: dash }}
          animate={{ strokeDashoffset: dash * (1 - target) }}
          transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 18, mass: 1.1 }}
          style={{ filter: `drop-shadow(0 0 10px color-mix(in oklab, ${color} 60%, transparent))` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/** Horizontal score bar 0–100 with target tick at 75. */
export function ScoreBar({ value, color, className, height = 6 }: { value: number; color: string; className?: string; height?: number }) {
  const reduced = useReducedMotion();
  return (
    <div className={cn("relative w-full overflow-hidden rounded-full bg-surface-2", className)} style={{ height }} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
      />
      <span className="absolute top-0 bottom-0 w-px bg-[var(--border-strong)]" style={{ left: "75%" }} aria-hidden />
    </div>
  );
}
