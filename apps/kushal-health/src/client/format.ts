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
  high: '#b42318',
  low: '#b42318',
  abnormal: '#b42318',
  borderline: '#b54708',
  normal: '#067647',
  unknown: '#475467',
}
