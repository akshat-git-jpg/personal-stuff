/**
 * Screenshot a tab of the running dashboard, so the look gets checked rather
 * than guessed. Logs in first. Drives the system Chrome via puppeteer-core.
 *
 *   node scripts/shoot.mjs [url] [out] [--password=...] [--tab=Income]
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const flag = (n, d) => (argv.find((a) => a.startsWith(`--${n}=`)) || `=${d}`).split('=').slice(1).join('=')
const positional = argv.filter((a) => !a.startsWith('--'))

const url = positional[0] || 'http://127.0.0.1:8792'
const out = resolve(here, '..', positional[1] || '.shots/shot.png')
const password = flag('password', 'localtest123')
const tab = flag('tab', '')

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
mkdirSync(dirname(out), { recursive: true })

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 })

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })

await page.goto(url, { waitUntil: 'networkidle0' })

// Log in if the gate is showing.
const pw = await page.$('input[type=password]')
if (pw) {
  await pw.type(password)
  await page.keyboard.press('Enter')
  await page.waitForSelector('.tabs', { timeout: 15000 })
}

if (tab) {
  await page.waitForSelector('.tabs .tab', { timeout: 15000 })
  const clicked = await page.evaluate((name) => {
    const b = [...document.querySelectorAll('.tabs .tab')].find((x) => x.textContent.trim() === name)
    if (b) { b.click(); return true }
    return false
  }, tab)
  if (!clicked) { console.error(`tab "${tab}" not found`); process.exit(1) }
  await new Promise((r) => setTimeout(r, 800))
}

const stats = await page.evaluate(() => ({
  tabs: [...document.querySelectorAll('.tabs .tab')].map((b) => b.textContent.trim()),
  activeTab: document.querySelector('.tabs .tab-on')?.textContent.trim(),
  statTiles: document.querySelectorAll('.income .stat').length,
  chartBars: document.querySelectorAll('.income-svg rect:not(.income-hit)').length,
  tableRows: document.querySelectorAll('.income-table tbody tr').length,
  headline: document.querySelector('.income .stat-value')?.textContent,
  overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
}))

await page.screenshot({ path: out, fullPage: true })
await browser.close()

console.log(JSON.stringify(stats, null, 2))
if (errors.length) {
  console.error('\nPAGE ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log(`\nsaved ${out}`)
