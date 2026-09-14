import { describe, expect, it } from 'vitest'
import {
  buildLayout,
  currentAt,
  overlaps,
  unplannedGaps,
  BAND_MAX_CLASH_RATIO,
  CONTEXT_MIN_MIN,
  PING_MAX_MIN,
  type DayEvent,
} from '../src/worker/layout'

/** Minutes from midnight, so the fixtures read like a clock. */
const at = (h: number, m = 0): number => h * 60 + m

function ev(id: string, startMin: number, endMin: number, over: Partial<DayEvent> = {}): DayEvent {
  return {
    id,
    title: id,
    description: '',
    calendar: 'Personal',
    calendarId: 'cal-1',
    category: 'other',
    color: '#8a91a1',
    startMin,
    endMin,
    clippedStart: false,
    clippedEnd: false,
    htmlLink: `https://calendar.google.com/${id}`,
    ...over,
  }
}

/**
 * The owner's real Monday (14 Sep 2026) — the screenshot that started this app.
 * Every rule in layout.ts exists because of one of these rows.
 */
const MONDAY: DayEvent[] = [
  ev('postwakeup', at(5), at(6, 30), { title: 'Post wakeup / Pre Gym Routine', calendar: 'Daily chores' }),
  ev('gym', at(6, 30), at(8, 30), { title: 'Gym', calendar: 'Health', description: 'Push day' }),
  ev('random', at(9), at(13, 30), { title: 'Random', calendar: 'Buffer' }),
  ev('commute', at(10, 30), at(11), { title: 'Commute office', calendar: 'Daily chores' }),
  ev('zluri', at(11), at(16), { title: 'Zluri Work', calendar: 'Business', description: 'Standup 11:15' }),
  ev('sleep', at(22), at(24), { title: 'Sleep', calendar: 'Health', clippedEnd: true }),
  ev('water1', at(5), at(5, 5), { title: 'Water - 500 mL', calendar: 'Diet' }),
  ev('postgym', at(8, 30), at(8, 35), { title: 'Post Gym Routine', calendar: 'Daily chores' }),
  ev('amla', at(8, 30), at(8, 35), { title: 'Water + Amla Juice - 500 mL', calendar: 'Diet' }),
  ev('water2', at(10, 45), at(10, 50), { title: 'Water - 500 mL', calendar: 'Diet' }),
  ev('lunch', at(13), at(13, 5), { title: 'Lunch', calendar: 'Diet' }),
]

const monday = () => buildLayout('2026-09-14', 'Asia/Kolkata', MONDAY, [
  { id: 'holiday', title: 'Ganesh Chaturthi', calendar: 'Holidays in India', color: '#c78b3f', category: 'holiday' },
])

describe('overlaps', () => {
  it('treats touching events as NOT overlapping', () => {
    // Commute ends exactly when Zluri Work starts. Counting that as an overlap is
    // what makes Google Calendar split them into two half-width columns.
    expect(overlaps({ startMin: at(10, 30), endMin: at(11) }, { startMin: at(11), endMin: at(16) })).toBe(false)
  })

  it('detects a genuine overlap in both directions', () => {
    const a = { startMin: at(9), endMin: at(13, 30) }
    const b = { startMin: at(11), endMin: at(16) }
    expect(overlaps(a, b)).toBe(true)
    expect(overlaps(b, a)).toBe(true)
  })
})

describe('buildLayout — the owner’s Monday', () => {
  it('turns every short event into a ping, never a block', () => {
    const { pings, blocks, contexts } = monday()
    const pingIds = pings.flatMap((p) => p.items.map((i) => i.id)).sort()
    expect(pingIds).toEqual(['amla', 'lunch', 'postgym', 'water1', 'water2'])

    const drawnAsBars = [...blocks, ...contexts].map((e) => e.id)
    for (const id of pingIds) expect(drawnAsBars).not.toContain(id)
  })

  it('merges pings that fire at the same minute into one tick', () => {
    const { pings } = monday()
    const at830 = pings.find((p) => p.startMin === at(8, 30))
    expect(at830?.items.map((i) => i.title)).toEqual(['Post Gym Routine', 'Water + Amla Juice - 500 mL'])
    expect(pings.filter((p) => p.startMin === at(8, 30))).toHaveLength(1)
  })

  it('promotes Random to a context band and nothing else', () => {
    const { contexts } = monday()
    expect(contexts.map((c) => c.id)).toEqual(['random'])
  })

  it('indents the blocks that sit inside Random, and names what they are inside', () => {
    const { blocks } = monday()
    const byId = Object.fromEntries(blocks.map((b) => [b.id, b]))

    expect(byId.zluri.depth).toBe(1)
    expect(byId.zluri.insideTitle).toBe('Random')
    expect(byId.commute.depth).toBe(1)

    // Morning routine and Gym overlap nothing, so they stay full width.
    expect(byId.gym.depth).toBe(0)
    expect(byId.gym.insideId).toBeNull()
    expect(byId.postwakeup.depth).toBe(0)
  })

  it('does not promote Zluri Work, which is long but only overlaps one thing', () => {
    const { blocks, contexts } = monday()
    expect(contexts.map((c) => c.id)).not.toContain('zluri')
    expect(blocks.map((b) => b.id)).toContain('zluri')
  })

  it('keeps all-day events out of the grid entirely', () => {
    const layout = monday()
    expect(layout.allDay.map((a) => a.title)).toEqual(['Ganesh Chaturthi'])
    expect([...layout.blocks, ...layout.contexts].map((e) => e.id)).not.toContain('holiday')
  })
})

describe('buildLayout — rules that guard against bad promotions', () => {
  it('never lets a pile of pings promote a block to a context band', () => {
    // Six water reminders inside Gym must not make Gym a faded background band.
    const pings = [0, 10, 20, 30, 40, 50].map((m) => ev(`ping${m}`, at(6, 30) + m, at(6, 30) + m + 5))
    const { contexts, blocks } = buildLayout('2026-09-14', 'Asia/Kolkata', [ev('gym', at(6, 30), at(8, 30)), ...pings])
    expect(contexts).toEqual([])
    expect(blocks.map((b) => b.id)).toEqual(['gym'])
  })

  it('keeps a long-but-lonely event as a block', () => {
    const { contexts } = buildLayout('2026-09-14', 'Asia/Kolkata', [ev('sleep', at(22), at(24))])
    expect(contexts).toEqual([])
  })

  it('lets two bands coexist when they only clash at the edges', () => {
    // The real regression: "Random" 9:00-1:30 is the morning's backdrop, and it shared
    // only 30 minutes with the afternoon's "Zluri Work (Active)" 1:00-6:30. Demoting it
    // over 11% of its length cost the whole morning its context.
    const random = ev('random', at(9), at(13, 30))
    const zluriActive = ev('zluriActive', at(13), at(18, 30))
    const crowdMorning = [ev('m1', at(10, 30), at(11)), ev('m2', at(11), at(16))]
    const crowdAfternoon = [ev('a1', at(14), at(15)), ev('a2', at(15, 30), at(17))]
    const { contexts } = buildLayout('2026-09-14', 'Asia/Kolkata', [
      random, zluriActive, ...crowdMorning, ...crowdAfternoon,
    ])
    expect(contexts.map((c) => c.id).sort()).toEqual(['random', 'zluriActive'])
  })

  it('still demotes a band that a longer one largely swallows', () => {
    const outer = ev('outer', at(9), at(17))
    const inner = ev('inner', at(10), at(16))
    const fill = [ev('f1', at(11), at(12)), ev('f2', at(13), at(14))]
    const { contexts } = buildLayout('2026-09-14', 'Asia/Kolkata', [outer, inner, ...fill])
    expect(contexts.map((c) => c.id)).toEqual(['outer'])
  })

  it('draws the clash line exactly at BAND_MAX_CLASH_RATIO of the shorter band', () => {
    expect(BAND_MAX_CLASH_RATIO).toBe(0.5)
    // Shorter band is 4h. A 3h clash (75%) demotes it; a 1h clash (25%) does not.
    const long = ev('long', at(6), at(16))
    const crowd = [ev('c1', at(7), at(8)), ev('c2', at(9), at(10))]
    const heavy = ev('heavy', at(13), at(17))
    const heavyCrowd = [ev('h1', at(14), at(15)), ev('h2', at(15, 30), at(16, 30))]
    expect(
      buildLayout('2026-09-14', 'Asia/Kolkata', [long, heavy, ...crowd, ...heavyCrowd])
        .contexts.map((c) => c.id),
    ).toEqual(['long'])

    const light = ev('light', at(15), at(19))
    const lightCrowd = [ev('l1', at(17), at(18)), ev('l2', at(18), at(18, 30))]
    expect(
      buildLayout('2026-09-14', 'Asia/Kolkata', [long, light, ...crowd, ...lightCrowd])
        .contexts.map((c) => c.id).sort(),
    ).toEqual(['light', 'long'])
  })

  it('refuses to paint two context bands over each other — longest wins', () => {
    // Two wide events both qualify; the shorter falls back to an ordinary block.
    const wide = ev('wide', at(9), at(17))
    const narrower = ev('narrower', at(10), at(16))
    const a = ev('a', at(11), at(12))
    const b = ev('b', at(13), at(14))
    const { contexts, blocks } = buildLayout('2026-09-14', 'Asia/Kolkata', [wide, narrower, a, b])
    expect(contexts.map((c) => c.id)).toEqual(['wide'])
    expect(blocks.map((x) => x.id).sort()).toEqual(['a', 'b', 'narrower'])
  })

  it('honours the documented thresholds exactly', () => {
    const justAPing = ev('p', at(9), at(9) + PING_MAX_MIN)
    const justABlock = ev('b', at(9), at(9) + PING_MAX_MIN + 1)
    const layout = buildLayout('2026-09-14', 'Asia/Kolkata', [justAPing, justABlock])
    expect(layout.pings.flatMap((p) => p.items.map((i) => i.id))).toEqual(['p'])
    expect(layout.blocks.map((x) => x.id)).toEqual(['b'])

    // One minute under the context floor, with plenty of overlaps, is still a block.
    const shortWide = ev('shortwide', at(9), at(9) + CONTEXT_MIN_MIN - 1)
    const c1 = ev('c1', at(9, 10), at(9, 40))
    const c2 = ev('c2', at(9, 50), at(10, 20))
    expect(buildLayout('2026-09-14', 'Asia/Kolkata', [shortWide, c1, c2]).contexts).toEqual([])
  })

  it('is stable regardless of input order', () => {
    const forwards = buildLayout('2026-09-14', 'Asia/Kolkata', MONDAY)
    const backwards = buildLayout('2026-09-14', 'Asia/Kolkata', [...MONDAY].reverse())
    expect(backwards.contexts.map((c) => c.id)).toEqual(forwards.contexts.map((c) => c.id))
    expect(backwards.blocks.map((b) => `${b.id}:${b.depth}`)).toEqual(forwards.blocks.map((b) => `${b.id}:${b.depth}`))
    expect(backwards.pings.map((p) => p.id)).toEqual(forwards.pings.map((p) => p.id))
  })
})

describe('currentAt', () => {
  it('picks the innermost block and names the context around it', () => {
    const now = currentAt(monday(), at(11, 42))
    expect(now.block?.id).toBe('zluri')
    expect(now.context?.id).toBe('random')
    expect(now.next).toEqual({ startMin: at(13), title: 'Lunch', kind: 'ping' })
  })

  it('returns nothing live in a gap, but still finds what is next', () => {
    const now = currentAt(monday(), at(17))
    expect(now.block).toBeNull()
    expect(now.context).toBeNull()
    expect(now.next?.title).toBe('Sleep')
  })

  it('treats a block as over the moment it ends', () => {
    expect(currentAt(monday(), at(16)).block).toBeNull()
    expect(currentAt(monday(), at(15, 59)).block?.id).toBe('zluri')
  })
})

describe('unplannedGaps', () => {
  it('finds the six-hour evening hole between Zluri Work and Sleep', () => {
    expect(unplannedGaps(monday(), at(5), at(22))).toEqual([{ startMin: at(16), endMin: at(22) }])
  })

  it('ignores holes shorter than the minimum', () => {
    expect(unplannedGaps(monday(), at(5), at(22), 7 * 60)).toEqual([])
  })
})
