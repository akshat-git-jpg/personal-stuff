// Synthetic salary history. Made-up numbers only: never put a real payslip value here.
import type { Month } from '../../src/shared/salary'
import type { Note } from '../../src/shared/types'

const m = (month: string, designation: string, fixed: number, net: number, extra: { variable?: number; arrears?: number } = {}): Month => {
  const items = [
    { label: 'Basic', category: 'fixed' as const, monthly: fixed, arrears: extra.arrears ?? 0, total: fixed + (extra.arrears ?? 0) },
    ...(extra.variable ? [{ label: 'Variable Pay', category: 'variable' as const, monthly: extra.variable, arrears: 0, total: extra.variable }] : []),
  ]
  const gross = items.reduce((a, i) => a + i.total, 0)
  return { month, designation, gross, net, deductions: gross - net, items, has_pdf: true }
}

export const fixture: Month[] = [
  m('2024-01', 'Engineer', 100000, 90000),
  m('2024-02', 'Engineer', 100000, 150000, { variable: 70000 }),
  m('2024-03', 'Engineer', 100000, 90000),
  m('2024-04', 'Engineer', 100000, 90000),
  m('2024-05', 'Engineer', 120000, 140000, { arrears: 20000 }),
  m('2024-06', 'Engineer', 120000, 105000),
  m('2025-04', 'Senior Engineer', 160000, 230000, { variable: 100000 }),
  m('2025-05', 'Senior Engineer', 160000, 140000),
  m('2025-06', 'Senior Engineer', 161000, 140800),
]

export const note: Note = {
  id: '2025-05-02-letter',
  date: '2025-05-02',
  title: 'Appraisal letter',
  body: 'New pay from April.',
  source_url: 'https://mail.google.com/x',
  source_file: 'letter.pdf',
  has_pdf: true,
}
