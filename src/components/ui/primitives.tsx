"use client";

import NumberFlow, { type Format } from "@number-flow/react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useId, type ReactNode } from "react";
import { useMounted } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { formatCents, formatPct } from "@/lib/format";
import type { BudgetAction, CampaignRole, CheckStatus, ScoreStatus } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/data/config";

// ---------------------------------------------------------------------------
// Animated numbers. Values come from the engine; this only formats and animates.
// ---------------------------------------------------------------------------

/** Renders the zero value until hydration completes, so numbers count up on first paint. */
function useRevealed<T>(value: T, zero: T): T {
  const mounted = useMounted();
  return mounted ? value : zero;
}

const money = (compact: boolean, dollars: number): Format =>
  compact && Math.abs(dollars) >= 1000
    ? { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }
    : { style: "currency", currency: "USD", maximumFractionDigits: Math.abs(dollars) >= 1000 ? 0 : 2, minimumFractionDigits: Math.abs(dollars) >= 1000 ? 0 : 2 };

export function Money({ cents, compact = false, className }: { cents: number | null; compact?: boolean; className?: string }) {
  const shown = useRevealed(cents, 0);
  if (cents === null || !Number.isFinite(cents)) return <span className={cn("num", className)}>—</span>;
  const dollars = (shown ?? 0) / 100;
  return <NumberFlow className={cn("num", className)} value={dollars} format={money(compact, cents / 100)} />;
}

export function Ratio({ value, suffix = "x", digits = 2, className }: { value: number | null; suffix?: string; digits?: number; className?: string }) {
  const shown = useRevealed(value, 0);
  if (value === null || !Number.isFinite(value)) return <span className={cn("num", className)}>—</span>;
  return <NumberFlow className={cn("num", className)} value={shown ?? 0} format={{ minimumFractionDigits: digits, maximumFractionDigits: digits }} suffix={suffix} />;
}

export function Percent({ value, digits = 0, className }: { value: number | null; digits?: number; className?: string }) {
  const shown = useRevealed(value, 0);
  if (value === null || !Number.isFinite(value)) return <span className={cn("num", className)}>—</span>;
  return <NumberFlow className={cn("num", className)} value={shown ?? 0} format={{ style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }} />;
}

export function Count({ value, className }: { value: number | null; className?: string }) {
  const shown = useRevealed(value, 0);
  if (value === null) return <span className={cn("num", className)}>—</span>;
  return <NumberFlow className={cn("num", className)} value={shown ?? 0} />;
}

export function Integer({ value, className }: { value: number; className?: string }) {
  const shown = useRevealed(value, 0);
  return <NumberFlow className={cn("num", className)} value={shown} format={{ maximumFractionDigits: 0 }} />;
}

// ---------------------------------------------------------------------------
// Delta vs. previous period, with polarity (lower CPL/CPA is good).
// ---------------------------------------------------------------------------

export function Delta({
  value,
  lowerIsBetter = false,
  neutral = false,
  className,
  label = "vs. prev. quarter",
  hideIcon = false,
}: {
  value: number | null;
  lowerIsBetter?: boolean;
  /** Neither direction is good or bad on its own (e.g. spend). */
  neutral?: boolean;
  className?: string;
  label?: string | null;
  hideIcon?: boolean;
}) {
  if (value === null || !Number.isFinite(value)) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-ink-3", className)}>
        <Minus size={12} /> n/a
      </span>
    );
  }
  const good = lowerIsBetter ? value < 0 : value > 0;
  const flat = Math.abs(value) < 0.005;
  const tone = flat ? "text-ink-3" : neutral ? "text-ink-2" : good ? "text-good" : "text-bad";
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", tone, className)} title={label ?? undefined}>
      {!hideIcon && <Icon size={13} />}
      <span className="num">
        {value > 0 ? "+" : ""}
        {formatPct(value, 1)}
      </span>
      {label && <span className="font-normal text-ink-3">{label}</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

const ROLE_TONES: Record<CampaignRole, string> = {
  brand: "bg-[color-mix(in_oklab,var(--brand)_18%,transparent)] text-brand",
  direct: "bg-[color-mix(in_oklab,var(--brand-2)_20%,transparent)] text-[var(--brand-2)]",
  competitor: "bg-watch-soft text-watch",
  retargeting: "bg-[color-mix(in_oklab,var(--series-5)_20%,transparent)] text-[var(--series-5)]",
  awareness: "bg-good-soft text-good",
};

export function RoleBadge({ role, className }: { role: CampaignRole; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", ROLE_TONES[role], className)}>{ROLE_LABELS[role]}</span>;
}

export const STATUS_TONE: Record<ScoreStatus, { text: string; bg: string; label: string; var: string }> = {
  "on-target": { text: "text-good", bg: "bg-good-soft", label: "On target", var: "var(--good)" },
  watch: { text: "text-watch", bg: "bg-watch-soft", label: "Watch", var: "var(--watch)" },
  underperforming: { text: "text-bad", bg: "bg-bad-soft", label: "Underperforming", var: "var(--bad)" },
};

export function StatusBadge({ status, className }: { status: ScoreStatus; className?: string }) {
  const t = STATUS_TONE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", t.bg, t.text, className)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.var }} />
      {t.label}
    </span>
  );
}

export const CHECK_TONE: Record<CheckStatus, { text: string; bg: string; label: string }> = {
  pass: { text: "text-good", bg: "bg-good-soft", label: "Pass" },
  warn: { text: "text-watch", bg: "bg-watch-soft", label: "Warning" },
  fail: { text: "text-bad", bg: "bg-bad-soft", label: "Fail" },
  info: { text: "text-info", bg: "bg-info-soft", label: "Info" },
};

const ACTION_TONE: Record<BudgetAction, string> = {
  increase: "bg-good-soft text-good",
  hold: "bg-surface-2 text-ink-2",
  optimize: "bg-watch-soft text-watch",
  decrease: "bg-bad-soft text-bad",
};

export const ACTION_LABEL: Record<BudgetAction, string> = {
  increase: "Increase",
  hold: "Hold",
  optimize: "Optimize",
  decrease: "Decrease",
};

export function ActionChip({ action, changePct, changeCents, className }: { action: BudgetAction; changePct: number; changeCents: number; className?: string }) {
  const sign = changePct > 0 ? "+" : "";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", ACTION_TONE[action], className)}>
      {ACTION_LABEL[action]}
      {changePct !== 0 && (
        <span className="num opacity-90">
          {sign}
          {formatPct(changePct)} · {sign}
          {formatCents(changeCents, { compact: true })}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Segmented control with an animated active pill.
// ---------------------------------------------------------------------------

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; hint?: string }[];
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex items-center gap-0.5 rounded-xl border border-border bg-surface p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={cn(
              "ring-focus relative rounded-lg font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              active ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                className="absolute inset-0 rounded-lg bg-surface-2 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_1px_2px_rgba(0,0,0,0.3)]"
                style={{ border: "1px solid var(--border-strong)" }}
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons & misc
// ---------------------------------------------------------------------------

export function Button({
  variant = "secondary",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      type="button"
      className={cn(
        "ring-focus inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" &&
          "bg-[linear-gradient(135deg,var(--brand),var(--brand-2))] text-brand-ink shadow-[0_8px_30px_-10px_color-mix(in_oklab,var(--brand)_70%,transparent)] hover:brightness-110 active:scale-[0.98]",
        variant === "secondary" && "border border-border bg-surface text-ink hover:bg-surface-2",
        variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("text-[11px] font-medium tracking-wide text-ink-3 uppercase", className)}>{children}</span>;
}

/** Simple definition row for detail views. */
export function Stat({ label, children, hint, className }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface p-3", className)}>
      <div className="text-[11px] font-medium tracking-wide text-ink-3 uppercase">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink">{children}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

export function AiLabel({ className, model }: { className?: string; model?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-2", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-2)]" />
      AI-generated text · numbers verified by the metric engine{model ? ` · ${model}` : ""}
    </span>
  );
}
