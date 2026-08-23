#!/usr/bin/env node
// The ui:true merge gate AND the behaviour gate for Plan 237.
//
// Seeds the LOCAL D1 with a deterministic fixture (one task per bucket, two
// daily habits, a 6-day streak ending yesterday), starts the vite dev server
// — which the @cloudflare/vite-plugin backs with the real Worker + local D1 —
// logs in through the PIN gate, then asserts the redesign's actual behaviour
// before writing the screenshots.
//
// Every write stays inside this app directory. Teardown is guaranteed in
// `finally` so a failed assertion never leaves the dev server running.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = join(HERE, '..')
const WEB_PORT = 4174
const PIN = '424242'
const SECRET = 'shot-secret-0123456789-0123456789'

/** A leased worktree has no .dev.vars (it is gitignored), which is exactly how
 *  this gate used to fail: the PIN gate could not be passed and every shot came
 *  back blank. Write a local-only one when it is absent. */
function ensureDevVars() {
  const p = join(APP_ROOT, '.dev.vars')
  if (existsSync(p)) return
  writeFileSync(p, `APP_PIN=${PIN}\nSESSION_SECRET=${SECRET}\n`)
  console.log('shot: wrote a local .dev.vars (was absent)')
}

function readPin() {
  // Respect an existing .dev.vars so a developer's own PIN keeps working.
  const p = join(APP_ROOT, '.dev.vars')
  const txt = existsSync(p) ? String(spawnSync('cat', [p]).stdout) : ''
  const m = txt.match(/^APP_PIN=(.*)$/m)
  return m ? m[1].trim() : PIN
}

function d1(sql) {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'founders-db', '--local', '--command', sql], {
    cwd: APP_ROOT, stdio: ['ignore', 'pipe', 'inherit'],
  })
  if (r.status !== 0) throw new Error(`d1 failed: ${sql.slice(0, 80)}`)
}

function ymd(offsetDays) {
  const t = new Date()
  t.setUTCHours(12, 0, 0, 0)
  t.setUTCDate(t.getUTCDate() + offsetDays)
  return t.toISOString().slice(0, 10)
}

function seed() {
  console.log('shot: applying schema…')
  const schema = spawnSync('npm', ['run', 'db:local'], { cwd: APP_ROOT, stdio: 'inherit' })
  if (schema.status !== 0) throw new Error('db:local failed')

  console.log('shot: seeding fixture…')
  d1('DELETE FROM habit_logs')
  d1('DELETE FROM tasks')
  d1('DELETE FROM recurring_templates')

  const now = new Date().toISOString()
  // due_day for the monthly template is TODAY's day-of-month, not a fixed 1: the
  // Worker's catch-up generator (src/worker/recurring.ts) materializes a real,
  // dated task for any active monthly template on load. A fixed due_day=1 would
  // make that generated task land in Overdue on every day but the 1st of the
  // month, silently inflating the overdue count this script asserts below.
  // Anchoring due_day to today keeps the generated task in the Today bucket,
  // deterministically, on any day the shot runs.
  const monthlyDueDay = new Date().getUTCDate()
  d1(`INSERT INTO recurring_templates (id, title, owner, notes, cadence, due_day, active, created_at) VALUES
      (1, 'Knowledge gain', 'khushi', NULL, 'daily', 1, 1, '${now}'),
      (2, 'Video editing skill improvement', 'khushi', NULL, 'daily', 1, 1, '${now}'),
      (3, 'Revenue and cost sheet', 'khushi', NULL, 'monthly', ${monthlyDueDay}, 1, '${now}')`)

  // Template 1: kept the six days ending YESTERDAY, today still open -> the
  // grace rule means the strip shows 6 and a tick must take it to 7.
  const days = [6, 5, 4, 3, 2, 1].map((n) => `(1, '${ymd(-n)}', '${now}')`).join(',')
  d1(`INSERT INTO habit_logs (template_id, anchor_ymd, done_at) VALUES ${days}`)

  const rows = [
    ['Video Editor - hiring closure and work started', 'khushi', ymd(-40), 1],
    ['3 tools money pending payment - action plan', 'khushi', ymd(-37), 2],
    ['Ship the founders ledger redesign', 'khushi', ymd(0), 3],
    ['Recordly - used by tutorial makers', 'khushi', ymd(3), 4],
    ['Quarterly hiring plan', 'khushi', ymd(20), 5],
    ['Revenue/pricing automation', 'kushal', ymd(-5), 6],
  ]
  const values = rows
    .map(([t, o, e, s]) => `('${t}', '${o}', '${e}', 'open', ${s}, '${now}')`)
    .join(',')
  d1(`INSERT INTO tasks (title, owner, eta, status, sort_order, created_at) VALUES ${values}`)
  // One undated task, and one done task so the Done section renders.
  d1(`INSERT INTO tasks (title, owner, eta, status, sort_order, created_at) VALUES
      ('Decide the pricing tiers', 'khushi', NULL, 'open', 9999999, '${now}')`)
  d1(`INSERT INTO tasks (title, owner, eta, status, sort_order, created_at, completed_at) VALUES
      ('Set up the shared inbox', 'khushi', '${ymd(-9)}', 'done', 1, '${now}', '${now}')`)
}

function waitForPort(port, path = '/') {
  const deadline = Date.now() + 60_000
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      fetch(`http://localhost:${port}${path}`)
        .then(() => resolve())
        .catch((err) => {
          if (Date.now() > deadline) return reject(err)
          setTimeout(tryOnce, 400)
        })
    }
    tryOnce()
  })
}

async function main() {
  mkdirSync(join(APP_ROOT, 'docs', 'shots'), { recursive: true })
  ensureDevVars()
  seed()

  const dev = spawn('npx', ['vite'], {
    cwd: APP_ROOT, stdio: 'inherit',
    env: { ...process.env, WEB_PORT: String(WEB_PORT) },
  })

  let browser
  try {
    await waitForPort(WEB_PORT, '/login')

    browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 900, height: 1500 } })

    // ---- PIN gate
    await page.goto(`http://localhost:${WEB_PORT}/login`)
    await page.fill('input[name="pin"]', readPin())
    await page.click('button[type="submit"]')
    await page.waitForSelector('.habit-strip', { timeout: 20_000 })

    // ---- Behaviour: the Today strip lists both active habits, not the monthly one
    const habitRows = page.locator('.habit-strip .habit-row')
    const habitCount = await habitRows.count()
    if (habitCount !== 2) throw new Error(`expected 2 habit rows, got ${habitCount}`)

    // ---- Behaviour: groups render in BUCKET_ORDER, empty ones dropped
    const heads = await page.locator('.bucket-head').allTextContents()
    const labels = heads.map((h) => h.replace(/\s*\d+\s*$/, '').trim())
    const expected = ['Overdue', 'Today', 'This week', 'Later', 'No date']
    if (JSON.stringify(labels) !== JSON.stringify(expected)) {
      throw new Error(`bucket order wrong: ${JSON.stringify(labels)}`)
    }
    const overdueCount = await page.locator('[data-bucket="overdue"] .card.row').count()
    if (overdueCount !== 2) throw new Error(`expected 2 overdue rows, got ${overdueCount}`)

    // ---- Behaviour: the old progress bar is gone for good
    const bars = await page.locator('.card.row .bar').count()
    if (bars !== 0) throw new Error(`the deadline progress bar is still rendering (${bars} found)`)

    await page.screenshot({ path: join(APP_ROOT, 'docs', 'shots', 'tracker.png'), fullPage: true })
    console.log('shot: wrote docs/shots/tracker.png')

    // ---- Behaviour: ticking a habit advances the streak and creates NO task
    const before = await page.locator('.card.row').count()
    const first = habitRows.first()
    const streakBefore = (await first.locator('.streak').textContent())?.trim()
    if (streakBefore !== '6d') throw new Error(`expected a 6d streak before the tick, got ${streakBefore}`)

    await first.locator('.check').click()
    await page.waitForFunction(
      () => document.querySelector('.habit-strip .habit-row .streak')?.textContent?.trim() === '7d',
      undefined, { timeout: 20_000 },
    )
    const kept = await page.locator('.habit-strip .habit-row').first().getAttribute('class')
    if (!kept?.includes('kept')) throw new Error('the ticked habit row did not get the .kept class')

    const after = await page.locator('.card.row').count()
    if (after !== before) {
      throw new Error(`ticking a habit changed the task count ${before} -> ${after}; habits must never create tasks`)
    }

    await page.screenshot({ path: join(APP_ROOT, 'docs', 'shots', 'habit-ticked.png'), fullPage: true })
    console.log('shot: wrote docs/shots/habit-ticked.png')
  } finally {
    if (browser) await browser.close()
    dev.kill('SIGTERM')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
