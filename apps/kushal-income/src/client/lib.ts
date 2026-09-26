// Shared money maths and labels. One place decides what "spent" means, so the
// Overview, Transactions and Cards pages can never disagree about a total.

import type { Row, Source } from "./api";

export const SOURCES: Record<Source, { label: string; short: string; color: string }> = {
  sbi: { label: "SBI savings", short: "SBI savings", color: "var(--src-sbi)" },
  sbic: { label: "SBI Card", short: "SBI Card", color: "var(--src-sbic)" },
  neu: { label: "Tata Neu Infinity", short: "Tata Neu", color: "var(--src-neu)" },
  icici: { label: "Amazon Pay ICICI", short: "Amazon ICICI", color: "var(--src-icici)" },
};

/** Offered first when tagging. Any other word can be typed. */
export const TAG_CHOICES = [
  "food", "grocery", "taxi", "metro", "travel", "shopping", "subscription", "bills", "rent", "cook",
  "family", "health", "personal care", "fitness", "fuel", "entertainment", "home services",
  "work tools", "education", "loan", "fees", "misc",
];

/** Categories that also belong to a wider group, added automatically on save. */
export const PARENT: Record<string, string> = { taxi: "commute", metro: "commute" };

/** Buttons offered for a payment made during a trip. */
export const tripChoices = (trip?: string) =>
  trip ? ["stay", "food", "bus", "auto", "metro"].map((k) => `${trip}-${k}`) : [];

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
