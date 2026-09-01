#!/usr/bin/env node
// Zero-dependency local backend for the script desk. Reads script-plan.md through
// plan 231's buildBeats() and persists the maker's typed answers to
// videos/<key>/desk-draft.json. Plan 234's Cloudflare Worker serves the same
// contract (src/api.ts) in production — keep both in sync.

import { createServer } from 'node:http'
import { readFileSync, writeFileSync, renameSync, existsSync, statSync, copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBeats, buildEditModel } from '../../../pipelines/youtube/yt-script/lib/beats.mjs'
import { effectiveBeats, fingerprint, approvalState, plannedNotes } from '../lib/approval.mjs'

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
  return join(VIDEOS_ROOT, key, 'script-plan.md')
}

// `notes` and `noteEdits` are STAGED instruction edits. Added 2026-08-29.
//
// Editing a note in the browser does NOT rewrite `script-plan.md`. Owner: *"can
// we do commit in 1 go. i will edit wherever required and tell you once all are
// reviewed and done. then you can update/edit in 1 go."* So an edit lands here,
// in the gitignored scratch file, and `bin/desk.mjs apply` splices every staged
// edit into the markdown in one pass when he says he is done.
//
// It mirrors `says`/`edits` exactly, which have worked this way for spoken copy
// since the desk existed: the current text in one map, the FIRST original in the
// other, so a restore always goes back to what the plan said rather than to the
// previous edit.
const EMPTY_DRAFT = () => ({ draft: {}, says: {}, edits: {}, notes: {}, noteEdits: {}, approved: null, finished: false })

function readDraft(key) {
  const p = draftPath(key)
  if (!existsSync(p)) return EMPTY_DRAFT()
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'))
    return {
      draft: raw.draft ?? {},
      says: raw.says ?? {},
      edits: raw.edits ?? {},
      notes: raw.notes ?? {},
      noteEdits: raw.noteEdits ?? {},
      approved: raw.approved ?? null,
      finished: raw.finished ?? false,
    }
  } catch {
    return EMPTY_DRAFT()
  }
}

// Atomic write: write to a .tmp sibling, then rename over the real file.
// APPROVAL IS OF A SPECIFIC SCRIPT, so any edit voids it. This runs on every write:
// the moment the owner changes a note, a spoken line or the file itself, the sign-off
// he gave for the previous version is dropped and the Approve button comes back.
//
// The publish gate would catch a stale approval anyway — it recomputes the fingerprint
// — but catching it here is what makes the desk HONEST while he is still looking at it,
// rather than at the point of no return.
//
// It is a property of `writeDraft` ITSELF rather than a call each route remembers to
// make, so a mutating route added later cannot forget it. `writeApproval` is the one
// deliberate exception, and it is the route that records the sign-off.
function writeDraftRaw(key, data) {
  const p = draftPath(key)
  const tmp = `${p}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n')
  renameSync(tmp, p)
}

function writeDraft(key, data) {
  writeDraftRaw(key, { ...data, approved: null })
}

function writeApproval(key, data, approved) {
  writeDraftRaw(key, { ...data, approved })
}

// A save that changes nothing must stage nothing.
//
// Every box on the local desk is live, so simply clicking through the page blurs
// each one in turn and every blur used to stage an identical "edit". The owner's
// first pass produced four staged items, three of which were byte-identical to
// the file. A review list you have to read to find out it says nothing is worse
// than no review list.
//
// It also does the right thing in the other direction: typing a change and then
// undoing it by hand un-stages, because the text matches the file again.
function sameLines(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((l, i) => l === b[i])
}

// The instruction box is a MERGE of five lanes, and `apply` plus the publish gate have
// to fold it exactly the way this server renders it. That rule now lives in ONE place,
// lib/approval.mjs, imported here and by bin/desk.mjs. The client half is
// src/lib/lanes.ts. It was written out three times until 2026-09-01, when only two of
// the three copies got fixed and the instruction box grew by a copy on every save.

function buildVideoDoc(key) {
  const outPath = outlinePath(key)
  if (!existsSync(outPath)) return null
  const md = readFileSync(outPath, 'utf8')
  const { title, beats } = buildBeats(md)
  const doc = readDraft(key)
  // Apply any staged edits on top of the parsed beats before returning: edited
  // spoken lines, and edited instruction notes.
  const beatsWithEdits = effectiveBeats(beats, doc)
  // The desk shows whether the plan on screen is the one the owner signed off. It is
  // recomputed on every read rather than trusted from the file, so an edit made in his
  // editor — outside the desk entirely — shows up as a stale approval too.
  const approval = approvalState(doc.approved, fingerprint(title, beatsWithEdits))
  return {
    key,
    title,
    approval,
    beats: beatsWithEdits,
    draft: doc.draft,
    edits: doc.edits,
    says: doc.says,
    notes: doc.notes,
    noteEdits: doc.noteEdits,
    finished: doc.finished,
  }
}

// ---------------------------------------------------------------- edit mode
//
// The desk's edit mode writes `script-plan.md` itself. That is the whole point
// — no second copy, no sync — and it is also why these three guards exist.
// Added 2026-08-28.

// 1. NEVER WRITE MARKDOWN THAT DOES NOT PARSE. The owner can delete a heading by
//    accident, and a plan the parser refuses is a page that renders nothing. The
//    incoming text is parsed BEFORE it goes anywhere near the disk; if it throws
//    the write is refused and the browser keeps his text so he can fix it.
function validatePlan(text) {
  try {
    const { title, beats } = buildBeats(text)
    if (!beats.length) return { ok: false, error: 'that leaves the plan with no beats at all' }
    return { ok: true, title, beats, edit: buildEditModel(text) }
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err) }
  }
}

// 2. NEVER CLOBBER AN EDIT MADE SOMEWHERE ELSE. He may have the same file open in
//    his editor. The browser sends back the mtime it loaded; if the file on disk
//    has moved on since, the save is refused rather than silently winning.
function planStamp(key) {
  const p = outlinePath(key)
  return existsSync(p) ? String(statSync(p).mtimeMs) : null
}

// 3. KEEP THE LAST GOOD VERSION. Every write copies the current file into
//    `.desk-backups/` first, newest last. A splice bug that eats a section is
//    invisible until he scrolls to it, and `script-plan.md` is hours of work.
function backupPlan(key) {
  const src = outlinePath(key)
  if (!existsSync(src)) return
  const dir = join(VIDEOS_ROOT, key, '.desk-backups')
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  copyFileSync(src, join(dir, `script-plan.${stamp}.md`))
}

function writePlan(key, text) {
  const p = outlinePath(key)
  const tmp = `${p}.tmp`
  writeFileSync(tmp, text)
  renameSync(tmp, p)
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
      if (doc.finished) return sendJson(res, 409, { error: 'finished' })
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
      if (doc.finished) return sendJson(res, 409, { error: 'finished' })
      const planned = buildBeats(readFileSync(outlinePath(key), 'utf8')).beats.find(
        (b) => b.num === num,
      )
      if (sameLines(lines, planned?.say ?? [])) {
        delete doc.says[num]
        delete doc.edits[num]
        writeDraft(key, doc)
        return sendJson(res, 200, { ok: true, savedAt: new Date().toISOString(), staged: false })
      }
      // The first edit captures the original; a later edit leaves it alone —
      // the original is the FIRST version, never the previous one.
      if (!doc.edits[num]) {
        doc.edits[num] = { original: planned?.say ?? [], at: new Date().toISOString() }
      }
      doc.says[num] = lines
      writeDraft(key, doc)
      return sendJson(res, 200, { ok: true, savedAt: new Date().toISOString() })
    }

    // PUT /api/beat/:num/notes?key=<key> — a STAGED instruction edit. It does not
    // touch script-plan.md; `bin/desk.mjs apply` does that, in one pass, later.
    const notesMatch = url.pathname.match(/^\/api\/beat\/([^/]+)\/notes$/)
    if (req.method === 'PUT' && notesMatch) {
      if (!isSafeKey(key)) return sendJson(res, 400, { error: 'invalid key' })
      const num = decodeURIComponent(notesMatch[1])
      const body = await readBody(req)
      const lines = Array.isArray(body.lines) ? body.lines : []
      const doc = readDraft(key)
      // The first edit captures the original; a later edit leaves it alone, so a
      // restore always returns to what the plan says rather than to the previous
      // edit. Same rule as `edits` for spoken copy.
      const planned = buildBeats(readFileSync(outlinePath(key), 'utf8')).beats.find(
        (b) => b.num === num,
      )
      if (sameLines(lines, plannedNotes(planned))) {
        delete doc.notes[num]
        delete doc.noteEdits[num]
        writeDraft(key, doc)
        return sendJson(res, 200, { ok: true, savedAt: new Date().toISOString(), staged: false })
      }
      if (!doc.noteEdits[num]) {
        doc.noteEdits[num] = { original: plannedNotes(planned), at: new Date().toISOString() }
      }
      doc.notes[num] = lines
      writeDraft(key, doc)
      return sendJson(res, 200, { ok: true, savedAt: new Date().toISOString() })
    }

    // POST /api/beat/:num/notes/restore?key=<key>
    const notesRestoreMatch = url.pathname.match(/^\/api\/beat\/([^/]+)\/notes\/restore$/)
    if (req.method === 'POST' && notesRestoreMatch) {
      if (!isSafeKey(key)) return sendJson(res, 400, { error: 'invalid key' })
      const num = decodeURIComponent(notesRestoreMatch[1])
      const doc = readDraft(key)
      delete doc.notes[num]
      delete doc.noteEdits[num]
      writeDraft(key, doc)
      const { beats } = buildBeats(readFileSync(outlinePath(key), 'utf8'))
      const beat = beats.find((b) => b.num === num)
      return sendJson(res, 200, { lines: plannedNotes(beat) })
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

    // POST /api/approve?key=<key> — the owner signs off the plan on screen.
    //
    // LOCAL ONLY, and structurally so: the hosted Worker (src/worker/routes.ts) has no
    // such route, so the freelancer cannot approve his own brief even by crafting the
    // request. The button is hidden there too, but hiding is not the control.
    //
    // The fingerprint of what he is approving is computed HERE, from the file plus the
    // staged edits, rather than accepted from the browser. A client-supplied hash would
    // let a stale tab approve a version that no longer exists.
    if (req.method === 'POST' && url.pathname === '/api/approve') {
      if (!isSafeKey(key)) return sendJson(res, 400, { error: 'invalid key' })
      const built = buildVideoDoc(key)
      if (!built) return sendJson(res, 404, { error: `no outline for ${key}` })
      const doc = readDraft(key)
      const approved = {
        at: new Date().toISOString(),
        fingerprint: fingerprint(built.title, built.beats),
      }
      writeApproval(key, doc, approved)
      return sendJson(res, 200, { approval: { state: 'ok', ...approved } })
    }

    // DELETE /api/approve?key=<key> — take the sign-off back.
    if (req.method === 'DELETE' && url.pathname === '/api/approve') {
      if (!isSafeKey(key)) return sendJson(res, 400, { error: 'invalid key' })
      const doc = readDraft(key)
      writeApproval(key, doc, null)
      return sendJson(res, 200, { approval: { state: 'none' } })
    }

    // POST /api/finish?key=<key>
    if (req.method === 'POST' && url.pathname === '/api/finish') {
      if (!isSafeKey(key)) return sendJson(res, 400, { error: 'invalid key' })
      const doc = readDraft(key)
      doc.finished = true
      writeDraft(key, doc)
      return sendJson(res, 200, { ok: true })
    }

    // GET /api/source?key=<key> — the raw markdown, plus the structural model
    // edit mode renders from and the stamp a later save is checked against.
    if (req.method === 'GET' && url.pathname === '/api/source') {
      if (!isSafeKey(key)) return sendJson(res, 400, { error: 'invalid key' })
      const p = outlinePath(key)
      if (!existsSync(p)) return sendJson(res, 404, { error: `no plan for ${key}` })
      const text = readFileSync(p, 'utf8')
      return sendJson(res, 200, { text, stamp: planStamp(key), edit: buildEditModel(text) })
    }

    // PUT /api/source?key=<key> — the whole file, after an edit in the browser.
    if (req.method === 'PUT' && url.pathname === '/api/source') {
      if (!isSafeKey(key)) return sendJson(res, 400, { error: 'invalid key' })
      const p = outlinePath(key)
      if (!existsSync(p)) return sendJson(res, 404, { error: `no plan for ${key}` })
      const body = await readBody(req)
      if (typeof body.text !== 'string') return sendJson(res, 400, { error: 'no text' })

      const current = planStamp(key)
      if (body.stamp != null && body.stamp !== current) {
        return sendJson(res, 409, {
          error:
            'script-plan.md changed on disk since this page loaded — most likely your editor ' +
            'also has it open. Reload the desk to pick that up. Nothing was written.',
        })
      }

      const check = validatePlan(body.text)
      if (!check.ok) return sendJson(res, 422, { error: check.error })

      backupPlan(key)
      writePlan(key, body.text)
      const doc = buildVideoDoc(key)
      return sendJson(res, 200, {
        ok: true,
        stamp: planStamp(key),
        text: body.text,
        edit: check.edit,
        doc,
      })
    }

    sendJson(res, 404, { error: 'not found' })
  } catch (err) {
    sendJson(res, 500, { error: String(err?.message ?? err) })
  }
})

server.listen(PORT, () => {
  console.log(`script-desk local api on http://localhost:${PORT}`)
})
