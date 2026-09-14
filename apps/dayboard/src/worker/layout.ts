/**
 * layout.ts — the whole of Dayboard's intelligence, and the only part with tests.
 *
 * Google Calendar hands back a flat list of events. Drawing that list as a column
 * of rectangles is exactly what Google Calendar already does badly: 5-minute water
 * reminders become full-width bars, and a wide "Random" block squashes everything
 * that overlaps it into unreadable columns.
 *
 * This module sorts one day's events into three SHAPES instead:
 *
 *   ping     an event <= PING_MAX_MIN long. A moment, not a duration. The UI draws
 *            it as a hairline tick + label, never a bar. Pings that start at the
 *            same minute merge into one tick (Post Gym Routine + Amla Juice).
 *   context  a long event that several other events sit inside (Random, 9:00-1:30).
 *            The UI draws it as a faded band BEHIND everything else.
 *   block    everything else. Blocks that overlap a context render indented on top
 *            of it, so overlap never costs horizontal space.
 *
 * Everything here is pure arithmetic over minutes-from-local-midnight, so it is
 * testable with no network and no Worker runtime.
 */
import type { Category } from './palette'


/** An event as the Worker hands it over: already timezone-resolved to minutes. */
export type DayEvent = {
  id: string
  title: string
  description: string
  calendar: string
  calendarId: string
  /** What kind of thing this is — drives the colour. See palette.ts. */
  category: Category
  color: string
  /** Minutes from local midnight, clamped to 0. */
  startMin: number
  /** Minutes from local midnight, clamped to 1440. */
  endMin: number
  /** True when the real event started before this day (clipped at 00:00). */
  clippedStart: boolean
  /** True when the real event ends after this day (clipped at 24:00). */
  clippedEnd: boolean
  htmlLink: string
}

export type Ping = {
  kind: 'ping'
  category: Category
  /** Composite id when several pings merged onto one minute. */
  id: string
  startMin: number
  color: string
  /** One entry per merged event, sorted by title so the order never reshuffles. */
  items: { id: string; title: string; calendar: string; description: string; htmlLink: string }[]
}

export type ContextBand = {
  kind: 'context'
  category: Category
  id: string
  title: string
  description: string
  calendar: string
  color: string
  startMin: number
  endMin: number
  clippedStart: boolean
  clippedEnd: boolean
  htmlLink: string
}

export type Block = DayEvent & {
  kind: 'block'
  /** 0 = top level. 1 = sits inside a context band, so the UI indents it. */
  depth: 0 | 1
  /** id of the context band it sits inside, when depth is 1. */
  insideId: string | null
  /** Title of that band, so the NOW card can say "inside Random". */
  insideTitle: string | null
}

export type DayLayout = {
  date: string
  timezone: string
  allDay: { id: string; title: string; calendar: string; color: string; category: Category }[]
  contexts: ContextBand[]
  blocks: Block[]
  pings: Ping[]
}

/** An event this long or shorter is a moment, not a duration. */
export const PING_MAX_MIN = 15
/** A context band must be at least this long... */
export const CONTEXT_MIN_MIN = 120
/** ...and must have at least this many other timed events overlapping it. */
export const CONTEXT_MIN_OVERLAPS = 2

/** Half-open overlap: events that merely touch (10:30-11:00, 11:00-16:00) do NOT overlap. */
export function overlaps(a: { startMin: number; endMin: number }, b: { startMin: number; endMin: number }): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin
}

/**
 * Sort one day's timed events into pings, context bands and blocks.
 * `events` must already be clipped to the day and sorted by nothing in particular.
 */
export function buildLayout(
  date: string,
  timezone: string,
  events: DayEvent[],
  allDay: { id: string; title: string; calendar: string; color: string; category: Category }[] = [],
): DayLayout {
  const byStart = [...events].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin || a.id.localeCompare(b.id))

  // 1. Pings: short enough to be a moment.
  const pingEvents = byStart.filter((e) => e.endMin - e.startMin <= PING_MAX_MIN)
  const durationEvents = byStart.filter((e) => e.endMin - e.startMin > PING_MAX_MIN)

  // Merge pings that fire at the same minute into one tick.
  const pingsByMinute = new Map<number, DayEvent[]>()
  for (const e of pingEvents) {
    const at = pingsByMinute.get(e.startMin)
    if (at) at.push(e)
    else pingsByMinute.set(e.startMin, [e])
  }
  const pings: Ping[] = [...pingsByMinute.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([startMin, group]) => {
      // Google event ids are random strings, so the incoming order of two pings on
      // the same minute is arbitrary and would reshuffle between loads. Sort by title.
      const items = [...group].sort((a, b) => a.title.localeCompare(b.title))
      return {
      kind: 'ping' as const,
      id: items.map((e) => e.id).join('+'),
      startMin,
      category: items[0].category,
      color: items[0].color,
      items: items.map((e) => ({
        id: e.id,
        title: e.title,
        calendar: e.calendar,
        description: e.description,
        htmlLink: e.htmlLink,
      })),
      }
    })

  // 2. Context bands: long AND crowded. Only duration events count as crowding —
  //    a stack of water reminders must never promote a block to a background band.
  const contextCandidates = durationEvents.filter((e) => {
    if (e.endMin - e.startMin < CONTEXT_MIN_MIN) return false
    const n = durationEvents.filter((o) => o.id !== e.id && overlaps(e, o)).length
    return n >= CONTEXT_MIN_OVERLAPS
  })

  // Two overlapping candidates would paint two bands over each other. Longest wins;
  // the loser falls back to being an ordinary block.
  const contextIds = new Set<string>()
  for (const cand of [...contextCandidates].sort(
    (a, b) => b.endMin - b.startMin - (a.endMin - a.startMin) || a.id.localeCompare(b.id),
  )) {
    const clashes = [...contextIds].some((id) => {
      const chosen = durationEvents.find((e) => e.id === id)!
      return overlaps(cand, chosen)
    })
    if (!clashes) contextIds.add(cand.id)
  }

  const contexts: ContextBand[] = durationEvents
    .filter((e) => contextIds.has(e.id))
    .map((e) => ({
      kind: 'context' as const,
      category: e.category,
      id: e.id,
      title: e.title,
      description: e.description,
      calendar: e.calendar,
      color: e.color,
      startMin: e.startMin,
      endMin: e.endMin,
      clippedStart: e.clippedStart,
      clippedEnd: e.clippedEnd,
      htmlLink: e.htmlLink,
    }))

  // 3. Blocks: everything else, indented when it sits inside a band.
  const blocks: Block[] = durationEvents
    .filter((e) => !contextIds.has(e.id))
    .map((e) => {
      const inside = contexts.find((ctx) => overlaps(e, ctx)) ?? null
      return {
        ...e,
        kind: 'block' as const,
        depth: inside ? (1 as const) : (0 as const),
        insideId: inside?.id ?? null,
        insideTitle: inside?.title ?? null,
      }
    })

  return { date, timezone, allDay, contexts, blocks, pings }
}

/**
 * What is happening right now, for the NOW card.
 * The innermost (shortest) block wins — during Zluri Work inside Random, the answer
 * is Zluri Work, with Random named as the surrounding context.
 */
export function currentAt(layout: DayLayout, nowMin: number): {
  block: Block | null
  context: ContextBand | null
  next: { startMin: number; title: string; kind: 'block' | 'ping' } | null
} {
  const live = layout.blocks
    .filter((b) => b.startMin <= nowMin && nowMin < b.endMin)
    .sort((a, b) => a.endMin - a.startMin - (b.endMin - b.startMin))
  const block = live[0] ?? null

  const bands = layout.contexts.filter((c) => c.startMin <= nowMin && nowMin < c.endMin)
  const context = bands[0] ?? null

  const upcoming: { startMin: number; title: string; kind: 'block' | 'ping' }[] = [
    ...layout.blocks.filter((b) => b.startMin > nowMin).map((b) => ({ startMin: b.startMin, title: b.title, kind: 'block' as const })),
    ...layout.pings
      .filter((p) => p.startMin > nowMin)
      .map((p) => ({ startMin: p.startMin, title: p.items.map((i) => i.title).join(' · '), kind: 'ping' as const })),
  ].sort((a, b) => a.startMin - b.startMin)

  return { block, context, next: upcoming[0] ?? null }
}

/**
 * Gaps of at least `minGap` minutes between `fromMin` and `toMin` that no block or
 * context covers. The UI draws these as the dashed "6h unplanned" ghost.
 */
export function unplannedGaps(layout: DayLayout, fromMin: number, toMin: number, minGap = 60): { startMin: number; endMin: number }[] {
  const busy = [...layout.blocks, ...layout.contexts]
    .map((e) => ({ startMin: e.startMin, endMin: e.endMin }))
    .sort((a, b) => a.startMin - b.startMin)

  const gaps: { startMin: number; endMin: number }[] = []
  let cursor = fromMin
  for (const b of busy) {
    if (b.startMin > cursor) gaps.push({ startMin: cursor, endMin: Math.min(b.startMin, toMin) })
    cursor = Math.max(cursor, b.endMin)
    if (cursor >= toMin) break
  }
  if (cursor < toMin) gaps.push({ startMin: cursor, endMin: toMin })

  return gaps.filter((g) => g.endMin - g.startMin >= minGap && g.endMin > g.startMin)
}
