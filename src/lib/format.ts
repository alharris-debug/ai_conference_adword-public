// Display formatting only. Values stay in integer cents until they reach here.

export function formatCents(cents: number | null, opts: { compact?: boolean } = {}): string {
  if (cents === null || !Number.isFinite(cents)) return "—";
  const dollars = cents / 100;
  if (opts.compact && Math.abs(dollars) >= 1000) {
    // Hand-rolled so the server and every browser agree ("$740K", "$1.2M"); ICU versions differ on compact notation.
    const abs = Math.abs(dollars);
    // Pick the unit after rounding so 999,950 shows as "$1M", not "$1000K".
    const [div, suffix] = abs >= 999_500_000 ? [1e9, "B"] : abs >= 999_500 ? [1e6, "M"] : [1e3, "K"];
    const n = abs / div;
    const digits = n >= 100 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, "");
    return `${dollars < 0 ? "-" : ""}$${digits}${suffix}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(dollars) >= 1000 ? 0 : 2,
    minimumFractionDigits: Math.abs(dollars) >= 1000 ? 0 : 2,
  }).format(dollars);
}

/** 2.5 → "2.50x" */
export function formatRoas(roas: number | null): string {
  return roas === null || !Number.isFinite(roas) ? "—" : `${roas.toFixed(2)}x`;
}

/** 1.5 → "150%" */
export function formatPct(value: number | null, digits = 0): string {
  return value === null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(digits)}%`;
}

export function formatCount(n: number | null): string {
  return n === null ? "—" : n.toLocaleString("en-US");
}

/** Relative change; null when there is no meaningful base. */
export function delta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}
