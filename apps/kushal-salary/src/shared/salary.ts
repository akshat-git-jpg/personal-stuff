// The one place that turns payslip rows into chart numbers and events. The UI never re-derives these.

export type Category = 'fixed' | 'variable'
export type Item = { label: string; category: Category; monthly: number; arrears: number; total: number }
export type Month = {
  month: string // YYYY-MM
  designation: string
  gross: number
  net: number
  deductions: number
  items: Item[]
  has_pdf: boolean
}
export type Mode = 'net' | 'gross'

/** A fixed-pay change smaller than this is not an event (e.g. employer PF moving 1,800 -> 3,000). */
export const HIKE_MIN_FRACTION = 0.05

export const fixedOf = (m: Month): number =>
  m.items.filter((i) => i.category === 'fixed').reduce((a, i) => a + i.monthly, 0)
export const variableOf = (m: Month): number =>
  m.items.filter((i) => i.category === 'variable').reduce((a, i) => a + i.total, 0)
export const arrearsOf = (m: Month): number => m.items.reduce((a, i) => a + i.arrears, 0)
/** Gross one-time money this month: variable items plus back-pay. */
export const payoutGrossOf = (m: Month): number => variableOf(m) + arrearsOf(m)

/**
 * Normal take-home for month i. A month with no payout is its own normal. A payout month borrows
 * the net of the nearest payout-free month on the same fixed pay (earlier first, then later);
 * with none, it scales net by the fixed share of gross.
 */
export function netBase(months: Month[], i: number): number {
  const m = months[i]
  if (payoutGrossOf(m) === 0) return m.net
  const f = fixedOf(m)
  const ok = (j: number) => payoutGrossOf(months[j]) === 0 && fixedOf(months[j]) === f
  for (let j = i - 1; j >= 0; j--) if (ok(j)) return months[j].net
  for (let j = i + 1; j < months.length; j++) if (ok(j)) return months[j].net
  return Math.round((m.net * (m.gross - payoutGrossOf(m))) / m.gross)
}

export type Bar = { month: string; base: number; extra: number }
export function bars(months: Month[], mode: Mode): Bar[] {
  return months.map((m, i) => {
    if (mode === 'gross') {
      const extra = payoutGrossOf(m)
      return { month: m.month, base: m.gross - extra, extra }
    }
    const base = netBase(months, i)
    return { month: m.month, base, extra: m.net - base }
  })
}

export function addMonths(ym: string, delta: number): string {
  const [y, mo] = ym.split('-').map(Number)
  const t = y * 12 + (mo - 1) + delta
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

export type SalaryEvent =
  | { type: 'start'; month: string; designation: string; fixedMonthly: number }
  | { type: 'promotion'; month: string; from: string; to: string; fixedMonthly: number; pct: number }
  | { type: 'hike'; month: string; fixedMonthly: number; pct: number }
  | { type: 'payout'; month: string; gross: number; net: number; labels: string[] }

/**
 * Events, oldest first. Designation change = promotion. Fixed change >= HIKE_MIN_FRACTION = hike.
 * A raise paid with back-pay is dated back: arrears / raise-per-month months earlier.
 * Any variable item or arrears = payout.
 */
export function events(months: Month[]): SalaryEvent[] {
  const out: SalaryEvent[] = []
  months.forEach((m, i) => {
    const f = fixedOf(m)
    if (i === 0) {
      out.push({ type: 'start', month: m.month, designation: m.designation, fixedMonthly: f })
    } else {
      const p = months[i - 1]
      const pf = fixedOf(p)
      const delta = f - pf
      const pct = pf > 0 ? Math.round((delta / pf) * 100) : 0
      const back = delta > 0 && arrearsOf(m) > 0 ? Math.round(arrearsOf(m) / delta) : 0
      const when = addMonths(m.month, -back)
      if (m.designation !== p.designation) {
        out.push({ type: 'promotion', month: when, from: p.designation, to: m.designation, fixedMonthly: f, pct })
      } else if (pf > 0 && Math.abs(delta) / pf >= HIKE_MIN_FRACTION) {
        out.push({ type: 'hike', month: when, fixedMonthly: f, pct })
      }
    }
    const g = payoutGrossOf(m)
    if (g > 0) {
      const labels = m.items.filter((it) => it.category === 'variable').map((it) => it.label)
      if (arrearsOf(m) > 0) labels.push('Arrears')
      out.push({ type: 'payout', month: m.month, gross: g, net: m.net - netBase(months, i), labels })
    }
  })
  return out
}

/** Indian financial year label for a month: 2026-04..2027-03 -> "FY 26-27". */
export function fyOf(ym: string): string {
  const [y, mo] = ym.split('-').map(Number)
  const s = mo >= 4 ? y : y - 1
  return `FY ${String(s % 100).padStart(2, '0')}-${String((s + 1) % 100).padStart(2, '0')}`
}

/** Base + extra summed over the latest month's financial year, in the chosen mode. */
export function fySoFar(months: Month[], mode: Mode): number {
  if (!months.length) return 0
  const fy = fyOf(months[months.length - 1].month)
  return bars(months, mode).filter((b) => fyOf(b.month) === fy).reduce((a, b) => a + b.base + b.extra, 0)
}
