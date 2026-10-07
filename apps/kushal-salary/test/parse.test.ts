import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseSlipText } from '../scripts/parse-slip.mjs'

const simple = readFileSync(new URL('./fixtures/slip-simple.txt', import.meta.url), 'utf8')
const arrears = readFileSync(new URL('./fixtures/slip-arrears.txt', import.meta.url), 'utf8')

describe('parseSlipText', () => {
  it('reads month, title and header numbers', () => {
    const r = parseSlipText(simple)
    expect([r.month, r.designation, r.gross, r.net, r.deductions]).toEqual(['2025-05', 'Senior Engineer', 180000, 150000, 30000])
  })
  it('reads every earning in order', () => {
    expect(parseSlipText(simple).items.map((i) => i.label)).toEqual([
      'Basic', 'House Rent Allowance', 'Special Allowance', 'Leave & Travel Allowance',
      'PF Employer Contribution', 'Zaggle flexible benefits', 'Variable Pay',
    ])
  })
  it('marks Variable Pay as variable, the rest fixed', () => {
    expect(parseSlipText(simple).items.map((i) => i.category)).toEqual(['fixed', 'fixed', 'fixed', 'fixed', 'fixed', 'fixed', 'variable'])
  })
  it('passes its own checks on both layouts', () => {
    expect(parseSlipText(simple).checks).toEqual([])
    expect(parseSlipText(arrears).checks).toEqual([])
  })
  it('joins labels wrapped above and below the number row', () => {
    expect(parseSlipText(arrears).items.map((i) => i.label)).toEqual([
      'Basic', 'House Rent Allowance', 'Special Allowance', 'Leave & Travel Allowance', 'PF Employer Contribution', 'Variable Pay',
    ])
  })
  it('reads the arrears column', () => {
    const r = parseSlipText(arrears)
    expect(r.items.map((i) => i.arrears)).toEqual([10000, 2000, 3000, 0, 0, 0])
    expect([r.items[0].monthly, r.items[0].total]).toEqual([50000, 60000])
    expect(r.month).toBe('2024-08')
  })
  it('ignores the left employee column', () => {
    const labels = parseSlipText(arrears).items.map((i) => i.label).join('|')
    expect(labels).not.toMatch(/UAN|Testing|000000000000/)
  })
  it('flags a gross that does not add up', () => {
    const bad = simple.replace(/(Basic\s+)80,000(\s+)80,000/, '$181,000$281,000')
    const checks = parseSlipText(bad).checks
    expect(checks).toHaveLength(1)
    expect(checks[0]).toContain('add up')
  })
  it('flags net != gross - deductions', () => {
    const bad = simple.replace('1,50,000   =', '1,49,000   =')
    expect(parseSlipText(bad).checks.some((c) => c.startsWith('net 149000'))).toBe(true)
  })
  it('throws without a Payslip line', () => {
    expect(() => parseSlipText('hello')).toThrow('no "Payslip: Mon YYYY" line')
  })
})
