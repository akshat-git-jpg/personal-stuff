import { describe, it, expect } from 'vitest'
import {
  BUCKET_LABEL, BUCKET_ORDER, BUCKET_TONE, bucketOf, flattenOrder, groupOpen, metaLabel,
} from '../src/client/grouping'
import type { Task } from '../src/shared'

const TODAY = '2026-08-23'

const task = (over: Partial<Task>): Task => ({
  id: 1, title: 't', owner: 'khushi', eta: null, notes: null, status: 'open',
  sortOrder: 0, templateId: null, periodKey: null,
  createdAt: '2026-08-01T00:00:00.000Z', completedAt: null, ...over,
})

describe('bucketOf', () => {
  it('puts a past date in overdue', () => {
    expect(bucketOf('2026-07-14', TODAY)).toBe('overdue')
    expect(bucketOf('2026-08-22', TODAY)).toBe('overdue')
  })

  it('puts today in today', () => {
    expect(bucketOf(TODAY, TODAY)).toBe('today')
  })

  it('puts 1..7 days out in this week', () => {
    // BUCKET_WEEK_IS_SEVEN_DAYS — the boundary is inclusive at 7. Both assertions
    // carry the marker on purpose: vitest aborts a test at its FIRST failure, so a
    // marker only on the second one would never reach the mutation gate's output.
    expect(bucketOf('2026-08-24', TODAY), 'BUCKET_WEEK_IS_SEVEN_DAYS: day 1 is This week').toBe('week')
    expect(bucketOf('2026-08-30', TODAY), 'BUCKET_WEEK_IS_SEVEN_DAYS: day 7 is still This week').toBe('week')
  })

  it('puts day 8 and beyond in later', () => {
    expect(bucketOf('2026-08-31', TODAY), 'BUCKET_WEEK_IS_SEVEN_DAYS: day 8 has left This week').toBe('later')
    expect(bucketOf('2026-12-01', TODAY)).toBe('later')
  })

  it('puts a null eta in undated', () => {
    expect(bucketOf(null, TODAY)).toBe('undated')
  })
})

describe('metaLabel', () => {
  it('counts lateness for an overdue task', () => {
    expect(metaLabel('2026-07-14', TODAY)).toBe('14 Jul · 40d late')
  })

  it('says today for a task due today', () => {
    expect(metaLabel(TODAY, TODAY)).toBe('today')
  })

  it('states the bare date for a future task', () => {
    expect(metaLabel('2026-08-30', TODAY)).toBe('30 Aug')
  })

  it('says no date when there is none', () => {
    expect(metaLabel(null, TODAY)).toBe('no date')
  })
})

describe('tone', () => {
  it('colours only overdue and today', () => {
    expect(BUCKET_TONE.overdue).toBe('over')
    expect(BUCKET_TONE.today).toBe('soon')
    expect(BUCKET_TONE.week).toBe('calm')
    expect(BUCKET_TONE.later).toBe('calm')
    expect(BUCKET_TONE.undated).toBe('calm')
  })

  it('orders and labels the groups', () => {
    expect([...BUCKET_ORDER]).toEqual(['overdue', 'today', 'week', 'later', 'undated'])
    expect(BUCKET_LABEL.week).toBe('This week')
  })
})

describe('groupOpen', () => {
  it('drops empty groups and keeps BUCKET_ORDER', () => {
    const groups = groupOpen([
      task({ id: 1, eta: '2026-12-01' }),
      task({ id: 2, eta: '2026-07-14' }),
    ], TODAY)
    expect(groups.map((g) => g.bucket)).toEqual(['overdue', 'later'])
    expect(groups[0].tasks.map((t) => t.id)).toEqual([2])
  })

  it('ignores done tasks', () => {
    const groups = groupOpen([
      task({ id: 1, eta: '2026-07-14', status: 'done' }),
      task({ id: 2, eta: '2026-07-14' }),
    ], TODAY)
    expect(groups).toHaveLength(1)
    expect(groups[0].tasks.map((t) => t.id)).toEqual([2])
  })

  it('sorts inside a group by sortOrder then id', () => {
    const groups = groupOpen([
      task({ id: 7, eta: '2026-07-14', sortOrder: 5 }),
      task({ id: 3, eta: '2026-07-15', sortOrder: 5 }),
      task({ id: 9, eta: '2026-07-16', sortOrder: 1 }),
    ], TODAY)
    expect(groups[0].tasks.map((t) => t.id)).toEqual([9, 3, 7])
  })

  it('returns nothing for an empty list', () => {
    expect(groupOpen([], TODAY)).toEqual([])
  })
})

describe('flattenOrder', () => {
  it('flattens every group in order into one id list', () => {
    const groups = groupOpen([
      task({ id: 1, eta: '2026-07-14' }),
      task({ id: 2, eta: TODAY }),
      task({ id: 3, eta: null }),
    ], TODAY)
    expect(flattenOrder(groups)).toEqual([1, 2, 3])
  })
})
