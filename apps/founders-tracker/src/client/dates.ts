const TZ = "Asia/Kolkata";

/** Weekday labels for recurring cadence (0=Mon … 6=Sun). */
export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function todayIST(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** A date `days` away from today (IST), as 'YYYY-MM-DD'. Negative = past. */
export function addDaysIST(days: number, d: Date = new Date()): string {
  const t = new Date(`${todayIST(d)}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/** Default deadline for a freshly created task: tomorrow, IST. */
export function tomorrowIST(d: Date = new Date()): string {
  return addDaysIST(1, d);
}

/** Whole days from today (IST) to the eta date. Negative = overdue. */
export function daysLeft(eta: string): number {
  const a = Date.parse(`${todayIST()}T12:00:00Z`);
  const b = Date.parse(`${eta}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export type Urgency = "safe" | "soon" | "over";

/** Calm 3-tier deadline mood: comfortable / approaching / due-now-or-past. */
export function etaUrgency(d: number): Urgency {
  if (d <= 2) return "over"; // overdue, due today, or within 2 days
  if (d <= 7) return "soon";
  return "safe";
}

export function fmtEta(eta: string): string {
  const d = new Date(`${eta}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Compact date label for inline chips — day + month, no year. */
export function fmtEtaShort(eta: string): string {
  const d = new Date(`${eta}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { timeZone: TZ, day: "numeric", month: "short" });
}
