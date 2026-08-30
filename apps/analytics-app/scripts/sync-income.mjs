/**
 * Copy the aggregated income numbers into the Worker bundle.
 *
 * Source of truth is pipelines/income-analysis/summary.json, produced by that
 * folder's ingest.py. This runs as part of `npm run build`, so a deploy can
 * never ship stale figures.
 *
 * Only aggregates travel: month totals per rail, plus PayPal per-program
 * totals. No transaction lines, names, or account numbers — those stay in
 * pipelines/income-analysis/data/, which is gitignored.
 */
import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../../../pipelines/income-analysis/summary.json')
const dest = resolve(here, '../src/worker/income-summary.json')

if (existsSync(src)) {
  copyFileSync(src, dest)
  console.log(`synced income summary -> ${dest}`)
} else if (existsSync(dest)) {
  // A clone without the summary still has to build. Keep whatever is bundled.
  console.log('no summary at source; keeping the bundled copy')
} else {
  // First build on a machine that has never run ingest.py. Ship an empty
  // summary so the Income tab renders its "nothing ingested yet" state.
  writeFileSync(dest, JSON.stringify({
    generated_at: null, statements: [], rails: {}, bank_by_month: {},
  }, null, 2))
  console.log('no summary found; wrote an empty one')
}
