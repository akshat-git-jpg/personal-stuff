#!/usr/bin/env node
// Push one blood report (JSON + optional PDF) to kushal-health, or print the history.
//
//   node scripts/push-report.mjs --history
//   node scripts/push-report.mjs <report.json> [<report.pdf>]
//
// Config: apps/kushal-health/.ingest.env (KEY="value" lines); env vars override it.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const envFile = resolve(here, '..', '.ingest.env')

function loadConfig() {
  const cfg = {}
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/)
      if (m) cfg[m[1]] = m[2]
    }
  }
  for (const k of ['KUSHAL_HEALTH_URL', 'KUSHAL_HEALTH_INGEST_TOKEN']) {
    if (process.env[k] !== undefined) cfg[k] = process.env[k]
  }
  if (!cfg.KUSHAL_HEALTH_URL || !cfg.KUSHAL_HEALTH_INGEST_TOKEN) {
    console.error('missing KUSHAL_HEALTH_URL or KUSHAL_HEALTH_INGEST_TOKEN (see .ingest.env.example)')
    process.exit(2)
  }
  return { base: cfg.KUSHAL_HEALTH_URL.replace(/\/+$/, ''), token: cfg.KUSHAL_HEALTH_INGEST_TOKEN }
}

async function call(cfg, method, path, body, contentType) {
  const res = await fetch(cfg.base + path, {
    method,
    headers: { Authorization: `Bearer ${cfg.token}`, ...(contentType ? { 'content-type': contentType } : {}) },
    body,
  })
  const text = await res.text()
  if (!res.ok) {
    console.error(`${method} ${path} -> ${res.status}: ${text}`)
    process.exit(1)
  }
  return text
}

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('usage: push-report.mjs --history | <report.json> [<report.pdf>]')
  process.exit(2)
}
const cfg = loadConfig()

if (args[0] === '--history') {
  process.stdout.write((await call(cfg, 'GET', '/api/blood')) + '\n')
} else {
  const json = readFileSync(args[0], 'utf8')
  const id = JSON.parse(json).report?.id
  const out = JSON.parse(await call(cfg, 'POST', '/api/reports', json, 'application/json'))
  console.log(`pushed ${out.report_id}: ${out.results} results`)
  if (args[1]) {
    await call(cfg, 'PUT', `/api/reports/${encodeURIComponent(id)}/pdf`, readFileSync(args[1]), 'application/pdf')
    console.log('pdf stored')
  }
}
