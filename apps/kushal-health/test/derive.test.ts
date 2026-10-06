import { describe, expect, it } from 'vitest'
import { delta, latestCounts, outBy, rangeBar, testDates, worries } from '../src/client/derive'
import type { MarkerPoint } from '../src/shared/types'
import { fixture } from './fixtures/blood'

const pt = (over: Partial<MarkerPoint>): MarkerPoint => ({
  report_id: 'r',
  collected_on: '2025-01-01',
  unit: '',
  value_num: null,
  value_text: '',
  qualifier: null,
  ref_low: null,
  ref_high: null,
  ref_text: '',
  ...over,
})

describe('derive', () => {
  it('counts only markers read on the newest date', () => {
    expect(latestCounts(fixture)).toEqual({ bad: 2, edge: 1, ok: 3 })
  })

  it('ranks worries by how far out of range they are', () => {
    const data = structuredClone(fixture)
    const tsh = data.markers.find((m) => m.key === 'tsh')!
    tsh.points[0] = { ...tsh.points[0], value_num: 5, value_text: '5' }
    tsh.points[1] = { ...tsh.points[1], value_num: 9, value_text: '9' }
    expect(worries(data).map((m) => m.key)).toEqual(['tsh', 'ldl'])
  })

  it('measures distance outside the range as a share of the range', () => {
    expect(outBy(pt({ value_num: 9, ref_low: 1, ref_high: 5 }))).toBe(1)
    expect(outBy(pt({ value_num: 150, ref_high: 100 }))).toBe(0.5)
    expect(outBy(pt({ value_num: 3, ref_low: 1, ref_high: 5 }))).toBe(0)
  })

  it('lists distinct test dates newest first', () => {
    expect(testDates(fixture)).toEqual(['2025-01-15', '2024-06-10'])
  })

  it('formats signed deltas at the inputs precision', () => {
    expect(delta(140, 162)).toBe('+22')
    expect(delta(3.2, 2.1)).toBe('-1.1')
    expect(delta(6.737, 11.9)).toBe('+5.16')
  })

  it('keeps an extreme value inside the range bar', () => {
    const b = rangeBar(pt({ value_num: 50, ref_low: 1, ref_high: 5 }))!
    expect(b.pos).toBeLessThanOrEqual(97)
    expect(b.lowW + b.okW + b.highW).toBeCloseTo(100)
    expect(rangeBar(pt({ value_text: 'Negative' }))).toBeNull()
  })
})
