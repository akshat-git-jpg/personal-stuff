// Date-only helpers in Asia/Kolkata. We never compare raw timestamps for
// deadline math — everything reduces to a 'YYYY-MM-DD' string first.

const IST = "en-CA"; // en-CA formats as YYYY-MM-DD
const TZ = "Asia/Kolkata";

/** 'YYYY-MM-DD' for the current moment in Asia/Kolkata. */
export function todayIST(d: Date = new Date()): string {
  return new Intl.DateTimeFormat(IST, {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Integer days from `fromYmd` to `toYmd` (UTC-noon anchored to avoid DST drift). */
export function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T12:00:00Z`);
  const b = Date.parse(`${toYmd}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
