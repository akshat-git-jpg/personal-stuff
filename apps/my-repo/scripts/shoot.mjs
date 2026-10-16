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
      await page.waitForSelector('.map', { timeout: 15000 })
    }
    await page.screenshot({ path: `${OUT}/${label}-map.png`, fullPage: false })
    const nodes = await page.$$eval('.node', (els) => els.length)
    if (nodes < 20) fail(`${label}: only ${nodes} boxes on the map`)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    if (overflow > 1) fail(`${label}: page scrolls sideways by ${overflow}px`)

    await page.evaluate(() => [...document.querySelectorAll('.node')].find((b) => b.textContent?.trim() === 'drive')?.click())
    await page.waitForSelector('#detail-h')
    const lit = await page.$$eval('.line.hot', (els) => els.length)
    if (!lit) fail(`${label}: clicking drive lit no lines`)
    await page.screenshot({ path: `${OUT}/${label}-traced.png`, fullPage: label === 'phone' })

    await page.type('input[type=search]', 'train')
    await new Promise((r) => setTimeout(r, 200))
    const searched = await page.$$eval('.node', (els) => els.map((e) => e.textContent?.trim()))
    if (!searched.includes('pp-trains')) fail(`${label}: search "train" lost pp-trains`)
    for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace')

    for (const [tab, sel] of [['Table', 'table'], ['Loose ends', '#loose-h']]) {
      await page.evaluate((t) => [...document.querySelectorAll('.tabs button')].find((b) => b.textContent?.startsWith(t))?.click(), tab)
      await page.waitForSelector(sel)
      await page.screenshot({ path: `${OUT}/${label}-${tab.split(' ')[0].toLowerCase()}.png` })
    }
    await page.evaluate(() => document.querySelector('.loose-item')?.click())
    await page.waitForSelector('.map')
    if (errors.length) fail(`${label}: page errors ${errors.join(' | ')}`)
    console.log(`${label}: ${nodes} boxes, ${lit} lit lines, shots in .shots/`)
    await page.close()
  }
} finally {
  await browser.close()
}
