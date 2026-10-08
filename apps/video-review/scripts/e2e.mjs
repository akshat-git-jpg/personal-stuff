// scripts/e2e.mjs: walks the full owner + freelancer flow in Chrome against a LOCAL dev server.
// Writes data (creates and deletes a project), so never point it at prod.
//
// Usage: npm run fixtures && E2E_PIN=1234 node scripts/e2e.mjs [url]   (default http://localhost:8790)
// Needs PART_MB=5 in .dev.vars so v1 uploads in two parts. Screenshots land in .shots/.
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { launchOptions } from '../../../scripts/lib/chrome.mjs'

const BASE = (process.argv[2] || 'http://localhost:8790').replace(/\/$/, '')
const PIN = process.env.E2E_PIN
if (!PIN) {
  console.error('set E2E_PIN')
  process.exit(2)
}
if (!/localhost|127\.0\.0\.1/.test(BASE)) {
  console.error('e2e writes data: run it against a local server only')
  process.exit(2)
}
const FX = (f) => resolve('.fixtures', f)
mkdirSync('.shots', { recursive: true })

let failed = 0
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`)
  if (!ok) failed++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch(launchOptions())
const errors = []

async function newPage(width = 1440, height = 900) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width, height })
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/40[1-9]|Failed to load resource/.test(m.text())) errors.push(m.text())
  })
  page.on('dialog', (d) => d.accept())
  return page
}

const text = (page) => page.evaluate(() => document.body.innerText)
const clickText = async (page, sel, t) => {
  const els = await page.$$(sel)
  for (const el of els) {
    if ((await el.evaluate((e) => e.textContent ?? '')).includes(t)) return el.click()
  }
  throw new Error(`no ${sel} with "${t}"`)
}
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

async function upload(page, file, name) {
  const input = await page.$('input[aria-label="Video file"]')
  await input.uploadFile(FX(file))
  await page.waitForFunction(() => !document.body.innerText.includes('Checking the file'), { timeout: 20000 })
  if (name !== undefined) {
    await page.$eval('input[aria-label="Version name"]', (e) => {
      e.select()
    })
    await page.keyboard.press('Backspace')
    await page.type('input[aria-label="Version name"]', name)
  }
}

async function waitVersion(page, name) {
  await page.waitForFunction((n) => [...document.querySelectorAll('.version-name')].some((e) => e.textContent === n), { timeout: 30000 }, name)
}

async function seek(page, t) {
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 1, { timeout: 15000 })
  await page.$eval('video', (v, t) => (v.currentTime = t), t)
  await page.waitForFunction((t) => Math.abs(document.querySelector('video').currentTime - t) < 0.2, {}, t)
}

// ---------- Owner: log in, create a project ----------
const owner = await newPage()
await owner.goto(BASE, { waitUntil: 'networkidle0' })
await owner.type('input[aria-label=PIN]', '0000')
await owner.keyboard.press('Enter')
await owner.waitForSelector('.error', { timeout: 5000 }).catch(() => null)
check((await text(owner)).includes('Wrong PIN'), 'wrong PIN is refused')
await owner.$eval('input[aria-label=PIN]', (e) => e.select())
await owner.keyboard.press('Backspace')
await owner.type('input[aria-label=PIN]', PIN)
await owner.keyboard.press('Enter')
await owner.waitForSelector('input[aria-label="Video title"]', { timeout: 10000 })
check((await text(owner)).includes('of 10 GB free storage used'), 'home shows the storage line')
await owner.type('input[aria-label="Video title"]', 'E2E: How to use Notion AI')
await clickText(owner, 'button', 'Create project')
await owner.waitForFunction(() => location.pathname.startsWith('/p/'), { timeout: 10000 })
const token = (await owner.evaluate(() => location.pathname)).split('/')[2]
check(token.length === 22, 'project gets a 22-letter secret link')
check((await text(owner)).includes('Copy editor link'), 'owner sees Copy editor link')

// ---------- Freelancer: open the link, bad files are refused ----------
const free = await newPage()
await free.goto(`${BASE}/p/${token}`, { waitUntil: 'networkidle0' })
let t = await text(free)
check(t.includes('E2E: How to use Notion AI') && /upload a new version/i.test(t), 'freelancer opens the project by link')
check(!t.includes('Copy editor link') && !t.includes('All projects'), 'freelancer sees no owner controls')

await upload(free, 'big-1080.mp4', 'too big')
check((await text(free)).includes('1920x1080'), '1080p file is refused with the reason')
check(await free.$eval('.upload-form .btn.primary', (b) => b.disabled), 'Upload button stays off for a refused file')
await upload(free, 'fat.mp4')
check((await text(free)).includes('the limit is'), 'over-limit file is refused with the limit')

// ---------- Upload v1, cut the internet on part 2, then Resume ----------
await free.setRequestInterception(true)
let blockPart2 = true
free.on('request', (r) => {
  if (blockPart2 && r.method() === 'PUT' && /\/parts\/2$/.test(r.url())) r.abort('internetdisconnected')
  else r.continue()
})
await upload(free, 'v1.mp4', 'v1 first cut')
await clickText(free, '.upload-form button', 'Upload')
await free.waitForFunction(() => document.body.innerText.includes('Upload stopped'), { timeout: 30000 })
check(true, 'a dropped connection stops the upload with a message')
await free.screenshot({ path: '.shots/freelancer-upload-stopped.png' })
blockPart2 = false
await clickText(free, 'button', 'Resume')
await waitVersion(free, 'v1 first cut')
check(true, 'Resume finishes the upload; v1 shows in Versions')

// Server-side checks from the freelancer's browser.
const api = await free.evaluate(async (tok) => {
  const p = await (await fetch(`/api/p/${tok}`)).json()
  const vid = p.versions[0].id
  const range = await fetch(`/api/p/${tok}/versions/${vid}/video`, { headers: { Range: 'bytes=0-99' } })
  const post = (u, b) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
  return {
    status: p.versions[0].status,
    range: range.status,
    rangeLen: (await range.arrayBuffer()).byteLength,
    note: (await post(`/api/p/${tok}/versions/${vid}/notes`, { t: 1, text: 'x' })).status,
    final: (await post(`/api/p/${tok}/final`, { version_id: vid })).status,
    home: (await fetch('/api/projects')).status,
    badLink: (await fetch('/api/p/AAAAAAAAAAAAAAAAAAAAAA')).status,
    hugeStart: (await post(`/api/p/${tok}/uploads`, { name: 'x', size: 900e6, duration: 60, width: 1280, height: 720, type: 'video/mp4' })).status,
  }
}, token)
check(api.status === 'ready', 'v1 is stored as ready')
check(api.range === 206 && api.rangeLen === 100, 'video streams in parts (Range 206)')
check(api.note === 401 && api.final === 401 && api.home === 401, 'freelancer cannot add notes, mark Final, or list projects')
check(api.badLink === 404, 'a wrong link gives 404')
check(api.hugeStart === 400, 'server refuses an over-limit upload even if the page is bypassed')

// ---------- Owner: watch v1, add notes ----------
await owner.reload({ waitUntil: 'networkidle0' })
await waitVersion(owner, 'v1 first cut')
await owner.waitForFunction(() => document.querySelector('video')?.duration > 59, { timeout: 15000 })
check(true, 'owner player loads the 60 s video')
await owner.$eval('video', (v) => v.play())
await sleep(1200)
check(await owner.$eval('video', (v) => v.currentTime > 0.5), 'video plays')
await seek(owner, 10)
await owner.click('textarea[aria-label=Note]')
await owner.type('textarea[aria-label=Note]', 'Intro is too slow, cut 2 seconds')
check(await owner.$eval('video', (v) => v.paused), 'typing a note pauses the video')
check((await text(owner)).includes('Note at 0:10.0'), 'note locks to 0:10.0')
const centerDot = await owner.$eval('[data-testid=dot-draft]', (d) => [d.style.left, d.style.top])
check(centerDot[0] === '50%' && centerDot[1] === '50%', 'dot sits in the center by default')
await owner.keyboard.press('Enter')
await owner.waitForFunction(() => document.querySelectorAll('[data-testid=note]').length === 1, { timeout: 10000 })
check(true, 'Enter saves note 1')

await seek(owner, 30)
const box = await (await owner.$('.frame')).boundingBox()
await owner.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.25)
const moved = await owner.$eval('[data-testid=dot-draft]', (d) => [parseFloat(d.style.left), parseFloat(d.style.top)])
check(Math.abs(moved[0] - 25) < 1 && Math.abs(moved[1] - 25) < 1, 'clicking the frame moves the dot to that spot')
check((await text(owner)).includes('Note at 0:30.0'), 'clicking the frame starts a note at 0:30.0')
await owner.type('textarea[aria-label=Note]', 'Point at this button')
await clickText(owner, 'button', 'Add note')
await owner.waitForFunction(() => document.querySelectorAll('[data-testid=note]').length === 2, { timeout: 10000 })
check(true, 'Add note saves note 2')
await owner.screenshot({ path: '.shots/owner-desktop.png' })

// ---------- Freelancer: sees the notes, jumps to them ----------
await free.reload({ waitUntil: 'networkidle0' })
await free.waitForFunction(() => document.querySelectorAll('[data-testid=note]').length === 2, { timeout: 10000 })
t = await text(free)
check(t.includes('Intro is too slow') && t.includes('Point at this button'), 'freelancer sees both notes')
check(!(await free.$('textarea[aria-label=Note]')) && !t.includes('Delete'), 'freelancer cannot write, edit or delete notes')
await free.waitForFunction(() => document.querySelector('video')?.readyState >= 1, { timeout: 15000 })
await clickText(free, '.note-body', 'Point at this button')
await free.waitForFunction(() => Math.abs(document.querySelector('video').currentTime - 30) < 0.2, { timeout: 5000 })
check(true, 'clicking a note jumps the video to 0:30')
await free.waitForSelector('[data-testid=dot-note]', { timeout: 5000 }).catch(() => null)
const nd = await free.$eval('[data-testid=dot-note]', (d) => [parseFloat(d.style.left), parseFloat(d.style.top)]).catch(() => null)
check(nd && Math.abs(nd[0] - 25) < 1 && Math.abs(nd[1] - 25) < 1, 'the note dot shows at the pinned spot')
await free.screenshot({ path: '.shots/freelancer-desktop.png' })

// ---------- More versions: only the 2 newest files stay ----------
await upload(free, 'v2.mp4', 'v2 intro fixed')
await clickText(free, '.upload-form button', 'Upload')
await waitVersion(free, 'v2 intro fixed')
await upload(free, 'v3.mp4', 'v3 music swapped')
await clickText(free, '.upload-form button', 'Upload')
await waitVersion(free, 'v3 music swapped')
const after3 = await free.evaluate(async (tok) => (await (await fetch(`/api/p/${tok}`)).json()).versions.map((v) => [v.name, v.status, v.notes.length]), token)
const byName = Object.fromEntries(after3.map(([n, s, c]) => [n, { s, c }]))
check(byName['v1 first cut'].s === 'removed', 'third upload removes the v1 file')
check(byName['v1 first cut'].c === 2, 'v1 notes stay after its file is removed')
check(byName['v2 intro fixed'].s === 'ready' && byName['v3 music swapped'].s === 'ready', 'v2 and v3 files stay')
await clickText(free, '.version', 'v1 first cut')
check((await text(free)).includes('was removed to save space'), 'a removed version says so and still lists notes')

// ---------- Owner: edit a note, mark v2 Final ----------
await owner.reload({ waitUntil: 'networkidle0' })
await clickText(owner, '.version', 'v1 first cut')
await clickText(owner, '.note-actions button', 'Edit')
await owner.$eval('textarea[aria-label="Edit note"]', (e) => e.select())
await owner.type('textarea[aria-label="Edit note"]', 'Intro is too slow, cut 3 seconds')
await clickText(owner, '.note-edit button', 'Save')
await owner.waitForFunction(() => document.body.innerText.includes('cut 3 seconds'), { timeout: 5000 })
check(true, 'owner edits a note')

await clickText(owner, '.version', 'v2 intro fixed')
await clickText(owner, 'button', 'as Final')
await owner.waitForFunction(() => document.body.innerText.includes('Final: v2 intro fixed'), { timeout: 10000 })
check(true, 'owner marks v2 Final')
const fin = await owner.evaluate(async (tok) => (await (await fetch(`/api/p/${tok}`)).json()).versions.map((v) => [v.name, v.status]), token)
check(fin.every(([n, s]) => (n === 'v2 intro fixed' ? s === 'ready' : s === 'removed')), 'Final keeps only the v2 file')

await free.reload({ waitUntil: 'networkidle0' })
t = await text(free)
check(t.includes('Please send the full-quality file'), 'freelancer sees the Final banner')
check(!/upload a new version/i.test(t), 'uploads close after Final')

// ---------- Home + phone width ----------
await owner.goto(BASE, { waitUntil: 'networkidle0' })
check(await owner.evaluate(() => [...document.querySelectorAll('.project-row')].some((r) => r.innerText.includes('E2E: How to use Notion AI') && r.innerText.includes('Final'))), 'home lists the project with a Final tag')
await owner.screenshot({ path: '.shots/home-desktop.png' })

for (const [who, page] of [['owner', owner], ['freelancer', free]]) {
  await page.setViewport({ width: 390, height: 844 })
  await page.goto(`${BASE}/p/${token}`, { waitUntil: 'networkidle0' })
  check(await noSideScroll(page), `${who} project page has no side scroll at phone width`)
  await page.screenshot({ path: `.shots/${who}-phone.png`, fullPage: true })
}

// ---------- Clean up ----------
await owner.setViewport({ width: 1440, height: 900 })
await clickText(owner, 'button', 'Delete project')
await owner.waitForFunction(() => location.pathname === '/', { timeout: 10000 })
check((await owner.evaluate(async (tok) => (await fetch(`/api/p/${tok}`)).status, token)) === 404, 'deleting the project removes it')

check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`)
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED')
process.exit(failed ? 1 : 0)
