import { describe, it, expect } from 'vitest'
import {
  addDaysYmd, bestStreak, currentStreak, daysBetweenYmd, isHabitCadence,
  isoWeek, periodKey, periodStart, periodStep,
} from '../src/habits'
import { resolveEta } from '../src/worker/recurring'
import type { Template } from '../src/shared'

const tpl = (over: Partial<Template>): Template => ({
  id: 1, title: 'h', owner: 'khushi', notes: null, cadence: 'daily',
  dueDay: 1, active: true, createdAt: '2026-01-01T00:00:00.000Z', ...over,
})

describe('day arithmetic', () => {
  it('steps forward and backward across a month boundary', () => {
    expect(addDaysYmd('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDaysYmd('2026-09-01', -1)).toBe('2026-08-31')
  })

  it('steps across a year boundary', () => {
    expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('measures signed distance between days', () => {
    expect(daysBetweenYmd('2026-08-23', '2026-08-25')).toBe(2)
    expect(daysBetweenYmd('2026-08-23', '2026-08-20')).toBe(-3)
    expect(daysBetweenYmd('2026-08-23', '2026-08-23')).toBe(0)
  })
})

describe('period keys', () => {
  it('keys a daily period by the day itself', () => {
    expect(periodKey('daily', '2026-08-23')).toBe('2026-08-23')
  })

  it('keys a monthly period by the month', () => {
    expect(periodKey('monthly', '2026-08-23')).toBe('2026-08')
  })

  it('keys a weekly period by the ISO week', () => {
    // 2026-08-23 is a Sunday; its ISO week is 2026-W34.
    expect(periodKey('weekly', '2026-08-23')).toBe('2026-W34')
    expect(periodKey('weekly', '2026-08-24')).toBe('2026-W35')
  })

  it('computes ISO weeks at a year boundary', () => {
    expect(isoWeek('2027-01-01').week).toBe(53)
  })
})

describe('period anchors', () => {
  it('anchors a daily period to the day', () => {
    expect(periodStart('daily', '2026-08-23')).toBe('2026-08-23')
  })

  it('anchors a weekly period to that ISO week Monday', () => {
    expect(periodStart('weekly', '2026-08-23')).toBe('2026-08-17') // Sunday -> prior Monday
    expect(periodStart('weekly', '2026-08-24')).toBe('2026-08-24') // Monday -> itself
  })

  it('steps 1 day for daily and 7 for weekly', () => {
    expect(periodStep('daily')).toBe(1)
    expect(periodStep('weekly')).toBe(7)
  })

  it('classifies which cadences are habits', () => {
    expect(isHabitCadence('daily')).toBe(true)
    expect(isHabitCadence('weekly')).toBe(true)
    expect(isHabitCadence('monthly')).toBe(false)
  })
})

describe('currentStreak', () => {
  it('is 0 with no history', () => {
    expect(currentStreak('daily', new Set(), '2026-08-23')).toBe(0)
  })

  it('counts today plus the unbroken run behind it', () => {
    const kept = new Set(['2026-08-21', '2026-08-22', '2026-08-23'])
    expect(currentStreak('daily', kept, '2026-08-23')).toBe(3)
  })

  it('survives an unticked today (grace: the day is not over)', () => {
    const kept = new Set(['2026-08-21', '2026-08-22'])
    expect(currentStreak('daily', kept, '2026-08-23')).toBe(2)
  })

  it('breaks when yesterday and today are both missing', () => {
    const kept = new Set(['2026-08-20', '2026-08-21'])
    expect(currentStreak('daily', kept, '2026-08-23')).toBe(0)
  })

  it('ignores an older run separated by a gap', () => {
    const kept = new Set(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-23'])
    expect(currentStreak('daily', kept, '2026-08-23')).toBe(1)
  })

  it('counts weekly streaks in 7-day steps', () => {
    const kept = new Set(['2026-08-10', '2026-08-17'])
    expect(currentStreak('weekly', kept, '2026-08-23')).toBe(2)
  })
})

describe('bestStreak', () => {
  it('is 0 with no history', () => {
    expect(bestStreak('daily', new Set())).toBe(0)
  })

  it('finds the longest run, not the latest one', () => {
    const kept = new Set([
      '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04',
      '2026-08-22', '2026-08-23',
    ])
    expect(bestStreak('daily', kept)).toBe(4)
  })

  it('handles a single kept period', () => {
    expect(bestStreak('daily', new Set(['2026-08-23']))).toBe(1)
  })

  it('spans a month boundary', () => {
    const kept = new Set(['2026-07-30', '2026-07-31', '2026-08-01'])
    expect(bestStreak('daily', kept)).toBe(3)
  })
})

describe('the generator only serves monthly templates', () => {
  // HABIT_NEVER_GENERATES_TASKS — a habit cadence must produce zero task rows.
  // Fake D1: records every INSERT it is asked to run.
  function fakeDb(templates: Template[]) {
    const inserts: string[] = []
    const db = {
      prepare(sql: string) {
        const stmt = {
          _sql: sql,
          _args: [] as unknown[],
          bind(...args: unknown[]) { stmt._args = args; return stmt },
          async first() {
            if (sql.includes('FROM recurring_templates')) return null
            return null // no existing instance for any period
          },
          async all() {
            if (sql.includes('FROM recurring_templates')) {
              return {
                results: templates.map((t) => ({
                  id: t.id, title: t.title, owner: t.owner, notes: t.notes,
                  cadence: t.cadence, due_day: t.dueDay, active: t.active ? 1 : 0,
                  created_at: t.createdAt,
                })),
              }
            }
            return { results: [] }
          },
          async run() {
            if (sql.trim().toUpperCase().startsWith('INSERT')) inserts.push(String(stmt._args[0]))
            return { meta: { last_row_id: 1 } }
          },
        }
        return stmt
      },
    }
    return { db, inserts }
  }

  it('inserts nothing for a daily template', async () => {
    const { runGenerator } = await import('../src/worker/recurring')
    const { db, inserts } = fakeDb([tpl({ id: 2, cadence: 'daily', title: 'Knowledge gain' })])
    const n = await runGenerator(db as never)
    expect(inserts, 'HABIT_NEVER_GENERATES_TASKS: a daily habit must not mint a task').toEqual([])
    expect(n).toBe(0)
  })

  it('inserts nothing for a weekly template', async () => {
    const { runGenerator } = await import('../src/worker/recurring')
    const { db, inserts } = fakeDb([tpl({ id: 4, cadence: 'weekly', dueDay: 4, title: 'Weekly review' })])
    const n = await runGenerator(db as never)
    expect(inserts, 'HABIT_NEVER_GENERATES_TASKS: a weekly habit must not mint a task').toEqual([])
    expect(n).toBe(0)
  })

  it('still inserts exactly one task for a monthly template', async () => {
    const { runGenerator } = await import('../src/worker/recurring')
    const { db, inserts } = fakeDb([tpl({ id: 1, cadence: 'monthly', dueDay: 1, title: 'Revenue sheet' })])
    const n = await runGenerator(db as never)
    expect(inserts).toEqual(['Revenue sheet'])
    expect(n).toBe(1)
  })

  it('resolves a monthly eta clamped to the month length', () => {
    expect(resolveEta(tpl({ cadence: 'monthly', dueDay: 31 }), '2026-02-10')).toBe('2026-02-28')
    expect(resolveEta(tpl({ cadence: 'monthly', dueDay: 1 }), '2026-08-23')).toBe('2026-08-01')
  })
})
