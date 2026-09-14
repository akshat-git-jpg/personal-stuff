/**
 * time.ts — turning Google's absolute timestamps into "minutes down the page".
 *
 * The grid is drawn in ONE timezone (env.TIMEZONE, Asia/Kolkata), not the viewer's.
 * A day therefore has fixed epoch boundaries, and every event's position is plain
 * subtraction from those. Doing the timezone work once, here, keeps layout.ts pure
 * arithmetic and keeps per-event Intl formatting (slow, and easy to get wrong) out
 * of the hot path.
 */

export const DAY_MIN = 24 * 60
const MS_PER_MIN = 60_000

/**
 * Minutes that `timeZone` is ahead of UTC at `instant`.
 * Derived by formatting the instant in that zone and reading the wall clock back —
 * the only way to get a zone offset in a Worker without shipping a tz database.
 */
export function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)

  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0')
  // hour comes back as 24 at midnight under hour12:false in some engines.
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return Math.round((asUTC - instant.getTime()) / MS_PER_MIN)
}

/**
 * Epoch milliseconds for 00:00 and 24:00 of `date` (YYYY-MM-DD) in `timeZone`.
 * Resolved twice so a DST transition during the day still lands on real midnight.
 */
export function dayWindow(date: string, timeZone: string): { startMs: number; endMs: number } {
  const utcMidnight = Date.parse(`${date}T00:00:00Z`)
  if (Number.isNaN(utcMidnight)) throw new Error(`bad date: ${date}`)

  let startMs = utcMidnight - tzOffsetMinutes(new Date(utcMidnight), timeZone) * MS_PER_MIN
  startMs = utcMidnight - tzOffsetMinutes(new Date(startMs), timeZone) * MS_PER_MIN

  const utcNextMidnight = utcMidnight + DAY_MIN * MS_PER_MIN
  let endMs = utcNextMidnight - tzOffsetMinutes(new Date(utcNextMidnight), timeZone) * MS_PER_MIN
  endMs = utcNextMidnight - tzOffsetMinutes(new Date(endMs), timeZone) * MS_PER_MIN

  return { startMs, endMs }
}

/**
 * Where an absolute instant sits on the day grid, clamped to [0, 1440].
 * Sleep 22:00-05:00 therefore renders as 1320-1440 today and 0-300 tomorrow, which
 * is what a day view should show.
 */
export function toDayMinutes(iso: string, dayStartMs: number): number {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) throw new Error(`bad timestamp: ${iso}`)
  const min = Math.round((ms - dayStartMs) / MS_PER_MIN)
  return Math.min(DAY_MIN, Math.max(0, min))
}

/** True when the instant falls before the start of the day (so the event is clipped). */
export function isBefore(iso: string, dayStartMs: number): boolean {
  return Date.parse(iso) < dayStartMs
}

/** True when the instant falls after the end of the day. */
export function isAfter(iso: string, dayEndMs: number): boolean {
  return Date.parse(iso) > dayEndMs
}

/** `YYYY-MM-DD` for "today" in the grid's timezone — what `/api/day` defaults to. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '01'
  return `${get('year')}-${get('month')}-${get('day')}`
}
