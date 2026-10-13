"use client";

// Page state lives here: quarter, revenue basis, theme and the memo cache.
// The model is recomputed client-side from the deterministic engine on every
// switch (fast enough to animate), so nothing in the UI computes a metric.

import { LayoutGroup, MotionConfig, motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { useTheme } from "@/lib/hooks";
import { AnimationsContext } from "@/lib/motion-context";
import { getIndex } from "@/lib/dataset";
import { buildDashboard } from "@/lib/metrics";
import { quarterKeys, quarterPeriod } from "@/lib/dates";
import { FIRST_REPORTED_QUARTER } from "@/lib/data/config";
import type { RevenueBasis } from "@/lib/types";
import type { Memo } from "@/lib/ai/memo";
import { Header } from "./Header";
import { HealthHero } from "./HealthHero";
import { KpiStrip } from "./KpiStrip";
import { Leaderboard } from "./Leaderboard";
import { ProductLines } from "./ProductLines";
import { Trends } from "./Trends";
import { DataTrust } from "./DataTrust";
import { MemoPanel } from "./MemoPanel";

export type { Theme } from "@/lib/hooks";

export type MemoState =
  | { status: "loading"; startedAt: number }
  | { status: "ready"; memo: Memo }
  | { status: "error"; message: string };

export function Dashboard() {
  const idx = useMemo(() => getIndex(), []);
  const quarters = useMemo(() => {
    return quarterKeys(FIRST_REPORTED_QUARTER, idx.ds.asOf).map((key) =>
      quarterPeriod(key, idx.ds.asOf),
    );
  }, [idx]);
  const defaultQuarter = useMemo(
    () =>
      [...quarters].reverse().find((q) => !q.isPartial)?.key ??
      quarters[quarters.length - 1].key,
    [quarters],
  );

  const [quarter, setQuarter] = useState(defaultQuarter);
  const [basis, setBasis] = useState<RevenueBasis>("contract");
  const [theme, toggleTheme] = useTheme();
  const [animations, setAnimations] = useState(true);
  const model = useMemo(
    () => buildDashboard(idx, quarter, basis),
    [idx, quarter, basis],
  );

  // Memo cache per quarter + basis, so re-opening never re-calls the API.
  const [memos, setMemos] = useState<Record<string, MemoState>>({});
  const [memoOpen, setMemoOpen] = useState(false);
  const memoKey = `${quarter}:${basis}`;
  const memoState = memos[memoKey];

  const generateMemo = useCallback(
    async (force = false) => {
      setMemoOpen(true);
      const current = memos[memoKey];
      if (!force && current && current.status !== "error") return;
      setMemos((m) => ({
        ...m,
        [memoKey]: { status: "loading", startedAt: Date.now() },
      }));
      try {
        const res = await fetch("/api/memo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ quarter, basis }),
        });
        if (!res.ok)
          throw new Error(`The memo service answered ${res.status}.`);
        const memo = (await res.json()) as Memo;
        setMemos((m) => ({ ...m, [memoKey]: { status: "ready", memo } }));
      } catch (err) {
        setMemos((m) => ({
          ...m,
          [memoKey]: {
            status: "error",
            message: err instanceof Error ? err.message : "Unknown error",
          },
        }));
      }
    },
    [memos, memoKey, quarter, basis],
  );

  return (
    <MotionConfig reducedMotion={animations ? "user" : "always"}>
      <AnimationsContext.Provider value={animations}>
        <LayoutGroup>
          <div className="flex min-h-dvh flex-col">
            <Header
              quarters={quarters}
              quarter={quarter}
              onQuarter={setQuarter}
              basis={basis}
              onBasis={setBasis}
              asOf={idx.ds.asOf}
              theme={theme}
              onToggleTheme={toggleTheme}
              animations={animations}
              onToggleAnimations={() => setAnimations((a) => !a)}
              onGenerate={() => generateMemo()}
              memoState={memoState}
            />
            <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-16 sm:px-6 lg:px-8">
              <motion.div
                className="grid grid-cols-1 gap-4 pt-5 sm:gap-5"
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: {
                    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
                  },
                }}
              >
                <Reveal>
                  <HealthHero model={model} />
                </Reveal>
                <Reveal>
                  <KpiStrip model={model} />
                </Reveal>
                <Reveal>
                  <Leaderboard model={model} />
                </Reveal>
                <Reveal className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2">
                  <ProductLines model={model} />
                  <Trends model={model} />
                </Reveal>
                <Reveal>
                  <DataTrust model={model} />
                </Reveal>
              </motion.div>
            </main>
            <footer className="mx-auto w-full max-w-[1400px] px-4 pb-8 text-xs text-ink-3 sm:px-6 lg:px-8">
              Every metric on this page is computed deterministically from the
              Google Ads export and Salesforce rows in integer cents. AI writes
              only the memo text, and it is labeled.
            </footer>
          </div>
          <MemoPanel
            open={memoOpen}
            onClose={() => setMemoOpen(false)}
            state={memoState}
            model={model}
            onRetry={() => generateMemo(true)}
          />
        </LayoutGroup>
      </AnimationsContext.Provider>
    </MotionConfig>
  );
}

function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 18, filter: "blur(4px)" },
        show: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { type: "spring", stiffness: 120, damping: 20 },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
