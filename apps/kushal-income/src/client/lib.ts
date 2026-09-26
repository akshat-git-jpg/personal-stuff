// Shared money maths and labels. One place decides what "spent" means, so the
// Overview, Transactions and Cards pages can never disagree about a total.

import type { Row, Source } from "./api";

export const SOURCES: Record<Source, { label: string; short: string; color: string }> = {
  sbi: { label: "SBI savings", short: "SBI savings", color: "var(--src-sbi)" },
  sbic: { label: "SBI Card", short: "SBI Card", color: "var(--src-sbic)" },
  neu: { label: "Tata Neu Infinity", short: "Tata Neu", color: "var(--src-neu)" },
  icici: { label: "Amazon Pay ICICI", short: "Amazon ICICI", color: "var(--src-icici)" },
};

/** The main tags, in the order they are offered. Each row has one, plus at most one sub-tag. */
export const MAINS = [
  "food", "grocery", "commute", "trip", "travel", "shopping", "subscription", "work", "home", "bills",
  "health", "personal care", "fitness", "entertainment", "family", "education", "bank", "income", "misc",
];

/** Tags saved before the main/sub split, mapped to [main, sub]. */
const LEGACY: Record<string, [string, string | null]> = {
  taxi: ["commute", "taxi"], auto: ["commute", "taxi"], cab: ["commute", "taxi"], "bike taxi": ["commute", "taxi"],
  metro: ["commute", "metro"], rent: ["home", "rent"], cook: ["home", "cook"], movie: ["entertainment", "movie"],
  protein: ["fitness", "protein"], loan: ["bank", "loan"], "work tools": ["work", null], salary: ["income", "salary"],
};

/** Always [main] or [main, sub]; fixes owner tags saved in the old free form. */
export function mainSub(tags: string[]): string[] {
  const t = tags.filter((x) => x !== "commute" || tags[0] === "commute");
  if (!t.length) return [];
  if (MAINS.includes(t[0])) return t.slice(0, 2);
  const hit = LEGACY[t[0]];
  if (hit) return hit[1] ? [hit[0], hit[1]] : [hit[0], ...t.slice(1, 2)];
  return ["misc", t[0]];
}

/** Sub-tags already used under each main, most used first. */
export function subsByMain(rows: Row[]): Record<string, string[]> {
  const c: Record<string, Map<string, number>> = {};
  for (const r of rows) {
    if (r.tags.length < 2) continue;
    const m = (c[r.tags[0]] ??= new Map());
    m.set(r.tags[1], (m.get(r.tags[1]) ?? 0) + 1);
  }
  return Object.fromEntries(Object.entries(c).map(([k, m]) => [k, [...m.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)]));
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const rs = (n: number, paise = false) =>
  "₹" + Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: paise && n % 1 ? 2 : 0, maximumFractionDigits: paise ? 2 : 0,
  });

export const dayLabel = (iso: string) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}`;
export const monthLabel = (ym: string) => `${MONTHS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
export const monthOf = (iso: string) => iso.slice(0, 7);

/** Money that left and counts as spending. Card bills and card-side payments never do. */
export const isSpend = (r: Row) => r.kind === "spend" && r.amount !== null && r.amount < 0;
/** Money that came in: salary, interest, other credits, refunds. */
export const isIn = (r: Row) => (r.kind === "in" || r.kind === "refund") && r.amount !== null && r.amount > 0;

export function totals(rows: Row[]) {
  let spent = 0, inn = 0, needs = 0, needsN = 0, fxOnly = 0;
  for (const r of rows) {
    if (r.amount === null) { if (r.kind === "spend") fxOnly++; continue; }
    if (isSpend(r)) {
      spent -= r.amount;
      if (r.status === "needs") { needs -= r.amount; needsN++; }
    } else if (isIn(r)) inn += r.amount;
  }
  return { spent, inn, needs, needsN, fxOnly };
}

/** The tag a row is counted under in "where it went". Untagged money stays apart. */
export const mainTag = (r: Row) => (r.status === "needs" || !r.tags.length ? "needs you" : r.tags[0]);

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const todayIso = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

/** Hash route: "#/transactions?tag=food&month=2026-09". */
export function parseHash(h: string): { page: string; params: URLSearchParams } {
  const [path, q] = h.replace(/^#\/?/, "").split("?");
  return { page: path || "overview", params: new URLSearchParams(q ?? "") };
}
