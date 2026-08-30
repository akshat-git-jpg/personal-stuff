/**
 * Copy the attributed revenue figures into the Worker bundle.
 *
 * Source of truth is pipelines/income-analysis/summary.json, produced by that
 * folder's ingest.py. This runs as part of `npm run build`, so a deploy can
 * never ship stale figures.
 *
 * It also refuses to copy a file carrying anything personal. summary.json is
 * bundled into a Worker and this repo is public, so the check is cheap
 * insurance against a future change to the ingest quietly widening what lands
 * in it.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../../../pipelines/income-analysis/summary.json')
const dest = resolve(here, '../src/worker/summary.json')

/** Patterns that must never appear in a committed or bundled summary. */
const FORBIDDEN = [
  /3235000100068619/,          // the account number
  /\bSEEMA\b/i,
  /\bBAKLIWAL\b/i,
  /Moti Mansion/i,
  /\bUPI\//,                   // a raw transaction remark
  /account_number/i,
  /beneficiary/i,
]

function assertClean(text, label) {
  for (const re of FORBIDDEN) {
    if (re.test(text)) {
      console.error(`REFUSING TO SYNC: ${label} matches ${re}`)
      console.error('Personal data must never reach the Worker bundle. Fix the ingest.')
      process.exit(1)
    }
  }
}

if (existsSync(src)) {
  assertClean(readFileSync(src, 'utf8'), 'summary.json')
  copyFileSync(src, dest)
  console.log(`synced revenue summary -> ${dest}`)
} else if (existsSync(dest)) {
  // A clone without the pipeline still has to build. Keep what is bundled.
  console.log('no summary at source; keeping the bundled copy')
} else {
  // First build on a machine that has never run the ingest. Ship an empty
  // summary so the Revenue tab renders its "nothing ingested yet" state.
  writeFileSync(dest, JSON.stringify({
    generated_at: null,
    coverage: { from: null, to: null },
    statements: [],
    rails: {},
    sources: [],
    months: {},
  }, null, 2))
  console.log('no summary found; wrote an empty one')
}
