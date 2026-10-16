// Screenshot every view at desktop and phone width, and click through the controls.
// node scripts/shoot.mjs [base-url]   (default: local wrangler dev; MYREPO_PIN env, else the .dev.vars.example PIN)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { launchOptions } from '../../../scripts/lib/chrome.mjs'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.argv[2] ?? 'http://localhost:8791'
const PIN = process.env.MYREPO_PIN ?? 'change-me'
const OUT = path.join(APP, '.shots')
fs.mkdirSync(OUT, { recursive: true })

const fail = (m) => { console.error(`FAIL ${m}`); process.exitCode = 1 }
const clickText = (page, sel, text) => page.evaluate((s, t) => {
  const el = [...document.querySelectorAll(s)].find((b) => b.textContent?.trim().startsWith(t))
  el?.click()
  return !!el
}, sel, text)
const pause = () => new Promise((r) => setTimeout(r, 250))

const browser = await puppeteer.launch(launchOptions())
try {
  for (const [label, width, height] of [['desktop', 1440, 1000], ['phone', 390, 844]]) {
    const page = await browser.newPage()
    await page.setViewport({ width, height })
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(BASE, { waitUntil: 'networkidle0' })
    if (await page.$('input[type=password]')) {
      await page.type('input[type=password]', PIN)
      await page.click('button[type=submit]')
    }
    await page.waitForSelector('.areas', { timeout: 15000 })
    const cards = await page.$$eval('.area', (els) => els.length)
    if (cards < 5) fail(`${label}: only ${cards} area cards`)
    await page.screenshot({ path: `${OUT}/${label}-home.png`, fullPage: label === 'desktop' })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    if (overflow > 1) fail(`${label}: page scrolls sideways by ${overflow}px`)

    if (!(await clickText(page, '.area-open', 'Google & mail'))) fail(`${label}: no Google & mail card`)
    await page.waitForSelector('.map')
    const boxes = await page.$$eval('.node', (els) => els.length)
    if (boxes < 4 || boxes > 60) fail(`${label}: Google & mail map has ${boxes} boxes`)
    await clickText(page, '.node', 'drive')
    await pause()
    const lit = await page.$$eval('.line.hot', (els) => els.length)
    if (!lit) fail(`${label}: clicking drive lit no lines`)
    await page.screenshot({ path: `${OUT}/${label}-area.png`, fullPage: label === 'phone' })
    await clickText(page, '.back', '← All areas')
    await page.waitForSelector('.areas')

    await page.type('input[type=search]', 'train')
    await pause()
    const hits = await page.$$eval('.area .mini', (els) => els.map((e) => e.textContent?.trim()))
    if (!hits.includes('pp-trains')) fail(`${label}: search "train" did not find pp-trains`)
    await page.screenshot({ path: `${OUT}/${label}-search.png` })
    for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace')

    await clickText(page, '.tabs.scope button', 'Work')
    await pause()
    const work = await page.$$eval('.area-name', (els) => els.map((e) => e.textContent))
    if (!work.includes('Zluri systems')) fail(`${label}: Work tab has no Zluri systems card`)
    if (work.includes('Money')) fail(`${label}: Work tab shows a personal area`)
    await page.screenshot({ path: `${OUT}/${label}-work.png` })

    for (const [tab, sel] of [['Table', 'table'], ['Loose ends', '#loose-h']]) {
      await clickText(page, '.tabs button', tab)
      await page.waitForSelector(sel)
      await page.screenshot({ path: `${OUT}/${label}-${tab.split(' ')[0].toLowerCase()}.png` })
    }
    await clickText(page, '.tabs.scope button', 'Personal')
    await pause()
    if (await page.$('.loose-item')) {
      await page.evaluate(() => document.querySelector('.loose-item')?.click())
      await page.waitForSelector('.map')
    }
    if (errors.length) fail(`${label}: page errors ${errors.join(' | ')}`)
    console.log(`${label}: ${cards} personal areas, ${boxes} boxes in Google & mail, ${lit} lit lines, ${work.length} work areas`)
    await page.close()
  }
} finally {
  await browser.close()
}
