import { describe, it, expect } from 'vitest'
import { normalizeDay } from '../src/worker/validate'

describe('normalizeDay', () => {
  it('returns [] for non-array input', () => {
    expect(normalizeDay(null)).toEqual([])
    expect(normalizeDay('nope')).toEqual([])
    expect(normalizeDay(42)).toEqual([])
  })
  it('keeps valid blocks and assigns ids 1..n in start order', () => {
    const out = normalizeDay([
      { start: 10, end: 12, labelId: 'gym' },
      { start: 2, end: 3, labelId: 'deep' },
    ])
    expect(out).toEqual([
      { id: 1, start: 2, end: 3, labelId: 'deep', title: '' },
      { id: 2, start: 10, end: 12, labelId: 'gym', title: '' },
    ])
  })
  it('preserves a trimmed custom title (missing/non-string title becomes "")', () => {
    const out = normalizeDay([
      { start: 0, end: 1, labelId: 'deep', title: '  Write report  ' },
      { start: 2, end: 3, labelId: 'gym' },
      { start: 4, end: 5, labelId: 'break', title: 123 },
    ])
    expect(out.map((b) => b.title)).toEqual(['Write report', '', ''])
  })
  it('caps an overlong title at 120 chars', () => {
    const long = 'x'.repeat(200)
    const out = normalizeDay([{ start: 0, end: 1, labelId: 'deep', title: long }])
    expect(out[0].title.length).toBe(120)
  })
  it('drops out-of-range slots', () => {
    expect(normalizeDay([{ start: -1, end: 2, labelId: 'deep' }])).toEqual([])
    expect(normalizeDay([{ start: 0, end: 48, labelId: 'deep' }])).toEqual([]) // end must be < 48
    expect(normalizeDay([{ start: 0, end: 47, labelId: 'deep' }]).length).toBe(1) // last valid slot
  })
  it('drops unknown labels', () => {
    expect(normalizeDay([{ start: 0, end: 1, labelId: 'sleep' }])).toEqual([])
  })
  it('drops end < start', () => {
    expect(normalizeDay([{ start: 5, end: 3, labelId: 'deep' }])).toEqual([])
  })
  it('drops non-integer / wrong-typed fields', () => {
    expect(normalizeDay([{ start: 1.5, end: 3, labelId: 'deep' }])).toEqual([])
    expect(normalizeDay([{ start: '1', end: 3, labelId: 'deep' }])).toEqual([])
  })
  it('drops a block overlapping an earlier accepted one, keeps adjacent', () => {
    const out = normalizeDay([
      { start: 0, end: 3, labelId: 'deep' },
      { start: 2, end: 5, labelId: 'gym' },   // overlaps → dropped
      { start: 4, end: 6, labelId: 'break' }, // adjacent to first (starts at 4 > 3) → kept
    ])
    expect(out.map((b) => [b.start, b.end])).toEqual([[0, 3], [4, 6]])
  })
})
