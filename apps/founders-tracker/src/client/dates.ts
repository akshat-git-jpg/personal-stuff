const TZ = "Asia/Kolkata";

export function todayIST(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Default deadline for a freshly created task: tomorrow, IST. */
export function tomorrowIST(d: Date = new Date()): string {
  const t = new Date(`${todayIST(d)}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
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
