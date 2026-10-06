import { describe, expect, it } from 'vitest'
import { statusOf, trendOf, type Status, type TrendWord } from '../src/shared/status'
import type { Point } from '../src/shared/types'

const pt = (over: Partial<Point>): Point => ({
  value_num: null,
  value_text: '',
  qualifier: null,
  ref_low: null,
  ref_high: null,
  ref_text: '',
  ...over,
})

const STATUS: [string, Point, Status][] = [
  ['normal in two-sided range', pt({ value_num: 2.1, ref_low: 0.4, ref_high: 4.0 }), 'normal'],
  ['low below range', pt({ value_num: 18, ref_low: 30, ref_high: 100 }), 'low'],
  ['high above range', pt({ value_num: 162, ref_high: 100 }), 'high'],
  ['borderline near upper edge', pt({ value_num: 5.6, ref_low: 4.0, ref_high: 5.6 }), 'borderline'],
  ['borderline near lower edge', pt({ value_num: 0.5, ref_low: 0.4, ref_high: 4.0 }), 'borderline'],
  ['borderline one-sided upper', pt({ value_num: 95, ref_high: 100 }), 'borderline'],
  ['normal one-sided upper', pt({ value_num: 80, ref_high: 100 }), 'normal'],
  ['borderline one-sided lower', pt({ value_num: 42, ref_low: 40 }), 'borderline'],
  ['censored below stays normal', pt({ value_num: 1.3, qualifier: '<', ref_high: 4.0 }), 'normal'],
  ['censored below above limit is unknown', pt({ value_num: 5, qualifier: '<', ref_high: 4.0 }), 'unknown'],
  ['censored above below limit is unknown', pt({ value_num: 20, qualifier: '>', ref_low: 30 }), 'unknown'],
  ['censored above in range is normal', pt({ value_num: 90, qualifier: '>', ref_low: 60 }), 'normal'],
  ['qualitative match is normal', pt({ value_text: 'Non Reactive', ref_text: 'Non-Reactive' }), 'normal'],
  ['qualitative mismatch is abnormal', pt({ value_text: 'Reactive', ref_text: 'Non Reactive' }), 'abnormal'],
  ['no range is unknown', pt({ value_num: 10 }), 'unknown'],
]

describe('statusOf', () => {
  for (const [name, p, want] of STATUS) {
    it(name, () => expect(statusOf(p)).toBe(want))
  }
})

const TREND: [string, Point | undefined, Point, TrendWord | null][] = [
  ['first reading has no trend', undefined, pt({ value_num: 2, ref_low: 0.4, ref_high: 4 }), null],
  ['rising LDL is worse', pt({ value_num: 140, ref_high: 100 }), pt({ value_num: 162, ref_high: 100 }), 'worse'],
  ['falling LDL is better', pt({ value_num: 162, ref_high: 100 }), pt({ value_num: 120, ref_high: 100 }), 'better'],
  ['small change is steady', pt({ value_num: 2.0, ref_low: 0.4, ref_high: 4 }), pt({ value_num: 2.1, ref_low: 0.4, ref_high: 4 }), 'steady'],
  ['moving toward midpoint is better', pt({ value_num: 3.9, ref_low: 0.4, ref_high: 4 }), pt({ value_num: 2.2, ref_low: 0.4, ref_high: 4 }), 'better'],
  ['censored values do not trend', pt({ value_num: 1.3, qualifier: '<', ref_high: 4 }), pt({ value_num: 1.0, ref_high: 4 }), null],
]

describe('trendOf', () => {
  for (const [name, prev, last, want] of TREND) {
    it(name, () => expect(trendOf(prev, last)).toBe(want))
  }
})
