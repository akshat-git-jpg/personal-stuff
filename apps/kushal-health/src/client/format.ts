import type { Status } from '../shared/status'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2025-01-15" -> "15 Jan 2025" */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/** "2025-01-15" -> "Jan 25" */
export function fmtShort(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`
}

export const STATUS_LABEL: Record<Status, string> = {
  high: 'High',
  low: 'Low',
  abnormal: 'Abnormal',
  borderline: 'Near edge',
  normal: 'Normal',
  unknown: 'No range',
}

export const STATUS_CLASS: Record<Status, string> = {
  high: 'chip-bad',
  low: 'chip-bad',
  abnormal: 'chip-bad',
  borderline: 'chip-warn',
  normal: 'chip-ok',
  unknown: 'chip-none',
}

export const STATUS_COLOR: Record<Status, string> = {
  high: '#F87171',
  low: '#F87171',
  abnormal: '#F87171',
  borderline: '#FBBF24',
  normal: '#34D399',
  unknown: '#8B95A5',
}

export const BUCKET_COLOR = { bad: '#F87171', edge: '#FBBF24', ok: '#34D399', none: '#8B95A5' } as const

/** "Jun 24 – Jan 25" span of a list of ISO dates (oldest first). */
export function fmtSpan(dates: string[]): string {
  if (dates.length === 0) return ''
  if (dates.length === 1) return fmtShort(dates[0])
  return `${fmtShort(dates[0])} – ${fmtShort(dates[dates.length - 1])}`
}
