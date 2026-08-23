// Pure habit + period arithmetic, shared by the Worker and the React client.
// No D1, no fetch, no Date.now() beyond an injected 'today' — everything here
// is a function of plain 'YYYY-MM-DD' strings so it is trivially testable.

import type { Cadence } from "./shared";

/** Cadences that are habits (tick a streak) rather than task generators. */
export const HABIT_CADENCES = ["daily", "weekly"] as const;
export type HabitCadence = (typeof HABIT_CADENCES)[number];

export function isHabitCadence(c: Cadence): c is HabitCadence {
  return c === "daily" || c === "weekly";
}

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `ymd` shifted by `n` days (negative = backwards). Anchored at UTC noon so a
 *  DST-style hour shift can never bump the calendar day. */
export function addDaysYmd(ymd: string, n: number): string {
  const t = new Date(`${ymd}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** Integer days from `fromYmd` to `toYmd`. Negative = `toYmd` is earlier. */
export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T12:00:00Z`);
  const b = Date.parse(`${toYmd}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** ISO week number + ISO week-year for a 'YYYY-MM-DD'. */
export function isoWeek(ymd: string): { year: number; week: number } {
  const { y, m, d } = parseYmd(ymd);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = (date.getUTCDay() + 6) % 7; // 0=Mon … 6=Sun
  date.setUTCDate(date.getUTCDate() - day + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const fday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
  return { year: date.getUTCFullYear(), week };
}

/** Stable key for the period containing `ymd`. Used by the task generator and
 *  by the unique index on tasks(template_id, period_key). */
export function periodKey(cadence: Cadence, ymd: string): string {
  if (cadence === "daily") return ymd; // YYYY-MM-DD — one instance per day
  if (cadence === "monthly") return ymd.slice(0, 7); // YYYY-MM
  const { year, week } = isoWeek(ymd);
  return `${year}-W${pad2(week)}`;
}

/** First day of the habit period containing `ymd`. This — not the period key —
 *  is what `habit_logs.anchor_ymd` stores, so all streak maths is day
 *  arithmetic: daily periods step by 1 day, weekly ones by 7. */
export function periodStart(cadence: HabitCadence, ymd: string): string {
  if (cadence === "daily") return ymd;
  const dow = (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7; // 0=Mon … 6=Sun
  return addDaysYmd(ymd, -dow);
}

/** Days between consecutive periods of this cadence. */
export function periodStep(cadence: HabitCadence): number {
  return cadence === "weekly" ? 7 : 1;
}

/** Consecutive kept periods ending at or just before `todayYmd`.
 *
 *  Grace rule: the CURRENT period being unticked does not break the streak —
 *  the day (or week) is not over yet — so counting starts from the previous
 *  period in that case. The streak breaks the moment a completed period in the
 *  chain is missing. Returns 0 for an empty history. */
export function currentStreak(
  cadence: HabitCadence, anchors: ReadonlySet<string>, todayYmd: string,
): number {
  const step = periodStep(cadence);
  let cursor = periodStart(cadence, todayYmd);
  if (!anchors.has(cursor)) cursor = addDaysYmd(cursor, -step);
  let n = 0;
  while (anchors.has(cursor)) {
    n += 1;
    cursor = addDaysYmd(cursor, -step);
  }
  return n;
}

/** Longest run of consecutive kept periods anywhere in the history. */
export function bestStreak(cadence: HabitCadence, anchors: ReadonlySet<string>): number {
  const step = periodStep(cadence);
  const sorted = [...anchors].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const a of sorted) {
    run = prev !== null && addDaysYmd(prev, step) === a ? run + 1 : 1;
    if (run > best) best = run;
    prev = a;
  }
  return best;
}
