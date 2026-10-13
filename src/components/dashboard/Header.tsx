"use client";

import { motion } from "framer-motion";
import { Activity, Moon, Pause, Play, Sparkles, Sun } from "lucide-react";
import type { Period, RevenueBasis } from "@/lib/types";
import { Button, Segmented } from "@/components/ui/primitives";
import { Lottie } from "@/components/lottie/Lottie";
import type { MemoState, Theme } from "./Dashboard";

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export function Header({
  quarters,
  quarter,
  onQuarter,
  basis,
  onBasis,
  asOf,
  theme,
  onToggleTheme,
  animations,
  onToggleAnimations,
  onGenerate,
  memoState,
}: {
  quarters: Period[];
  quarter: string;
  onQuarter: (q: string) => void;
  basis: RevenueBasis;
  onBasis: (b: RevenueBasis) => void;
  asOf: string;
  theme: Theme;
  onToggleTheme: () => void;
  animations: boolean;
  onToggleAnimations: () => void;
  onGenerate: () => void;
  memoState?: MemoState;
}) {
  const generating = memoState?.status === "loading";
  return (
    <header className="top-0 z-40 sm:sticky border-b border-border bg-[color-mix(in_oklab,var(--bg)_78%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
        <motion.div
          className="flex items-center gap-2.5"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--brand),var(--brand-2))] text-brand-ink shadow-[0_8px_24px_-8px_color-mix(in_oklab,var(--brand)_80%,transparent)]">
            <Activity size={18} strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-ink">
              AutoVitals <span className="text-ink-3">·</span>{" "}
              <span className="text-gradient">Ads ROI</span>
            </div>
            <div className="text-[11px] text-ink-3">
              Google Ads → Salesforce · as of{" "}
              <span className="num">{longDate(asOf)}</span>
            </div>
          </div>
        </motion.div>

        <div className="order-3 flex w-full flex-wrap items-center gap-2 sm:order-2 sm:ml-auto sm:w-auto">
          <div className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Segmented
              ariaLabel="Quarter"
              value={quarter}
              onChange={onQuarter}
              size="sm"
              options={quarters.map((q) => ({
                value: q.key,
                hint: q.isPartial
                  ? `${q.label} · quarter to date, in progress`
                  : q.label,
                label: q.isPartial ? (
                  <span className="inline-flex items-center gap-1.5">
                    {q.label}
                    <span className="rounded-full bg-watch-soft px-1.5 py-px text-[10px] font-semibold text-watch">
                      QTD
                    </span>
                  </span>
                ) : (
                  q.label
                ),
              }))}
            />
          </div>
          <Segmented
            ariaLabel="Revenue basis"
            value={basis}
            onChange={onBasis}
            size="sm"
            options={[
              {
                value: "contract",
                label: "Contract value",
                hint: "First-year contract value booked in the period",
              },
              {
                value: "ltv",
                label: "Lifetime value",
                hint: "Customer lifetime value of deals booked in the period",
              },
            ]}
          />
        </div>

        <div className="order-2 ml-auto flex items-center gap-2 sm:order-3 sm:ml-0">
          <button
            type="button"
            onClick={onToggleAnimations}
            aria-pressed={!animations}
            aria-label={animations ? "Pause animations" : "Resume animations"}
            title={animations ? "Pause animations" : "Resume animations"}
            className="ring-focus hidden h-9 w-9 place-items-center rounded-xl border border-border bg-surface text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink sm:grid"
          >
            {animations ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
            className="ring-focus grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Button
            variant="primary"
            onClick={onGenerate}
            aria-busy={generating}
            className="h-9"
          >
            {generating ? (
              <Lottie name="loading" size={18} />
            ) : (
              <Sparkles size={15} />
            )}
            <span className="hidden sm:inline">
              {generating
                ? "Writing memo…"
                : memoState?.status === "ready"
                  ? "Open CRO memo"
                  : "Generate CRO memo"}
            </span>
            <span className="sm:hidden">Memo</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
