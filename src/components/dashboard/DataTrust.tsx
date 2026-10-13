"use client";

import { motion } from "framer-motion";
import { ChevronDown, ShieldCheck, Unlink } from "lucide-react";
import { useState } from "react";
import type { CheckStatus, DashboardModel, IntegrityCheck } from "@/lib/types";
import { formatCents, formatCount } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Collapse, ExpandableCard } from "@/components/ui/Expandable";
import { CHECK_TONE, Stat } from "@/components/ui/primitives";
import { Lottie, type AnimationName } from "@/components/lottie/Lottie";

const ICON: Record<CheckStatus, AnimationName> = { pass: "status-check", warn: "status-warn", fail: "status-fail", info: "status-info" };
const ORDER: CheckStatus[] = ["fail", "warn", "info", "pass"];

export function DataTrust({ model }: { model: DashboardModel }) {
  const checks = [...model.checks].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const counts = model.checks.reduce<Record<CheckStatus, number>>((acc, c) => ({ ...acc, [c.status]: acc[c.status] + 1 }), { pass: 0, warn: 0, fail: 0, info: 0 });
  const headline = counts.fail > 0 ? `${counts.fail} check${counts.fail > 1 ? "s" : ""} failed — fix before presenting` : counts.warn > 0 ? `${counts.pass} of ${model.checks.length} checks pass · ${counts.warn} to be aware of` : "Every check passes";

  const list = (
    <div className="grid gap-2 md:grid-cols-2">
      {checks.map((c, i) => (
        <CheckRow key={c.id} check={c} index={i} />
      ))}
    </div>
  );

  const unattributed = (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-[color-mix(in_oklab,var(--info)_7%,transparent)] p-4 md:flex-row md:items-center">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-info-soft text-info">
        <Unlink size={18} />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium text-ink">Unattributed Google Ads leads are counted, not hidden</div>
        <p className="text-ink-2">
          {formatCount(model.unattributed.leads)} leads marked &ldquo;Google Ads&rdquo; in Salesforce had no usable utm_campaign in {model.period.label}. They became {formatCount(model.unattributed.customers)} customers worth{" "}
          <span className="num text-ink">{formatCents(model.unattributed.revenueCents)}</span>. That revenue is real but belongs to no campaign, so campaign ROAS is conservative and the account total excludes it.
        </p>
      </div>
      <div className="grid shrink-0 grid-cols-3 gap-2 md:w-72">
        <Stat label="Leads">{formatCount(model.unattributed.leads)}</Stat>
        <Stat label="Customers">{formatCount(model.unattributed.customers)}</Stat>
        <Stat label="Revenue">{formatCents(model.unattributed.revenueCents, { compact: true })}</Stat>
      </div>
    </div>
  );

  const expanded = (
    <div className="grid gap-5">
      <div className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed text-ink-2">
        <div className="mb-1 font-medium text-ink">Why these checks exist</div>
        The report used to be a hand-built spreadsheet merge. Every number here is recomputed from the raw Google Ads export rows and Salesforce lead and opportunity records, in integer cents, and these checks prove the totals tie out and that nothing was double counted or silently dropped. If a check fails, the memo says so in its data caveats.
      </div>
      <div className="grid gap-2">
        {checks.map((c, i) => (
          <CheckRow key={c.id} check={c} index={i} defaultOpen />
        ))}
      </div>
      {unattributed}
    </div>
  );

  return (
    <ExpandableCard
      id="trust"
      icon={<ShieldCheck size={16} />}
      title="Numbers you can take to the CRO"
      subtitle={`${headline} · every figure is traceable to the Google Ads export and Salesforce`}
      actions={
        <span className="mr-1 hidden items-center gap-1.5 sm:flex">
          <Pill n={counts.pass} status="pass" />
          <Pill n={counts.warn} status="warn" />
          <Pill n={counts.fail} status="fail" />
          <Pill n={counts.info} status="info" />
        </span>
      }
      expanded={expanded}
    >
      <div className="grid gap-4">
        {list}
        {unattributed}
      </div>
    </ExpandableCard>
  );
}

function Pill({ n, status }: { n: number; status: CheckStatus }) {
  if (!n) return null;
  const t = CHECK_TONE[status];
  return (
    <span className={cn("num rounded-full px-2 py-0.5 text-[11px] font-semibold", t.bg, t.text)}>
      {n} {t.label.toLowerCase()}
    </span>
  );
}

function CheckRow({ check, index, defaultOpen = false }: { check: IntegrityCheck; index: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const t = CHECK_TONE[check.status];
  const hasDetails = check.details.length > 0;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.04 * index } }} className={cn("rounded-xl border border-border bg-surface", open && "bg-surface-2")}>
      <button
        type="button"
        onClick={() => hasDetails && setOpen(!open)}
        aria-expanded={open}
        disabled={!hasDetails}
        className="ring-focus flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left disabled:cursor-default"
      >
        <span className="mt-0.5 shrink-0">
          <Lottie name={ICON[check.status]} size={30} loop={false} label={t.label} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{check.label}</span>
            <span className={cn("rounded-full px-2 py-px text-[10px] font-semibold tracking-wide uppercase", t.bg, t.text)}>{t.label}</span>
          </span>
          <span className="mt-0.5 block text-sm text-ink-2">{check.summary}</span>
        </span>
        {hasDetails && (
          <motion.span animate={{ rotate: open ? 180 : 0 }} className="mt-1 shrink-0 text-ink-3">
            <ChevronDown size={16} />
          </motion.span>
        )}
      </button>
      <Collapse open={open && hasDetails}>
        <ul className="mx-3 mb-3 grid gap-1 rounded-lg border border-border bg-bg-elev/40 px-3 py-2 font-mono text-xs text-ink-2">
          {check.details.map((d) => (
            <li key={d} className="flex gap-2">
              <span className="text-ink-3">›</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </Collapse>
    </motion.div>
  );
}
