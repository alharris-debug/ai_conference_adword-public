// Calendar helpers on YYYY-MM-DD strings, always in UTC so results never shift with the viewer's time zone.

import type { Period } from "./types";

const DAY_MS = 86_400_000;

export function toMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function fromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromMs(toMs(date) + days * DAY_MS);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toMs(b) - toMs(a)) / DAY_MS);
}

export function* eachDay(start: string, end: string): Generator<string> {
  for (let ms = toMs(start); ms <= toMs(end); ms += DAY_MS) yield fromMs(ms);
}

export function quarterKeyOf(date: string): string {
  const month = Number(date.slice(5, 7));
  return `${date.slice(0, 4)}-Q${Math.floor((month - 1) / 3) + 1}`;
}

function quarterBounds(key: string): { start: string; end: string } {
  const year = Number(key.slice(0, 4));
  const q = Number(key.slice(6));
  const startMonth = (q - 1) * 3 + 1;
  const start = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const nextStart = q === 4 ? `${year + 1}-01-01` : `${year}-${String(startMonth + 3).padStart(2, "0")}-01`;
  return { start, end: addDays(nextStart, -1) };
}

export function previousQuarterKey(key: string): string {
  const year = Number(key.slice(0, 4));
  const q = Number(key.slice(6));
  return q === 1 ? `${year - 1}-Q4` : `${year}-Q${q - 1}`;
}

/** A quarter clipped to the data's as-of date. */
export function quarterPeriod(key: string, asOf: string): Period {
  const { start, end } = quarterBounds(key);
  const clippedEnd = end < asOf ? end : asOf;
  const total = daysBetween(start, end) + 1;
  const elapsed = Math.max(0, daysBetween(start, clippedEnd) + 1);
  return {
    key,
    label: `Q${key.slice(6)} ${key.slice(0, 4)}`,
    start,
    end: clippedEnd,
    isPartial: clippedEnd < end,
    elapsedFraction: Math.min(1, elapsed / total),
  };
}

/** Quarter keys from `firstKey` through the quarter containing `asOf`, oldest first. */
export function quarterKeys(firstKey: string, asOf: string): string[] {
  const keys: string[] = [];
  const last = quarterKeyOf(asOf);
  let key = last;
  while (key >= firstKey) {
    keys.unshift(key);
    key = previousQuarterKey(key);
  }
  return keys;
}

/** Monday of the week containing `date`. */
export function weekStartOf(date: string): string {
  const day = new Date(toMs(date)).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}
