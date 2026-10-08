// scripts/e2e.mjs: walk the real app in Chrome the way the owner uses it, at desktop and phone width.
// Read-only: it logs in, hovers, clicks and opens PDFs, and never writes data.
//
// Usage: E2E_PIN=<pin> node scripts/e2e.mjs [url]   (default http://localhost:8787)
// Exit 0 = every check passed. Needs months with PDFs in the target (a local copy or prod).
import puppeteer from 'puppeteer-core'
import { launchOptions } from '../../scripts/lib/chrome.mjs'

const BASE = (process.argv[2] || 'http://localhost:8787').replace(/\/$/, '')
const PIN = process.env.E2E_PIN
if (!PIN) {
  console.error('set E2E_PIN')
  process.exit(2)
}

let failed = 0
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`)
  if (!ok) failed++
}

const browser = await puppeteer.launch(launchOptions())

/** Open `href` the way a click does (a top-level page visit) and report what came back. */
async function visit(href) {
  const p = await browser.newPage()
  try {
    const r = await p.goto(href, { waitUntil: 'load' }).catch(() => null)
    const type = r ? (r.headers()['content-type'] ?? '') : ''
    return { status: r?.status() ?? 0, type }
  } finally {
    await p.close()
  }
}

async function run(width, height) {
  const tag = width < 500 ? 'phone' : 'desktop'
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('401') && errors.push(m.text()))
  await page.setViewport({ width, height })
  await page.goto(BASE, { waitUntil: 'networkidle0' })

  // Login
  await page.type('input', '0000')
  await page.keyboard.press('Enter')
  await page.waitForSelector('.error', { timeout: 5000 }).catch(() => null)
  check(!!(await page.$('.error')), `${tag}: wrong PIN shows an error`)
  await page.waitForFunction(() => !document.querySelector('input').disabled)
  await page.$eval('input', (e) => {
    e.select()
  })
  await page.keyboard.press('Backspace')
  await page.type('input', PIN)
  await page.keyboard.press('Enter')
  const loggedIn = await page.waitForSelector('[data-testid=month-chart]', { timeout: 10000 }).catch(() => null)
  if (!loggedIn) {
    const pinLen = await page.$eval('input', (e) => e.value.length).catch(() => -1)
    check(false, `${tag}: right PIN opens the months tab (PIN box holds ${pinLen} chars; page says: ${(await page.$eval('body', (e) => e.innerText)).slice(0, 120)})`)
    await ctx.close()
    return
  }
  check(true, `${tag}: right PIN opens the months tab`)

  const noSideScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  check(await noSideScroll(), `${tag}: page has no sideways scroll`)

  // One point, one label and one list row per month
  const n = await page.$$eval('[data-testid=month-point]', (e) => e.length)
  const labels = await page.$$eval('[data-testid=month-label]', (e) => e.length)
  const rows = await page.$$eval('[data-testid=recent] .row', (e) => e.map((r) => r.firstChild.textContent))
  check(n > 0 && n === labels && n === rows.length, `${tag}: ${n} points, ${labels} labels, ${rows.length} list rows`)

  // Arrow keys walk every month; the tooltip names it, stays in view and never covers its dot
  await page.$eval('[data-testid=month-chart]', (e) => e.focus())
  const bad = []
  for (let i = 0; i < n; i++) {
    if (i) await page.keyboard.press('ArrowLeft')
    const r = await page.evaluate(() => {
      const tip = document.querySelector('[data-testid=chart-tip]')
      const dot = document.querySelector('.hover-pay')
      const frame = document.querySelector('.chart-frame').getBoundingClientRect()
      const axis = document.querySelector('.y-axis').getBoundingClientRect()
      if (!tip || !dot) return { missing: true }
      const t = tip.getBoundingClientRect()
      const d = dot.getBoundingClientRect()
      const cx = d.left + d.width / 2
      const cy = d.top + d.height / 2
      return {
        month: tip.querySelector('.tip-month').textContent,
        inView: t.left >= axis.right - 1 && t.right <= frame.right + 1 && t.top >= frame.top - 1 && t.bottom <= frame.bottom + 1,
        dotInView: cx >= axis.right && cx <= frame.right,
        covers: cx > t.left && cx < t.right && cy > t.top && cy < t.bottom,
      }
    })
    const want = rows[i]
    if (r.missing || r.month !== want || !r.inView || !r.dotInView || r.covers) bad.push(`${want}: ${JSON.stringify(r)}`)
  }
  check(bad.length === 0, `${tag}: tooltip right for all ${n} months${bad.length ? '\n  ' + bad.join('\n  ') : ''}`)

  // Mouse hover on the newest month, after scrolling back to it
  await page.evaluate(() => {
    document.activeElement.blur()
    document.querySelector('.chart-scroll').scrollLeft = 1e6
  })
  const pt = await page.$$eval('[data-testid=month-point]', (e) => {
    const r = e[e.length - 1].getBoundingClientRect()
    return [r.left + r.width / 2, r.top + r.height / 2]
  })
  await page.mouse.move(pt[0], pt[1])
  const hovered = await page.$eval('[data-testid=chart-tip] .tip-month', (e) => e.textContent).catch(() => '')
  check(hovered === rows[0], `${tag}: mouse hover shows ${rows[0]}`)
  await page.mouse.move(1, 1)

  // Net / Gross
  const kpi = () => page.$eval('[data-testid=kpis] b', (e) => e.textContent)
  const net = await kpi()
  await page.click('button[aria-pressed=false]')
  const gross = await kpi()
  check(net !== gross, `${tag}: Gross changes the numbers (${net} -> ${gross})`)
  await page.click('button[aria-pressed=false]')
  check((await kpi()) === net, `${tag}: Net brings them back`)

  // A real click on the newest month opens its payslip PDF in a new tab
  const newTab = new Promise((res) => ctx.once('targetcreated', res))
  await page.click('[data-testid=recent] a.row')
  const target = await Promise.race([newTab, new Promise((res) => setTimeout(() => res(null), 8000))])
  let opened = ''
  if (target) {
    const tab = await target.page()
    await new Promise((res) => setTimeout(res, 1500))
    opened = tab ? await tab.evaluate(() => document.contentType).catch(() => '') : ''
    if (tab) await tab.close()
  }
  check(opened === 'application/pdf', `${tag}: clicking ${rows[0]} opens a PDF (got '${opened || 'no tab'}')`)

  if (tag === 'desktop') {
    // Every month link, as a page visit
    const hrefs = await page.$$eval('[data-testid=recent] a.row', (e) => e.map((a) => a.href))
    const ctxVisit = async (href) => {
      const p = await ctx.newPage()
      try {
        const r = await p.goto(href, { waitUntil: 'load' }).catch(() => null)
        return { status: r?.status() ?? 0, type: r ? (r.headers()['content-type'] ?? '') : '' }
      } finally {
        await p.close()
      }
    }
    const wrong = []
    for (const h of hrefs) {
      const r = await ctxVisit(h)
      if (r.status !== 200 || r.type !== 'application/pdf') wrong.push(`${h} ${r.status} ${r.type}`)
    }
    check(hrefs.length === rows.length && wrong.length === 0, `${tag}: all ${hrefs.length} month links open PDFs${wrong.length ? '\n  ' + wrong.join('\n  ') : ''}`)
    const out = await visit(hrefs[0])
    check(out.status === 401, `${tag}: a payslip link without login is refused (${out.status})`)

    // Timeline and its letters
    await page.click('a[href="#/timeline"]')
    await page.waitForSelector('.tl-item', { timeout: 5000 }).catch(() => null)
    const items = await page.$$eval('.tl-item', (e) => e.length)
    check(items > 0, `${tag}: timeline shows ${items} items`)
    const letters = await page.$$eval('.tl-links a[href^="/api/notes/"]', (e) => e.map((a) => a.href))
    const badLetters = []
    for (const h of letters) {
      const r = await ctxVisit(h)
      if (r.status !== 200 || r.type !== 'application/pdf') badLetters.push(`${h} ${r.status} ${r.type}`)
    }
    check(badLetters.length === 0, `${tag}: all ${letters.length} letter links open PDFs${badLetters.length ? '\n  ' + badLetters.join('\n  ') : ''}`)
    check(await noSideScroll(), `${tag}: timeline has no sideways scroll`)
    await page.click('a[href="#/"]')
    await page.waitForSelector('[data-testid=month-chart]')
  }

  // Log out
  await page.click('button[aria-label="Log out"]')
  await page.waitForSelector('.login-card', { timeout: 5000 }).catch(() => null)
  check(!!(await page.$('.login-card')), `${tag}: log out returns to the PIN screen`)

  check(errors.length === 0, `${tag}: no page errors${errors.length ? '\n  ' + errors.join('\n  ') : ''}`)
  await ctx.close()
}

try {
  await run(1280, 900)
  await run(390, 844)
} finally {
  await browser.close()
}
console.log(failed ? `E2E FAILED (${failed})` : 'E2E OK')
process.exit(failed ? 1 : 0)
