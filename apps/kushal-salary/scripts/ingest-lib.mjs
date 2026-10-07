// Shared config + HTTP for push-month.mjs and push-note.mjs.
// Config: apps/kushal-salary/.ingest.env (KEY="value" lines); env vars override it.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const envFile = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.ingest.env')

export function loadConfig() {
  const cfg = {}
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/)
      if (m) cfg[m[1]] = m[2]
    }
  }
  for (const k of ['KUSHAL_SALARY_URL', 'KUSHAL_SALARY_INGEST_TOKEN']) {
    if (process.env[k] !== undefined) cfg[k] = process.env[k]
  }
  if (!cfg.KUSHAL_SALARY_URL || !cfg.KUSHAL_SALARY_INGEST_TOKEN) {
    console.error('missing KUSHAL_SALARY_URL or KUSHAL_SALARY_INGEST_TOKEN (see .ingest.env.example)')
    process.exit(2)
  }
  return { base: cfg.KUSHAL_SALARY_URL.replace(/\/+$/, ''), token: cfg.KUSHAL_SALARY_INGEST_TOKEN }
}

export async function call(cfg, method, path, body, contentType = 'application/json') {
  const res = await fetch(cfg.base + path, {
    method,
    headers: { Authorization: `Bearer ${cfg.token}`, ...(body ? { 'Content-Type': contentType } : {}) },
    body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body,
  })
  const text = await res.text()
  if (!res.ok) {
    console.error(`${method} ${path} -> ${res.status} ${text}`)
    process.exit(1)
  }
  return text ? JSON.parse(text) : {}
}

export const putPdf = (cfg, path, file) => call(cfg, 'PUT', path, readFileSync(file), 'application/pdf')
