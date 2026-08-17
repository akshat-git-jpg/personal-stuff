// scripts/make-icons.mjs — render the app icon to PNG with the system Chrome.
// Run once: `node scripts/make-icons.mjs`. The PNGs are committed; the merge
// gate never runs this, so puppeteer is not a gate dependency.
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// A hanger over a dark tile. `pad` leaves the safe area a maskable icon needs.
const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0b0b0c"/>
  <g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)"
     fill="none" stroke="#4f8cff" stroke-width="26"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M256 150a34 34 0 1 1 34 34c0 18-16 26-34 34"/>
    <path d="M256 218 96 330a16 16 0 0 0 9 29h302a16 16 0 0 0 9-29L256 218z"/>
  </g>
</svg>`

const targets = [
  { file: 'public/icon-192.png', size: 192, pad: 0.12 },
  { file: 'public/icon-512.png', size: 512, pad: 0.12 },
  { file: 'public/icon-512-maskable.png', size: 512, pad: 0.3 },
]

mkdirSync('public', { recursive: true })
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
try {
  for (const { file, size, pad } of targets) {
    const page = await browser.newPage()
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 })
    await page.setContent(
      `<style>html,body{margin:0;padding:0;background:#0b0b0c}svg{width:${size}px;height:${size}px;display:block}</style>${svg(pad)}`,
    )
    await page.screenshot({ path: file, omitBackground: false })
    await page.close()
    console.log(`wrote ${file}`)
  }
} finally {
  await browser.close()
}
