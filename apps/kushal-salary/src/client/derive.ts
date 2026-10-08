// View logic for the two tabs. Numbers and events come from shared/salary.ts; this only arranges them.
import { bars, events, fixedOf, fySoFar, fyOf, type Mode, type Month, type SalaryEvent } from '../shared/salary'
import type { Note } from '../shared/types'

export function summary(months: Month[], mode: Mode) {
  const b = bars(months, mode)
  const ev = events(months)
  const first = b[0]
  const last = b[b.length - 1]
  const count = (t: SalaryEvent['type']) => ev.filter((e) => e.type === t).length
  return {
    growth: first.base > 0 ? (last.base / first.base).toFixed(1) : '1.0',
    firstMonth: first.month,
    fixedFirst: fixedOf(months[0]),
    fixedLast: fixedOf(months[months.length - 1]),
    promotions: count('promotion'),
    hikes: count('hike'),
    payouts: count('payout'),
    latestBase: last.base,
    fy: fySoFar(months, mode),
    fyLabel: fyOf(last.month),
  }
}

export type TimelineItem = { date: string; key: string } & (
  | { kind: 'event'; event: SalaryEvent }
  | { kind: 'note'; note: Note }
)

// Equal dates: notes first, then promotion, hike, payout, start.
const RANK = { note: 0, promotion: 1, hike: 2, payout: 3, start: 4 } as const

/** Events and notes in one list, newest first. */
export function timeline(months: Month[], notes: Note[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...events(months).map((e, i) => ({ kind: 'event' as const, event: e, date: `${e.month}-01`, key: `e${i}` })),
    ...notes.map((n) => ({ kind: 'note' as const, note: n, date: n.date, key: `n-${n.id}` })),
  ]
  const rank = (t: TimelineItem) => (t.kind === 'note' ? RANK.note : RANK[t.event.type])
  return items.sort((a, b) => (a.date === b.date ? rank(a) - rank(b) : a.date < b.date ? 1 : -1))
}

export type ChartMark = { i: number; type: 'promotion' | 'hike'; text: string }

/** Promotion and hike dots sit on the first month that shows the new fixed pay (a back-dated raise lands where it was paid). */
export function chartMarks(months: Month[]): ChartMark[] {
  const out: ChartMark[] = []
  for (const e of events(months)) {
    if (e.type !== 'promotion' && e.type !== 'hike') continue
    const i = months.findIndex((m) => m.month >= e.month && fixedOf(m) === e.fixedMonthly)
    if (i < 0) continue
    const sign = e.pct > 0 ? '+' : ''
    out.push({ i, type: e.type, text: e.type === 'promotion' ? `${sign}${e.pct}% · ${e.to}` : `${sign}${e.pct}% hike` })
  }
  return out
}
