/**
 * Screenshot the running dashboard so the look gets checked, not guessed.
 *
 * Prints what actually rendered — the headline, segment counts, the tally — and
 * exits non-zero on a page error, so a blank chart cannot pass as a pass.
 *
 *   node scripts/shoot.mjs [url] [out] [--password=...] [--month=2026-03]
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const flag = (n, d) => (argv.find((a) => a.startsWith(`--${n}=`)) || `=${d}`).split('=').slice(1).join('=')
const positional = argv.filter((a) => !a.startsWith('--'))

const url = positional[0] || 'http://127.0.0.1:8793'
const out = resolve(here, '..', positional[1] || '.shots/revenue.png')
const password = flag('password', 'localtest123')
const month = flag('month', '')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
mkdirSync(dirname(out), { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 2 })

const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

await page.goto(url, { waitUntil: 'networkidle0' })

const pw = await page.$('input[type=password]')
if (pw) {
  await pw.type(password)
  await page.click('button[type=submit]')
  await page.waitForSelector('.rev', { timeout: 15000 })
}

if (month) {
  // Move the year first if the target is not in the year on screen.
  const [y, m] = month.split('-').map(Number)
  for (let i = 0; i < 12; i++) {
    const shown = await page.$eval('.year-label', (el) => Number(el.textContent))
    if (shown === y) break
    await page.click(shown > y ? '.year-nav button:first-child' : '.year-nav button:last-child')
    await new Promise((r) => setTimeout(r, 120))
  }
  await page.evaluate((idx) => {
    const b = document.querySelectorAll('.months .m')[idx]
    if (b && !b.disabled) b.click()
  }, m - 1)
  await new Promise((r) => setTimeout(r, 400))
}

await page.waitForSelector('.tally, .empty', { timeout: 10000 })
await new Promise((r) => setTimeout(r, 300))

const stats = await page.evaluate(() => ({
  headline: document.querySelector('.tally-figure')?.textContent ?? null,
  verdict: document.querySelector('.verdict')?.textContent.trim() ?? null,
  emptyTitle: document.querySelector('.empty-title')?.textContent ?? null,
  toolRows: document.querySelectorAll('tbody tr').length,
  untracedRow: Boolean(document.querySelector('.row-untraced')),
  chartSegments: document.querySelectorAll('.rev-svg rect:not(.hit)').length,
  legend: [...document.querySelectorAll('.legend div')].map((d) => d.textContent.trim().replace(/\s+/g, ' ')),
  sources: [...document.querySelectorAll('.src')].map((d) => d.textContent.trim().replace(/\s+/g, ' ')),
  disabledMonths: [...document.querySelectorAll('.months .m')].filter((b) => b.disabled).length,
  overflowX: document.documentElement.scrollWidth - window.innerWidth,
}))

await page.screenshot({ path: out, fullPage: true })
await browser.close()

console.log(JSON.stringify(stats, null, 1))
if (errors.length) {
  console.error('\nPAGE ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log(`\nsaved ${out}`)
