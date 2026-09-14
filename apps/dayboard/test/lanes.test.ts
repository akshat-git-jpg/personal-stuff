import { beforeAll, describe, expect, it } from 'vitest'
import '../public/lanes.js'

type Item = { id: string; startMin: number; endMin: number }
type Placed = Item & { lane: number; lanes: number }

let assignLanes: (b: Item[]) => Placed[]

beforeAll(() => {
  // lanes.js is a plain browser script that hands itself to globalThis — the app has
  // no build step, so the page and this test load the exact same file.
  assignLanes = (globalThis as unknown as { assignLanes: (b: Item[]) => Placed[] }).assignLanes
})

const at = (h: number, m = 0): number => h * 60 + m
const ev = (id: string, s: number, e: number): Item => ({ id, startMin: s, endMin: e })

/** lane/lanes keyed by id, for terse assertions. */
const placed = (items: Item[]): Record<string, string> =>
  Object.fromEntries(assignLanes(items).map((b) => [b.id, `${b.lane}/${b.lanes}`]))

describe('assignLanes', () => {
  it('gives a lonely block the whole width', () => {
    expect(placed([ev('a', at(9), at(10))])).toEqual({ a: '0/1' })
  })

  it('keeps back-to-back blocks full width — touching is not overlapping', () => {
    // Commute 10:30-11:00 then Zluri 11:00-16:00. Splitting these into two columns
    // is exactly the Google Calendar behaviour this app exists to avoid.
    expect(placed([ev('commute', at(10, 30), at(11)), ev('zluri', at(11), at(16))]))
      .toEqual({ commute: '0/1', zluri: '0/1' })
  })

  it('splits two genuinely overlapping blocks into two columns', () => {
    expect(placed([ev('a', at(9), at(11)), ev('b', at(10), at(12))]))
      .toEqual({ a: '0/2', b: '1/2' })
  })

  it('does not let one busy hour shrink the rest of the day', () => {
    const out = placed([
      ev('a', at(9), at(11)),
      ev('b', at(10), at(12)),
      ev('later', at(14), at(15)),
    ])
    expect(out.a).toBe('0/2')
    expect(out.b).toBe('1/2')
    expect(out.later).toBe('0/1')
  })

  it('reuses a freed column instead of growing forever', () => {
    // c starts after a has finished, so it belongs in a's column, not a third one.
    const out = placed([
      ev('a', at(9), at(10)),
      ev('b', at(9, 30), at(13)),
      ev('c', at(10, 30), at(11, 30)),
    ])
    expect(out.b).toBe('1/2')
    expect(out.a).toBe('0/2')
    expect(out.c).toBe('0/2')
  })

  it('chains transitively: a-b overlap and b-c overlap puts all three in one group', () => {
    const out = placed([
      ev('a', at(9), at(11)),
      ev('b', at(10), at(13)),
      ev('c', at(12), at(14)),
    ])
    expect(new Set(Object.values(out))).toEqual(new Set(['0/2', '1/2']))
    expect(out.a).toBe('0/2')
    expect(out.b).toBe('1/2')
    expect(out.c).toBe('0/2')
  })

  it('handles the owner’s real Monday collisions without any block covering another', () => {
    const monday = [
      ev('gym-personal', at(6, 30), at(8, 30)),
      ev('wakeup-chores', at(7), at(8, 30)),
      ev('postgym-personal', at(8, 30), at(9)),
      ev('gym-health', at(8, 30), at(10, 30)),
      ev('random', at(9), at(13, 30)),
      ev('commute', at(10, 30), at(11)),
      ev('postgym-chores', at(10, 30), at(11, 30)),
      ev('lunch-chores', at(11), at(11, 30)),
      ev('zluri', at(11), at(16)),
      ev('lunch-personal', at(13), at(13, 30)),
    ]
    const out = assignLanes(monday)

    // Nothing shares a column with something it overlaps — the whole point.
    for (const a of out) {
      for (const b of out) {
        if (a.id === b.id) continue
        const clash = a.startMin < b.endMin && b.startMin < a.endMin
        if (clash) expect(a.lane).not.toBe(b.lane)
      }
    }
    // And the day never needs more columns than the worst moment actually has.
    expect(Math.max(...out.map((b) => b.lanes))).toBeLessThanOrEqual(4)
  })

  it('is stable regardless of input order', () => {
    const items = [ev('a', at(9), at(11)), ev('b', at(10), at(12)), ev('c', at(14), at(15))]
    expect(placed(items)).toEqual(placed([...items].reverse()))
  })

  it('returns copies, leaving the caller’s objects untouched', () => {
    const items = [ev('a', at(9), at(10))]
    assignLanes(items)
    expect('lane' in items[0]).toBe(false)
  })

  it('survives an empty day', () => {
    expect(assignLanes([])).toEqual([])
  })
})
