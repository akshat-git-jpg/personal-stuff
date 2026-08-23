#!/usr/bin/env node
// Zero-dependency CLI for the hosted script desk (plan 234).
//
//   node bin/desk.mjs publish <key> [--base https://script-desk.agrolloo.com]
//   node bin/desk.mjs pull    <key> [--base ...]
//   node bin/desk.mjs pull    --fixture <file.json> --out <file.md>   # offline, for tests
//
// The direction of truth: outline.md in git is upstream, D1 is a copy,
// script-draft.md is the record that comes back. `publish` reads the local
// outline, mints/reuses a link and pushes a snapshot. `pull` brings the
// maker's answers back down and writes videos/<key>/script-draft.md in the
// exact markdown shape step 3 of the yt-script skill reads.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBeats } from '../../../pipelines/youtube/yt-script/lib/beats.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const VIDEOS_ROOT = resolve(HERE, '..', '..', '..', 'pipelines', 'youtube', 'yt-script', 'videos')
const DEFAULT_BASE = 'https://script-desk.agrolloo.com'

// Reject any key with a path-traversal or separator character before it ever
// touches the filesystem, same rule as server/local.mjs.
const KEY_RE = /^[^/\\]+$/
function isSafeKey(key) {
  return typeof key === 'string' && key.length > 0 && KEY_RE.test(key) && !key.includes('..')
}

function outlinePath(key) {
  return join(VIDEOS_ROOT, key, 'outline.md')
}

function draftOutPath(key) {
  return join(VIDEOS_ROOT, key, 'script-draft.md')
}

// ------------------------------------------------------------ the emitter

// Resolution order for a beat's spoken text, matching the UI and both
// backends: an edited override, then the original spoken copy, then the
// maker's own typed answer (split into lines).
export function resolveLines(beat, draft, says) {
  if (says[beat.num] && says[beat.num].length > 0) return says[beat.num]
  if (beat.say && beat.say.length > 0) return beat.say
  const text = draft[beat.num]
  if (typeof text === 'string' && text.trim().length > 0) return text.split('\n')
  return null
}

// Pure: {title, beats, draft, says, edits, pulledAt} -> markdown text + the
// list of beats whose locked copy was edited (for the stderr report).
// This is the contract with step 3 of the yt-script skill — see
// test/fixtures/expected-draft.md and pipelines/.claude/skills/yt-script.
export function emitDraft({ title, beats, draft = {}, says = {}, edits = {}, pulledAt }) {
  const out = []
  const printedParts = new Set()
  const edited = []

  out.push(`# ${title} — script draft`)
  out.push('')
  out.push(`<!-- pulled from the script desk on ${pulledAt}. His words, verbatim. -->`)
  out.push('')

  for (const beat of beats) {
    if (beat.part && !printedParts.has(beat.part)) {
      printedParts.add(beat.part)
      out.push(`## PART ${beat.part}`)
      out.push('')
    }

    out.push(`#### ${beat.num} · ${beat.title}`)
    out.push('')

    const edit = edits[beat.num]
    if (edit) {
      const originalFirst = edit.original?.[0] ?? ''
      out.push(`<!-- edited by the maker; original: "${originalFirst}" -->`)
      edited.push({ num: beat.num, title: beat.title })
    }

    const lines = resolveLines(beat, draft, says)
    if (lines === null) {
      out.push('> [not written]')
    } else {
      for (const line of lines) out.push(line === '' ? '>' : `> ${line}`)
    }

    out.push('')
  }

  while (out.length && out[out.length - 1] === '') out.pop()
  return { markdown: out.join('\n') + '\n', edited }
}

// ------------------------------------------------------------ networking

function adminHeaders() {
  const token = process.env.DESK_ADMIN_TOKEN
  if (!token) {
    console.error('desk.mjs: DESK_ADMIN_TOKEN is not set. Export it — never write it to a tracked file.')
    process.exit(1)
  }
  return { 'x-desk-admin': token, 'Content-Type': 'application/json' }
}

async function readJsonOrThrow(res, label) {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${label} -> ${res.status}: ${text}`)
  }
  return res.json()
}

// ------------------------------------------------------------ commands

async function cmdPublish(key, base) {
  if (!isSafeKey(key)) {
    console.error(`desk.mjs: invalid key ${JSON.stringify(key)}`)
    process.exit(1)
  }
  const outlineFile = outlinePath(key)
  if (!existsSync(outlineFile)) {
    console.error(`desk.mjs: no outline at ${outlineFile}`)
    process.exit(1)
  }
  const { title, beats } = buildBeats(readFileSync(outlineFile, 'utf8'))
  const res = await fetch(`${base}/api/admin/publish`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ key, title, beats }),
  })
  const body = await readJsonOrThrow(res, 'POST /api/admin/publish')
  // Nothing else on stdout, so this can be piped.
  process.stdout.write(`${body.url}\n`)
}

async function cmdPull(key, { base, fixturePath, outPath, force }) {
  let merged
  let targetPath

  if (fixturePath) {
    merged = JSON.parse(readFileSync(resolve(fixturePath), 'utf8'))
    targetPath = outPath ? resolve(outPath) : null
  } else {
    if (!isSafeKey(key)) {
      console.error(`desk.mjs: invalid key ${JSON.stringify(key)}`)
      process.exit(1)
    }
    const outlineFile = outlinePath(key)
    if (!existsSync(outlineFile)) {
      console.error(`desk.mjs: no outline at ${outlineFile}`)
      process.exit(1)
    }
    // Beat order and titles come from the local outline, not from the D1
    // snapshot — the file is upstream, D1 is a copy.
    const { title, beats } = buildBeats(readFileSync(outlineFile, 'utf8'))
    const res = await fetch(`${base}/api/admin/pull?key=${encodeURIComponent(key)}`, { headers: adminHeaders() })
    const pulled = await readJsonOrThrow(res, 'GET /api/admin/pull')
    merged = {
      title,
      beats,
      draft: pulled.draft,
      says: pulled.says,
      edits: pulled.edits,
      pulledAt: new Date().toISOString(),
    }
    targetPath = outPath ? resolve(outPath) : draftOutPath(key)
  }

  if (!targetPath) {
    console.error('desk.mjs: pull --fixture needs --out <file.md>')
    process.exit(1)
  }
  if (!merged.pulledAt) merged.pulledAt = new Date().toISOString()

  // script-draft.md is the team member's verbatim record — never clobber it.
  if (existsSync(targetPath) && !force) {
    console.error(`desk.mjs: ${targetPath} already exists — his verbatim record. Pass --force to overwrite.`)
    process.exit(1)
  }

  const { markdown, edited } = emitDraft(merged)
  writeFileSync(targetPath, markdown)
  for (const e of edited) console.error(`edited ${e.num} · ${e.title}`)
}

// ------------------------------------------------------------ CLI plumbing

function parseArgs(argv) {
  const args = { base: DEFAULT_BASE, force: false }
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--base') args.base = argv[++i]
    else if (a === '--fixture') args.fixture = argv[++i]
    else if (a === '--out') args.out = argv[++i]
    else if (a === '--force') args.force = true
    else positional.push(a)
  }
  return { positional, ...args }
}

async function main(argv) {
  const [cmd, ...rest] = argv
  const { positional, base, fixture, out, force } = parseArgs(rest)
  const key = positional[0]

  if (cmd === 'publish') {
    if (!key) {
      console.error('usage: node bin/desk.mjs publish <key> [--base https://script-desk.agrolloo.com]')
      process.exit(1)
    }
    return cmdPublish(key, base)
  }

  if (cmd === 'pull') {
    if (!key && !fixture) {
      console.error('usage: node bin/desk.mjs pull <key> [--base ...] | --fixture <file.json> --out <file.md>')
      process.exit(1)
    }
    return cmdPull(key, { base, fixturePath: fixture, outPath: out, force })
  }

  console.error('usage: node bin/desk.mjs <publish|pull> ...')
  process.exit(1)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(String(err?.message ?? err))
    process.exit(1)
  })
}
