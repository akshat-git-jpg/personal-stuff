const TZ = "Asia/Kolkata";

export function todayIST(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Whole days from today (IST) to the eta date. Negative = overdue. */
export function daysLeft(eta: string): number {
  const a = Date.parse(`${todayIST()}T12:00:00Z`);
  const b = Date.parse(`${eta}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export type Urgency = "green" | "amber" | "red" | "overdue";

export function etaUrgency(d: number): Urgency {
  if (d < 0) return "overdue";
  if (d <= 2) return "red";
  if (d <= 7) return "amber";
  return "green";
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
