#!/usr/bin/env node
// Push one mail note (an appraisal letter, an HR salary mail) to kushal-salary.
//
//   node scripts/push-note.mjs <note.json> [<letter.pdf>]
//
// note.json: { "id": "2026-05-13-appraisal-letter", "date": "2026-05-13", "title": "...",
//              "body": "...", "source_url": "https://mail.google.com/...", "source_file": "letter.pdf" }
import { readFileSync } from 'node:fs'
import { call, loadConfig, putPdf } from './ingest-lib.mjs'

const [json, pdf] = process.argv.slice(2)
if (!json) {
  console.error('usage: push-note.mjs <note.json> [<letter.pdf>]')
  process.exit(2)
}
const cfg = loadConfig()
const note = JSON.parse(readFileSync(json, 'utf8'))
await call(cfg, 'POST', '/api/notes', note)
if (pdf) await putPdf(cfg, `/api/notes/${note.id}/pdf`, pdf)
console.log(`pushed note ${note.id}${pdf ? ' + pdf' : ''}`)
