import type { Point } from './types'

export type Status = 'low' | 'high' | 'abnormal' | 'borderline' | 'normal' | 'unknown'
export type TrendWord = 'better' | 'worse' | 'steady'

/** Share of the reference range treated as "near the edge". */
export const BORDER_FRACTION = 0.1;
/** A change smaller than this share of the range (or of the old value) is "steady". */
export const STEADY_FRACTION = 0.05

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function statusOf(p: Point): Status {
  if (p.value_num === null) {
    if (!p.ref_text.trim()) return 'unknown'
    return norm(p.value_text) === norm(p.ref_text) ? 'normal' : 'abnormal'
  }
  const v = p.value_num
  const lo = p.ref_low
  const hi = p.ref_high
  if (lo === null && hi === null) return 'unknown'
  const atMost = p.qualifier === '<' || p.qualifier === '<=' // "<1.3": real value is at most 1.3
  const atLeast = p.qualifier === '>' || p.qualifier === '>=' // ">90": real value is at least 90

  if (lo !== null && v < lo) return atLeast ? 'unknown' : 'low'
  if (hi !== null && v > hi) return atMost ? 'unknown' : 'high'

  if (lo !== null && hi !== null) {
    const band = (hi - lo) * BORDER_FRACTION
    if (!atLeast && v <= lo + band) return 'borderline'
    if (!atMost && v >= hi - band) return 'borderline'
    return 'normal'
  }
  if (hi !== null) return !atMost && v >= hi * (1 - BORDER_FRACTION) ? 'borderline' : 'normal'
  return !atLeast && v <= (lo as number) * (1 + BORDER_FRACTION) ? 'borderline' : 'normal'
}

/** Distance from the healthy target: range midpoint, or "lower/higher is better" for one-sided ranges. */
function badness(p: Point): number | null {
  if (p.value_num === null) return null
  const { ref_low: lo, ref_high: hi, value_num: v } = p
  if (lo !== null && hi !== null) return Math.abs(v - (lo + hi) / 2)
  if (hi !== null) return v
  if (lo !== null) return -v
  return null
}

export function trendOf(prev: Point | undefined, last: Point): TrendWord | null {
  if (!prev || prev.value_num === null || last.value_num === null) return null
  if (prev.qualifier || last.qualifier) return null // censored values do not trend
  const scale =
    last.ref_low !== null && last.ref_high !== null ? last.ref_high - last.ref_low : Math.abs(prev.value_num) || 1
  if (Math.abs(last.value_num - prev.value_num) < scale * STEADY_FRACTION) return 'steady'
  const a = badness(prev)
  const b = badness(last)
  if (a === null || b === null) return null
  return b < a ? 'better' : 'worse'
}

export const SEVERITY: Record<Status, number> = { high: 0, low: 0, abnormal: 0, borderline: 1, normal: 2, unknown: 3 }
export const needsAttention = (s: Status) => SEVERITY[s] <= 1
