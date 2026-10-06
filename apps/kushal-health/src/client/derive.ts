// Pure view-model helpers for the Blood tests screens. Status and trend come from shared/status only.
import type { BloodData, MarkerPoint, MarkerSeries, Panel, ReportRow } from '../shared/types'
import { SEVERITY, statusOf, trendOf, type Status } from '../shared/status'

export const latest = (m: MarkerSeries) => m.points[m.points.length - 1]
export const previous = (m: MarkerSeries): MarkerPoint | undefined => m.points[m.points.length - 2]

export type Bucket = 'bad' | 'edge' | 'ok' | 'none'
export function bucket(s: Status): Bucket {
  if (SEVERITY[s] === 0) return 'bad'
  if (s === 'borderline') return 'edge'
  if (s === 'normal') return 'ok'
  return 'none'
}

/** Body parts on the map; each owns one or more panels. x/y are positions on the 358x440 figure. */
export interface Part {
  key: string
  name: string
  panels: Panel[]
  x: number
  y: number
  side: 'L' | 'R'
}
export const PARTS: Part[] = [
  { key: 'hormones', name: 'Hormones', panels: ['Hormones'], x: 179, y: 44, side: 'R' },
  { key: 'thyroid', name: 'Thyroid', panels: ['Thyroid'], x: 179, y: 96, side: 'L' },
  { key: 'heart', name: 'Heart & fats', panels: ['Lipid'], x: 160, y: 148, side: 'L' },
  { key: 'liver', name: 'Liver', panels: ['Liver'], x: 204, y: 188, side: 'R' },
  { key: 'sugar', name: 'Sugar', panels: ['Diabetes'], x: 168, y: 210, side: 'L' },
  { key: 'kidney', name: 'Kidneys', panels: ['Kidney'], x: 196, y: 238, side: 'R' },
  { key: 'blood', name: 'Blood cells', panels: ['CBC'], x: 108, y: 268, side: 'L' },
  { key: 'vitamins', name: 'Vitamins', panels: ['Vitamins'], x: 204, y: 352, side: 'R' },
]

export function partOf(m: MarkerSeries): Part | undefined {
  return PARTS.find((p) => p.panels.includes(m.panel))
}

export interface Counts {
  bad: number
  edge: number
  ok: number
}
/** Counts over markers whose latest reading is from the newest report date. */
export function latestCounts(data: BloodData): Counts {
  const newest = data.reports[0]?.collected_on
  const c: Counts = { bad: 0, edge: 0, ok: 0 }
  for (const m of data.markers) {
    if (latest(m).collected_on !== newest) continue
    const b = bucket(statusOf(latest(m)))
    if (b !== 'none') c[b]++
  }
  return c
}

/** How far a reading sits outside its range, as a share of the range. 0 when inside. */
export function outBy(p: MarkerPoint): number {
  const v = p.value_num
  if (v === null) return 0
  const lo = p.ref_low
  const hi = p.ref_high
  const span = lo !== null && hi !== null ? hi - lo : (hi ?? lo ?? 1) || 1
  if (hi !== null && v > hi) return (v - hi) / span
  if (lo !== null && v < lo) return (lo - v) / span
  return 0
}

/** Up to 3 markers that are out of range now AND moved the wrong way since the previous test. */
export function worries(data: BloodData): MarkerSeries[] {
  return data.markers
    .filter((m) => SEVERITY[statusOf(latest(m))] === 0 && trendOf(previous(m), latest(m)) === 'worse')
    .sort((a, b) => outBy(latest(b)) - outBy(latest(a)) || a.name.localeCompare(b.name))
    .slice(0, 3)
}

export function partStatus(data: BloodData, part: Part): { worst: Bucket; summary: string; count: number } {
  const ms = data.markers.filter((m) => part.panels.includes(m.panel))
  const bs = ms.map((m) => bucket(statusOf(latest(m))))
  const bad = bs.filter((b) => b === 'bad').length
  const edge = bs.filter((b) => b === 'edge').length
  if (ms.length === 0) return { worst: 'none', summary: 'no tests', count: 0 }
  if (bad) return { worst: 'bad', summary: `${bad} of ${ms.length} out`, count: ms.length }
  if (edge) return { worst: 'edge', summary: `${edge} near edge`, count: ms.length }
  return { worst: 'ok', summary: 'all normal', count: ms.length }
}

/** Worst first, then by name; optionally only one body part. */
export function sortedMarkers(data: BloodData, partKey: string | null): MarkerSeries[] {
  const part = PARTS.find((p) => p.key === partKey)
  return data.markers
    .filter((m) => !part || part.panels.includes(m.panel))
    .sort((a, b) => SEVERITY[statusOf(latest(a))] - SEVERITY[statusOf(latest(b))] || a.name.localeCompare(b.name))
}

/** Every distinct test date, newest first. */
export function testDates(data: BloodData): string[] {
  return [...new Set(data.reports.map((r) => r.collected_on))].sort().reverse()
}

export function labsById(reports: ReportRow[]): Record<string, string> {
  return Object.fromEntries(reports.map((r) => [r.id, r.lab]))
}

/** "1.5 · 2.3" style signed delta with sensible precision. */
export function delta(a: number, b: number): string {
  const d = b - a
  const digits = Math.max(decimals(a), decimals(b))
  const s = d.toFixed(digits)
  return d > 0 ? `+${s}` : s
}
function decimals(n: number): number {
  const s = String(n)
  return s.includes('.') ? Math.min(2, s.split('.')[1].length) : 0
}

/** Positions for the low / normal / high range bar, in percent. Null when there is nothing to draw. */
export function rangeBar(p: MarkerPoint): { lowW: number; okW: number; highW: number; pos: number; loPos: number | null; hiPos: number | null } | null {
  const v = p.value_num
  const lo = p.ref_low
  const hi = p.ref_high
  if (v === null || (lo === null && hi === null)) return null
  let a: number
  let b: number
  if (lo !== null && hi !== null) {
    const s = hi - lo
    a = Math.max(0, lo - s * 0.6)
    b = hi + s * 0.6
  } else if (hi !== null) {
    a = 0
    b = hi * 1.6
  } else {
    a = (lo as number) * 0.4
    b = (lo as number) * 2.5
  }
  if (v > b) b = v * 1.08
  if (v < a) a = Math.max(0, v * 0.9)
  const l = lo ?? a
  const h = hi ?? b
  const pct = (x: number) => ((x - a) / (b - a)) * 100
  const lowW = pct(l)
  const okW = pct(h) - pct(l)
  return {
    lowW,
    okW,
    highW: 100 - lowW - okW,
    pos: Math.min(97, Math.max(3, pct(v))),
    loPos: lo !== null ? pct(lo) : null,
    hiPos: hi !== null ? pct(hi) : null,
  }
}
