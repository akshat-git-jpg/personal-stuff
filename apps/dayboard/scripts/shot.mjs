import fs from 'node:fs'
// playwright-core ships no browsers; it drives the Chrome already on the machine.
// That keeps `npm install` small and offline, and avoids depending on a sibling app's
// node_modules, which a fresh checkout does not have.
import { chromium } from 'playwright-core'

fs.mkdirSync(process.env.OUT || '/tmp/dayboard-shots', { recursive: true })

const BASE = process.env.BASE || 'http://127.0.0.1:8787'
const PW = process.env.PW || 'devpass'
const OUT = process.env.OUT || '/tmp/dayboard-shots'

const browser = await chromium.launch({ channel: 'chrome' })

async function shoot(name, width, height, extra) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  // log in if the gate is showing
  if (await page.locator('#login:not([hidden])').count()) {
    await page.fill('#pw', PW)
    await page.click('#login button[type=submit]')
  }
  await page.waitForSelector('#track .blk', { timeout: 30000 })
  await page.waitForTimeout(1200)
  if (extra) await extra(page)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })

  // measure what actually rendered
  const report = await page.evaluate(() => {
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
    const blocks = [...document.querySelectorAll('#track .blk')].map((b) => ({
      title: b.querySelector('.bt')?.textContent || '?',
      ...rect(b),
      clippedTitle: (() => { const t = b.querySelector('.bt'); return t ? t.scrollWidth > t.clientWidth + 1 : false })(),
    }))
    const doc = document.documentElement
    return {
      blocks,
      bodyScrollW: doc.scrollWidth,
      clientW: doc.clientWidth,
      horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
      pings: [...document.querySelectorAll('.ping .lb')].map((p) => ({ text: p.textContent.trim(), ...rect(p) })),
      bands: [...document.querySelectorAll('.band')].map((b) => ({ title: b.title, ...rect(b) })),
      nowTitle: document.getElementById('nowtitle')?.textContent,
      stats: ['statBlocked', 'statFree', 'statPings'].map((id) => document.getElementById(id)?.textContent),
      legend: document.getElementById('bandlegend')?.textContent,
    }
  })

  // collisions: any two blocks whose rectangles intersect
  const hits = []
  for (let i = 0; i < report.blocks.length; i++) {
    for (let j = i + 1; j < report.blocks.length; j++) {
      const a = report.blocks[i], b = report.blocks[j]
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      if (ox > 2 && oy > 2) hits.push(`${a.title} <-> ${b.title} (${ox}x${oy}px)`)
    }
  }

  // pings sitting on top of a block's title row
  const pingHits = []
  for (const p of report.pings) {
    for (const b of report.blocks) {
      const ox = Math.min(p.x + p.w, b.x + b.w) - Math.max(p.x, b.x)
      const oy = Math.min(p.y + p.h, b.y + b.h) - Math.max(p.y, b.y)
      if (ox > 2 && oy > 2) pingHits.push(`"${p.text.slice(0, 30)}" over "${b.title}"`)
    }
  }

  console.log(`\n===== ${name}  ${width}x${height} =====`)
  console.log('  blocks rendered   :', report.blocks.length)
  console.log('  block collisions  :', hits.length, hits.length ? '<-- BUG' : '(none)')
  hits.slice(0, 8).forEach((h) => console.log('      ', h))
  console.log('  ping over block   :', pingHits.length, pingHits.length ? '<-- check' : '(none)')
  pingHits.slice(0, 8).forEach((h) => console.log('      ', h))
  console.log('  clipped titles    :', report.blocks.filter((b) => b.clippedTitle).map((b) => b.title).slice(0, 8).join(' | ') || '(none)')
  console.log('  horizontal overflow:', report.horizontalOverflow ? `YES (${report.bodyScrollW} > ${report.clientW}) <-- BUG` : 'no')
  console.log('  bands             :', report.bands.map((b) => `${b.title} [${b.w}x${b.h}]`).join(' | ') || '(none)')
  console.log('  legend            :', report.legend)
  console.log('  NOW               :', report.nowTitle)
  console.log('  stats             :', report.stats.join(' / '))
  console.log('  console errors    :', errors.length ? errors.slice(0, 5) : '(none)')
  console.log('  saved             :', `${OUT}/${name}.png`)

  await ctx.close()
}

await shoot('desktop', 1440, 900)
await shoot('mobile', 390, 844)
await shoot('sheet', 1440, 900, async (page) => {
  await page.locator('#track .blk').first().click()
  await page.waitForSelector('#sheet:not([hidden])')
  await page.waitForTimeout(400)
})

await browser.close()
