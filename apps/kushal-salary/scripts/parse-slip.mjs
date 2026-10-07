// Parse the text of a RazorpayX payslip (`pdftotext -layout`) into one month row.
// Pure: no I/O. `scripts/push-month.mjs` and the tests import it.

const NUM = /-?\d[\d,]*/g
const toInt = (s) => Number(s.replace(/,/g, ''))
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** One-time pay items. Everything else on the earnings table is fixed pay. */
export const VARIABLE_RE = /variable|bonus|incentive|award|retention|joining|referral|performance|arrear/i

export function parseSlipText(text) {
  const page = text.split('Yearly Taxable Income')[0]
  const lines = page.split('\n')

  const pm = page.match(/Payslip:\s*([A-Z][a-z]{2})\s+(\d{4})/)
  if (!pm) throw new Error('no "Payslip: Mon YYYY" line')
  const month = `${pm[2]}-${String(MONTHS.indexOf(pm[1]) + 1).padStart(2, '0')}`

  const head = page.match(/Net Pay[\s\S]*?(\d[\d,]*)\s*=?\s*\n?\s*=?\s*\+\s*(\d[\d,]*)\s+-\s*(\d[\d,]*)/)
  if (!head) throw new Error('no "Net = + Gross - Deductions" header')
  const [net, gross, deductions] = [head[1], head[2], head[3]].map(toInt)

  const di = lines.findIndex((l) => l.trim().startsWith('Designation'))
  const designation = di >= 0 ? (lines[di + 1] ?? '').trim().split(/\s{2,}/)[0] : ''

  const hi = lines.findIndex((l) => /Earnings\s+Monthly/.test(l))
  if (hi < 0) throw new Error('no earnings table')
  const col = lines[hi].indexOf('Earnings')
  const hasArrears = /Monthly\s+Arrears\s+Total Amount/.test(lines[hi])
  const ei = lines.findIndex((l, i) => i > hi && /Gross Pay\s+\d[\d,]*\s*$/.test(l))
  if (ei < 0) throw new Error('no "Gross Pay <n>" total line')

  const items = []
  let pending = ''
  let wantTail = false // a number row with no label of its own takes the next text-only line too
  for (const line of lines.slice(hi + 1, ei)) {
    const right = line.slice(col)
    const nums = right.match(NUM) ?? []
    const label = right.replace(NUM, '').replace(/\s+/g, ' ').trim()
    if (nums.length === 0) {
      if (!label) continue
      if (wantTail && items.length) {
        items[items.length - 1].label += ' ' + label
        wantTail = false
      } else pending = (pending + ' ' + label).trim()
      continue
    }
    const v = nums.map(toInt)
    const full = (pending + ' ' + label).trim()
    items.push({
      label: full,
      monthly: v[0],
      arrears: hasArrears && v.length >= 3 ? v[1] : 0,
      total: v[v.length - 1],
    })
    wantTail = label === ''
    pending = ''
  }
  for (const it of items) {
    it.label = it.label.replace(/ﬂ/g, 'fl').replace(/ﬁ/g, 'fi')
    it.category = VARIABLE_RE.test(it.label) ? 'variable' : 'fixed'
  }

  const checks = []
  if (net !== gross - deductions) checks.push(`net ${net} != gross ${gross} - deductions ${deductions}`)
  const sum = items.reduce((a, it) => a + it.total, 0)
  if (sum !== gross) checks.push(`earnings add up to ${sum}, gross is ${gross}`)
  if (!designation) checks.push('no designation')
  return { month, designation, gross, net, deductions, items, checks }
}

// CLI: node scripts/parse-slip.mjs <payslip.pdf> -> prints the parsed JSON (needs pdftotext).
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const { execFileSync } = await import('node:child_process')
  const { basename } = await import('node:path')
  const pdf = process.argv[2]
  if (!pdf) {
    console.error('usage: parse-slip.mjs <payslip.pdf>')
    process.exit(2)
  }
  const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' })
  console.log(JSON.stringify({ ...parseSlipText(text), source_file: basename(pdf) }, null, 2))
}
