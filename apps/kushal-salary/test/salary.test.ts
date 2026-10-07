import { describe, expect, it } from 'vitest'
import { addMonths, bars, events, fixedOf, fySoFar, fyOf, netBase, payoutGrossOf } from '../src/shared/salary'
import { fixture } from './fixtures/salary'

const ev = events(fixture)

describe('salary rules', () => {
  it('fixed pay sums the fixed items monthly column', () => {
    expect(fixedOf(fixture[4])).toBe(120000)
  })
  it('payout counts variable items and arrears', () => {
    expect(payoutGrossOf(fixture[1])).toBe(70000)
    expect(payoutGrossOf(fixture[4])).toBe(20000)
  })
  it('normal net of a payout month borrows the nearest earlier payout-free month on the same fixed pay', () => {
    expect(netBase(fixture, 1)).toBe(90000)
  })
  it('with no earlier match it looks later', () => {
    expect(netBase(fixture, 4)).toBe(105000)
    expect(netBase(fixture, 6)).toBe(140000)
  })
  it('with no match at all it scales by the fixed share', () => {
    expect(netBase([fixture[1]], 0)).toBe(Math.round((150000 * 100000) / 170000))
  })
  it('net bars split base and extra', () => {
    expect(bars(fixture, 'net')[1]).toEqual({ month: '2024-02', base: 90000, extra: 60000 })
  })
  it('gross bars split base and extra', () => {
    expect(bars(fixture, 'gross')[4]).toEqual({ month: '2024-05', base: 120000, extra: 20000 })
  })
  it('a raise paid with back-pay is dated back', () => {
    const hikes = ev.filter((e) => e.type === 'hike')
    expect(hikes).toHaveLength(1)
    expect(hikes[0]).toMatchObject({ month: '2024-04', pct: 20, fixedMonthly: 120000 })
  })
  it('a title change is a promotion', () => {
    const p = ev.filter((e) => e.type === 'promotion')
    expect(p).toEqual([{ type: 'promotion', month: '2025-04', from: 'Engineer', to: 'Senior Engineer', fixedMonthly: 160000, pct: 33 }])
  })
  it('a small change is not an event', () => {
    expect(ev.filter((e) => e.month === '2025-06')).toEqual([])
  })
  it('payouts list their labels', () => {
    const p = ev.filter((e) => e.type === 'payout')
    expect(p.map((e) => e.month)).toEqual(['2024-02', '2024-05', '2025-04'])
    expect(p[1]).toMatchObject({ labels: ['Arrears'], gross: 20000, net: 35000 })
  })
  it('first month is the start', () => {
    expect(ev[0]).toEqual({ type: 'start', month: '2024-01', designation: 'Engineer', fixedMonthly: 100000 })
  })
  it('financial year labels', () => {
    expect(fyOf('2026-03')).toBe('FY 25-26')
    expect(fyOf('2026-04')).toBe('FY 26-27')
  })
  it('FY so far sums the latest FY', () => {
    expect(fySoFar(fixture, 'gross')).toBe(260000 + 160000 + 161000)
  })
  it('addMonths crosses years', () => {
    expect(addMonths('2024-01', -1)).toBe('2023-12')
    expect(addMonths('2024-12', 1)).toBe('2025-01')
  })
  it('empty input', () => {
    expect(events([])).toEqual([])
    expect(fySoFar([], 'net')).toBe(0)
  })
})
