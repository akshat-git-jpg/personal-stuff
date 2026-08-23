#!/usr/bin/env node
// Zero-dependency local backend for the script desk. Reads outline.md through
// plan 231's buildBeats() and persists the maker's typed answers to
// videos/<key>/desk-draft.json. Plan 234's Cloudflare Worker serves the same
// contract (src/api.ts) in production — keep both in sync.

import { createServer } from 'node:http'
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBeats } from '../../../pipelines/youtube/yt-script/lib/beats.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.API_PORT) || 4327
const VIDEOS_ROOT = resolve(HERE, '..', '..', '..', 'pipelines', 'youtube', 'yt-script', 'videos')

if (!existsSync(VIDEOS_ROOT)) {
  console.error(`script-desk: no videos root at ${VIDEOS_ROOT} — is pipelines/youtube/yt-script present?`)
  process.exit(1)
}

// Reject any key with a path-traversal or separator character before it ever
// touches the filesystem. Never join an unsanitised key into a path.
const KEY_RE = /^[^/\\]+$/
function isSafeKey(key) {
  return typeof key === 'string' && key.length > 0 && KEY_RE.test(key) && !key.includes('..')
}

function draftPath(key) {
  return join(VIDEOS_ROOT, key, 'desk-draft.json')
}

function outlinePath(key) {
  return join(VIDEOS_ROOT, key, 'outline.md')
}

function readDraft(key) {
  const p = draftPath(key)
  if (!existsSync(p)) return { draft: {}, says: {}, edits: {}, finished: false }
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'))
    return {
      draft: raw.draft ?? {},
      says: raw.says ?? {},
      edits: raw.edits ?? {},
      finished: raw.finished ?? false,
    }
  } catch {
    return { draft: {}, says: {}, edits: {}, finished: false }
  }
}

// Atomic write: write to a .tmp sibling, then rename over the real file.
function writeDraft(key, data) {
  const p = draftPath(key)
  const tmp = `${p}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n')
  renameSync(tmp, p)
}

function buildVideoDoc(key) {
  const outPath = outlinePath(key)
  if (!existsSync(outPath)) return null
  const md = readFileSync(outPath, 'utf8')
  const { title, beats } = buildBeats(md)
  const doc = readDraft(key)
  // Apply any edited spoken lines on top of the parsed beats before returning.
  const beatsWithSays = beats.map((b) =>
    doc.says[b.num] ? { ...b, say: doc.says[b.num] } : b,
  )
  return {
    key,
    title,
    beats: beatsWithSays,
    draft: doc.draft,
    edits: doc.edits,
    says: doc.says,
    finished: doc.finished,
  }
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) })
  res.end(text)
}

function readBody(req) {
  return new Promise((resolve_, reject) => {
    let chunks = ''
    req.on('data', (c) => (chunks += c))
    req.on('end', () => {
      if (!chunks) return resolve_({})
      try {
        resolve_(JSON.parse(chunks))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`)
    const key = url.searchParams.get('key')

    // GET /api/video?key=<key>
    if (req.method === 'GET' && url.pathname === '/api/video') {
      if (!isSafeKey(key)) return sendJson(res, 400, { error: 'invalid key' })
      const doc = buildVideoDoc(key)
      if (!doc) return sendJson(res, 404, { error: `no outline for ${key}` })
      return sendJson(res, 200, doc)
    }

    // PUT /api/beat/:num?key=<key>
    const beatMatch = url.pathname.match(/^\/api\/beat\/([^/]+)$/)
    if (req.method === 'PUT' && beatMatch) {
      if (!isSafeKey(key)) return sendJson(res, 400, { error: 'invalid key' })
      const num = decodeURIComponent(beatMatch[1])
      const body = await readBody(req)
      const doc = readDraft(key)
      doc.draft[num] = body.text ?? ''
      writeDraft(key, doc)
      return sendJson(res, 200, { ok: true, savedAt: new Date().toISOString() })
    }

    // PUT /api/beat/:num/say?key=<key>
    const sayMatch = url.pathname.match(/^\/api\/beat\/([^/]+)\/say$/)
    if (req.method === 'PUT' && sayMatch) {
      if (!isSafeKey(key)) return sendJson(res, 400, { error: 'invalid key' })
      const num = decodeURIComponent(sayMatch[1])
      const body = await readBody(req)
      const lines = Array.isArray(body.lines) ? body.lines : []
      const doc = readDraft(key)
      // The first edit captures the original; a later edit leaves it alone —
      // the original is the FIRST version, never the previous one.
      if (!doc.edits[num]) {
        const outPath = outlinePath(key)
        const { beats } = buildBeats(readFileSync(outPath, 'utf8'))
        const beat = beats.find((b) => b.num === num)
        doc.edits[num] = { original: beat?.say ?? [], at: new Date().toISOString() }
      }
      doc.says[num] = lines
      writeDraft(key, doc)
      return sendJson(res, 200, { ok: true, savedAt: new Date().toISOString() })
    }

    // POST /api/beat/:num/restore?key=<key>
    const restoreMatch = url.pathname.match(/^\/api\/beat\/([^/]+)\/restore$/)
    if (req.method === 'POST' && restoreMatch) {
      if (!isSafeKey(key)) return sendJson(res, 400, { error: 'invalid key' })
      const num = decodeURIComponent(restoreMatch[1])
      const doc = readDraft(key)
      delete doc.says[num]
      delete doc.edits[num]
      writeDraft(key, doc)
      const outPath = outlinePath(key)
      const { beats } = buildBeats(readFileSync(outPath, 'utf8'))
      const beat = beats.find((b) => b.num === num)
      return sendJson(res, 200, { lines: beat?.say ?? [] })
    }

    sendJson(res, 404, { error: 'not found' })
  } catch (err) {
    sendJson(res, 500, { error: String(err?.message ?? err) })
  }
})

server.listen(PORT, () => {
  console.log(`script-desk local api on http://localhost:${PORT}`)
})
