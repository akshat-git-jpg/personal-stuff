#!/usr/bin/env node
// Captures the write view and the confirm dialog for the ui:true merge gate.
// Starts the local api + a vite preview server, drives them with Playwright,
// and guarantees teardown in `finally` so a failed assertion never leaves the
// runner alive.

import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = join(HERE, '..')
const API_PORT = 4327
const WEB_PORT = 4173
const KEY = 'character-consistency-ai'

function waitForPort(port, path = '/') {
  const deadline = Date.now() + 30_000
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      fetch(`http://localhost:${port}${path}`)
        .then(() => resolve())
        .catch((err) => {
          if (Date.now() > deadline) return reject(err)
          setTimeout(tryOnce, 300)
        })
    }
    tryOnce()
  })
}

function spawnProc(cmd, args, opts) {
  return spawn(cmd, args, { cwd: APP_ROOT, stdio: 'inherit', ...opts })
}

async function main() {
  mkdirSync(join(APP_ROOT, 'docs', 'shots'), { recursive: true })

  console.log('shot: building…')
  await new Promise((resolve, reject) => {
    const build = spawnProc('npm', ['run', 'build'])
    build.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`build exited ${code}`))))
  })

  const apiProc = spawnProc('node', ['server/local.mjs'], { env: { ...process.env, API_PORT: String(API_PORT) } })
  const previewProc = spawnProc('npx', ['vite', 'preview', '--port', String(WEB_PORT), '--strictPort'])

  let browser
  try {
    await waitForPort(API_PORT, `/api/video?key=${KEY}`)
    await waitForPort(WEB_PORT, '/')

    browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } })
    await page.goto(`http://localhost:${WEB_PORT}/?key=${KEY}`)
    await page.waitForSelector('.tracks', { timeout: 15_000 })

    await page.screenshot({ path: join(APP_ROOT, 'docs', 'shots', 'write-view.png'), fullPage: true })
    console.log('shot: wrote docs/shots/write-view.png')

    await page.locator('.say-edit-btn').first().click()
    await page.waitForSelector('[role="alertdialog"]', { timeout: 5_000 })
    await page.screenshot({ path: join(APP_ROOT, 'docs', 'shots', 'confirm-dialog.png') })
    console.log('shot: wrote docs/shots/confirm-dialog.png')
  } finally {
    if (browser) await browser.close()
    apiProc.kill()
    previewProc.kill()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
