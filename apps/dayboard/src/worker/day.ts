/**
 * day.ts — fetch one day from Google and hand back a DayLayout.
 *
 * Split out of index.ts so the route handler stays four lines and this, the part
 * with the fan-out and the clipping rules, can be read on its own.
 */
import {
  getAccessToken,
  listCalendars,
  listEvents,
  sanitizeDescription,
  type GoogleCalendar,
  type GoogleCreds,
  type GoogleEvent,
} from './google'
import { buildLayout, type DayEvent, type DayLayout } from './layout'
import { categorize, colorFor, PALETTE, type Category } from './palette'
import { dayWindow, isAfter, isBefore, toDayMinutes } from './time'

/** Fresh enough that an edit on the phone shows on the next tab focus. */
export const DAY_CACHE_TTL_SEC = 60

export type DayResult = DayLayout & {
  calendars: { id: string; name: string; color: string }[]
  /** Category -> hex, so the UI can render a legend without duplicating the table. */
  palette: Record<Category, string>
  fetchedAt: string
}

/**
 * `timeMin`/`timeMax` are widened by a day on each side so an event that starts
 * yesterday evening (Sleep, 22:00-05:00) still comes back and gets clipped to the
 * top of today's grid rather than vanishing.
 */
export async function fetchDay(
  kv: KVNamespace,
  creds: GoogleCreds,
  date: string,
  timeZone: string,
  hiddenCalendarIds: Set<string> = new Set(),
): Promise<DayResult> {
  const { startMs, endMs } = dayWindow(date, timeZone)
  const token = await getAccessToken(kv, creds)

  const calendars = (await listCalendars(token))
    .filter((c) => !hiddenCalendarIds.has(c.id))
    // The primary calendar's Google "summary" is the raw email address, which is
    // useless on a card that says which calendar an event came from.
    .map((c) => (c.primary ? { ...c, summary: 'Personal' } : c))

  const timeMin = new Date(startMs - 24 * 60 * 60 * 1000).toISOString()
  const timeMax = new Date(endMs + 24 * 60 * 60 * 1000).toISOString()

  const perCalendar = await Promise.all(
    calendars.map(async (cal) => ({
      cal,
      // One dead calendar must not blank the whole board.
      events: await listEvents(token, cal.id, timeMin, timeMax).catch(() => [] as GoogleEvent[]),
    })),
  )

  const timed: DayEvent[] = []
  const allDay: { id: string; title: string; calendar: string; color: string; category: Category }[] = []

  for (const { cal, events } of perCalendar) {
    for (const ev of events) {
      if (ev.start?.date && !ev.start.dateTime) {
        if (coversDate(ev, date)) {
          const adTitle = ev.summary ?? '(no title)'
          allDay.push({
            id: ev.id,
            title: adTitle,
            calendar: cal.summary,
            category: categorize(adTitle, cal.summary),
            color: colorFor(adTitle, cal.summary),
          })
        }
        continue
      }
      const startISO = ev.start?.dateTime
      const endISO = ev.end?.dateTime
      if (!startISO || !endISO) continue

      // Drop anything entirely outside today after the widened fetch.
      if (Date.parse(endISO) <= startMs || Date.parse(startISO) >= endMs) continue

      const startMin = toDayMinutes(startISO, startMs)
      const endMin = toDayMinutes(endISO, startMs)
      if (endMin <= startMin) continue

      const title = ev.summary ?? '(no title)'
      timed.push({
        id: ev.id,
        title,
        description: sanitizeDescription(ev.description),
        calendar: cal.summary,
        calendarId: cal.id,
        // Colour comes from WHAT the event is, not which calendar holds it — the
        // primary calendar alone mixes Sleep, Gym, Lunch and Zluri Work.
        category: categorize(title, cal.summary),
        color: colorFor(title, cal.summary),
        startMin,
        endMin,
        clippedStart: isBefore(startISO, startMs),
        clippedEnd: isAfter(endISO, endMs),
        htmlLink: ev.htmlLink ?? '',
      })
    }
  }

  return {
    ...buildLayout(date, timeZone, timed, allDay),
    calendars: calendars.map((c: GoogleCalendar) => ({ id: c.id, name: c.summary, color: c.backgroundColor })),
    palette: PALETTE,
    fetchedAt: new Date().toISOString(),
  }
}

/** All-day events use exclusive end dates: 14th-15th means "the 14th only". */
function coversDate(ev: GoogleEvent, date: string): boolean {
  const from = ev.start?.date ?? ''
  const to = ev.end?.date ?? ''
  if (!from) return false
  return from <= date && (to === '' || date < to)
}
