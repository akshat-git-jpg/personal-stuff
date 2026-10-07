#!/usr/bin/env node
// Push payslip months to kushal-salary, or print what is stored.
//
//   node scripts/push-month.mjs --history
//   node scripts/push-month.mjs <payslip.pdf> [more.pdf ...]   parse, check, push numbers + PDF
//   node scripts/push-month.mjs <month.json> [<payslip.pdf>]    push owner-corrected JSON as is
//
// A PDF whose numbers fail the parser's checks is NOT pushed (exit 3).
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { call, loadConfig, putPdf } from './ingest-lib.mjs'
import { parseSlipText } from './parse-slip.mjs'

const args = process.argv.slice(2)
if (!args.length) {
  console.error('usage: push-month.mjs --history | <payslip.pdf>... | <month.json> [<payslip.pdf>]')
  process.exit(2)
}
const cfg = loadConfig()

if (args[0] === '--history') {
  const d = await call(cfg, 'GET', '/api/salary')
  const out = {
    months: d.months.map(({ month, designation, gross, net, has_pdf }) => ({ month, designation, gross, net, has_pdf })),
    notes: d.notes.map(({ id, date, title, has_pdf }) => ({ id, date, title, has_pdf })),
  }
  console.log(JSON.stringify(out, null, 2))
  process.exit(0)
}

async function push(month, pdf) {
  const { checks: _checks, ...body } = month
  await call(cfg, 'POST', '/api/months', body)
  if (pdf) await putPdf(cfg, `/api/months/${month.month}/pdf`, pdf)
  console.log(`pushed ${month.month}${pdf ? ' + pdf' : ''}`)
}

if (args[0].endsWith('.json')) {
  await push(JSON.parse(readFileSync(args[0], 'utf8')), args[1])
} else {
  for (const pdf of args) {
    const parsed = parseSlipText(execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }))
    if (parsed.checks.length) {
      console.error(`${basename(pdf)}: not pushed: ${parsed.checks.join('; ')}`)
      process.exit(3)
    }
    await push({ ...parsed, source_file: basename(pdf) }, pdf)
  }
}
