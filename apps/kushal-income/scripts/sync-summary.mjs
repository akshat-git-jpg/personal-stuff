/**
 * Copy the categorised statement figures into the Worker bundle.
 *
 * Source of truth is pipelines/personal-finance/data/summary.json, produced by
 * that folder's summarise.py. This runs as part of `npm run build`, so a deploy
 * can never ship stale figures.
 *
 * Unlike yt-income's equivalent, the file this copies DOES carry counterparty
 * names — that is the point of the "not named yet" list. So the protection here
 * is not redaction but containment: `src/worker/summary.json` is gitignored, the
 * Worker is password-gated, and the checks below refuse the two things that must
 * never travel even inside that boundary — the account number and raw statement
 * remarks, which carry phone numbers and UPI handles.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../../../pipelines/personal-finance/data/summary.json')
const dest = resolve(here, '../src/worker/summary.json')

/** Never allowed through, even into a gated bundle. */
const FORBIDDEN = [
  /\b37841171272\b/,          // the SBI account number
  /\bUPI\/(DR|CR)\//,         // a raw remark: carries phone numbers and VPAs
  /\bWDL TFR\b/,              // ditto
  /\bDIRECT DR\s+\d/,         // ditto
  /\b\d{10}@|@ybl|@okaxis|@paytm/i, // a VPA
  /"remarks"/,
]

function assertClean(text) {
  for (const re of FORBIDDEN) {
    if (re.test(text)) {
      console.error(`REFUSING TO SYNC: summary.json matches ${re}`)
      console.error('Raw remarks and account numbers must not reach the bundle.')
      console.error('The emitter should be reducing these to a payee name.')
      process.exit(1)
    }
  }
}

if (existsSync(src)) {
  assertClean(readFileSync(src, 'utf8'))
  copyFileSync(src, dest)
  console.log(`synced statement summary -> ${dest}`)
} else if (existsSync(dest)) {
  // A clone without the pipeline still has to build. Keep what is bundled.
  console.log('no summary at source; keeping the bundled copy')
} else {
  // First build on a machine that has never run the pipeline. Ship an empty
  // summary so the page renders its "nothing ingested yet" state.
  writeFileSync(dest, JSON.stringify({
    generated_at: null,
    account: null,
    period: { from: null, to: null },
    months: {},
    categories: {},
    totals: { in: 0, out: 0, net: 0, balance: 0 },
  }, null, 2))
  console.log('no summary found; wrote an empty one')
}
