#!/usr/bin/env node
// Zero-dependency CLI for the hosted script desk (plan 234).
//
//   node bin/desk.mjs publish <key> [--base https://script-desk.agrolloo.com] [--force]
//     Refuses while any **ASK** lane is still in the plan - those are the owner's own
//     unanswered questions, so the review is not finished. --force overrides. Either
//     way the ask field is stripped: it never reaches the maker.
//   node bin/desk.mjs list                 # every published video and its link
//   node bin/desk.mjs pull    <key> [--base ...]
//   node bin/desk.mjs pull    --fixture <file.json> --out <file.md>   # offline, for tests
//
// The direction of truth: script-plan.md in git is upstream, D1 is a copy,
// script-draft.md is the record that comes back. `publish` reads the local
// script plan, mints/reuses a link and pushes a snapshot. `pull` brings the
// maker's answers back down and writes videos/<key>/script-draft.md in the
// exact markdown shape step 3 of the yt-script skill reads.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBeats, buildEditModel } from '../../../pipelines/youtube/yt-script/lib/beats.mjs'
import {
  effectiveBeats,
  fingerprint,
  approvalState,
  formatApprovalRefusal,
  stagedCount,
  formatStagedRefusal,
} from '../lib/approval.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
// Overridable ONLY so `apply`'s tests can point at a scratch directory. Writing
// a fixture into the real `videos/` tree would be picked up by every test that
// walks it (roadmap, sourceLinks), and a crashed run would leave one behind.
const VIDEOS_ROOT =
  process.env.DESK_VIDEOS_ROOT ||
  resolve(HERE, '..', '..', '..', 'pipelines', 'youtube', 'yt-script', 'videos')
const DEFAULT_BASE = 'https://script-desk.agrolloo.com'

// Reject any key with a path-traversal or separator character before it ever
// touches the filesystem, same rule as server/local.mjs.
const KEY_RE = /^[^/\\]+$/
function isSafeKey(key) {
  return typeof key === 'string' && key.length > 0 && KEY_RE.test(key) && !key.includes('..')
}

// ------------------------------------------------------------------- ASK gate
// An `**ASK**` lane is the owner's own open question to Claude, left in the
// markdown while he reviews. Publishing hands the script to a freelancer, so
// publishing over an unanswered question means the review was never finished.
//
// Exported so the gate is testable without the network: the refusal happens
// BEFORE any fetch, and a gate nobody can test is a gate that quietly stops
// firing (this repo has three logged cases of exactly that).
export function openAsks(beats) {
  return (beats ?? []).filter((b) => (b.ask ?? []).length > 0)
}

export function formatAskRefusal(key, open) {
  const lines = [
    `REFUSED: ${open.length} unanswered ASK note${open.length === 1 ? '' : 's'} in ${key}`,
  ]
  for (const b of open) {
    lines.push(`  ${b.section ? `${b.num}  ${b.section}` : b.num}`)
    for (const l of b.ask) lines.push(`      ${l}`)
  }
  lines.push('')
  lines.push('Say "edits are done" in the terminal first, or pass --force to publish anyway.')
  return lines.join('\n') + '\n'
}

// Unconditional, --force included. Whatever the owner decides about his own
// workflow, his private question must never reach the maker's snapshot.
export function stripAsks(beats) {
  return (beats ?? []).map(({ ask: _ask, ...rest }) => rest)
}

function planPath(key) {
  return join(VIDEOS_ROOT, key, 'script-plan.md')
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

async function cmdPublish(key, base, force = false) {
  if (!isSafeKey(key)) {
    console.error(`desk.mjs: invalid key ${JSON.stringify(key)}`)
    process.exit(1)
  }
  const planFile = planPath(key)
  if (!existsSync(planFile)) {
    console.error(`desk.mjs: no script plan at ${planFile}`)
    process.exit(1)
  }
  const { title, beats } = buildBeats(readFileSync(planFile, 'utf8'))

  const open = openAsks(beats)
  if (open.length > 0 && !force) {
    process.stderr.write(formatAskRefusal(key, open))
    process.exit(2)
  }

  // THE APPROVAL GATE. Publishing mints a live secret URL and hands the script to the
  // maker, so it is the one step in this flow that cannot be taken back — and until
  // 2026-09-01 the only thing in front of it was the ASK gate.
  //
  // The fingerprint is taken over the EFFECTIVE plan (file + staged edits), which is
  // what the owner actually read on the desk. That is deliberate: it makes the gate
  // survive `apply`, because applying staged edits into the file does not change what
  // the plan SAYS. Approve, apply, publish — one approval, and it holds.
  //
  // It also means the reverse is caught. An edit made after approving — in the desk or
  // straight in his editor — changes the effective plan, so the hash moves and the gate
  // refuses rather than shipping a version nobody signed off.
  const staged = readStaged(key)
  const approval = approvalState(staged.approved, fingerprint(title, effectiveBeats(beats, staged)))
  if (approval.state !== 'ok' && !force) {
    process.stderr.write(formatApprovalRefusal(key, approval))
    process.exit(3)
  }

  // And publish only what is IN the file. See formatStagedRefusal — this is the gate
  // that stops an approved-but-unapplied plan shipping its pre-edit text.
  const nStaged = stagedCount(staged)
  if (nStaged > 0 && !force) {
    process.stderr.write(formatStagedRefusal(key, nStaged))
    process.exit(4)
  }

  const clean = stripAsks(beats)
  const res = await fetch(`${base}/api/admin/publish`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ key, title, beats: clean }),
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
    const planFile = planPath(key)
    if (!existsSync(planFile)) {
      console.error(`desk.mjs: no script plan at ${planFile}`)
      process.exit(1)
    }
    // Beat order and titles come from the local script plan, not from the D1
    // snapshot — the file is upstream, D1 is a copy.
    const { title, beats } = buildBeats(readFileSync(planFile, 'utf8'))
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
  const args = { base: DEFAULT_BASE, force: false, dryRun: false }
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--base') args.base = argv[++i]
    else if (a === '--fixture') args.fixture = argv[++i]
    else if (a === '--out') args.out = argv[++i]
    else if (a === '--force') args.force = true
    else if (a === '--dry-run') args.dryRun = true
    else positional.push(a)
  }
  return { positional, ...args }
}

// The link registry. Every desk URL carries a secret token, so the list of them
// cannot be a file in this repo - it is public. D1 already stores every one, so
// the database IS the registry and this reads it back. Without it the only
// record of an older video's link is whatever terminal happened to print it.
async function cmdList(base) {
  const res = await fetch(base + '/api/admin/list', { headers: adminHeaders() })
  const { videos } = await readJsonOrThrow(res, 'GET /api/admin/list')
  if (!videos.length) {
    console.error('no videos published yet')
    return
  }
  for (const v of videos) {
    const when = (v.publishedAt || '').slice(0, 10)
    const state = v.finished ? 'finished' : 'in progress'
    console.log(when + '  ' + v.key)
    console.log('            ' + v.title)
    console.log('            ' + v.url + '  (' + state + ')')
    console.log('')
  }
}

// ---------------------------------------------------------------- staged edits
//
// The owner edits notes and spoken lines IN PLACE in the local desk, and those
// edits stage in `desk-draft.json` rather than rewriting `script-plan.md`. Owner,
// 2026-08-29: *"can we do commit in 1 go. i will edit wherever required and tell
// you once all are reviewed and done. then you can update/edit in 1 go."*
//
// `edits` shows what is waiting. `apply` splices all of it into the markdown in
// one pass and clears the store, so the next commit carries the whole review.

function draftFile(key) {
  return join(VIDEOS_ROOT, key, 'desk-draft.json')
}

function readStaged(key) {
  const p = draftFile(key)
  if (!existsSync(p))
    return { notes: {}, noteEdits: {}, says: {}, edits: {}, draft: {}, approved: null, finished: false }
  const raw = JSON.parse(readFileSync(p, 'utf8'))
  return {
    notes: raw.notes ?? {},
    noteEdits: raw.noteEdits ?? {},
    says: raw.says ?? {},
    edits: raw.edits ?? {},
    draft: raw.draft ?? {},
    approved: raw.approved ?? null,
    finished: raw.finished ?? false,
  }
}

const sameLines = (a, b) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((l, i) => l === b[i])

// What the desk SHOWS in the Notes column: the merged lanes, in the same order
// WriteView merges them. Comparing a staged edit against this — rather than
// against the `original` recorded when it was first staged — is what catches a
// no-op on a beat that had no notes of its own to begin with. An intro beat's
// column is built from its VIDEO lane, so `original` was `[]` and every diff
// looked like an addition.
function shownNotes(beat) {
  if (!beat) return []
  return [...(beat.notes ?? []), ...(beat.angle ?? []), ...(beat.video ?? []), ...(beat.rules ?? []), ...(beat.facts ?? [])]
}

function stagedList(key) {
  const st = readStaged(key)
  const planPath = join(VIDEOS_ROOT, key, 'script-plan.md')
  const planned = existsSync(planPath)
    ? new Map(buildBeats(readFileSync(planPath, 'utf8')).beats.map((b) => [b.num, b]))
    : new Map()
  const out = []
  for (const num of Object.keys(st.notes)) {
    out.push({ num, kind: 'NOTES', original: st.noteEdits[num]?.original ?? [], lines: st.notes[num] })
  }
  for (const num of Object.keys(st.says)) {
    out.push({ num, kind: 'SAY', original: st.edits[num]?.original ?? [], lines: st.says[num] })
  }
  // Belt and braces. The server stopped staging identical saves on 2026-08-29,
  // but a store written before that has several in it, and an edit that changes
  // nothing should not be in a review list whichever way it got there. Measured
  // against the FILE, which is the only thing `apply` would actually change.
  const unchanged = (it) => {
    const beat = planned.get(it.num)
    const inFile = it.kind === 'NOTES' ? shownNotes(beat) : (beat?.say ?? [])
    // ONLY against the file. `original` is a snapshot taken when the edit was
    // first staged, and a store written before 2026-09-01 recorded it from the
    // NOTES lane alone while the desk was showing the merge — so on a plan whose
    // instructions live in `**VIDEO**` blocks it was recorded as `[]`. Deleting
    // that beat's notes then made `original` and `lines` both empty, the edit
    // read as a no-op, and `apply` reported "nothing staged" over the top of a
    // real deletion. The file is the only thing `apply` changes and the only
    // thing worth comparing against.
    return sameLines(it.lines, inFile)
  }
  return out
    .filter((it) => !unchanged(it))
    .sort((a, b) => a.num.localeCompare(b.num, undefined, { numeric: true }))
}

function cmdEdits(key) {
  if (!isSafeKey(key)) throw new Error(`unsafe key: ${key}`)
  const items = stagedList(key)
  if (items.length === 0) {
    console.log('nothing staged — script-plan.md matches the desk')
    return
  }
  for (const it of items) {
    console.log(`${it.num}  ${it.kind}`)
    for (const l of it.original) console.log('  - ' + l)
    for (const l of it.lines) console.log('  + ' + l)
    console.log('')
  }
  console.log(`${items.length} staged edit(s). Apply with: node bin/desk.mjs apply ${key}`)
}

// Splice every staged edit into script-plan.md. Ranges come from
// `buildEditModel`, so each one is the real source lines of that block, and they
// are applied BOTTOM-UP so an earlier splice cannot shift a later range.
function cmdApply(key, { dryRun = false } = {}) {
  if (!isSafeKey(key)) throw new Error(`unsafe key: ${key}`)
  const planPath = join(VIDEOS_ROOT, key, 'script-plan.md')
  if (!existsSync(planPath)) throw new Error(`no script-plan.md for ${key}`)

  const items = stagedList(key)
  if (items.length === 0) {
    console.log('nothing staged — nothing to apply')
    return
  }

  const md = readFileSync(planPath, 'utf8')
  const model = buildEditModel(md)
  const owners = [...model.beats, ...model.sections]

  // A NOTES block hangs off the `####` subsection that owns it, or — for a
  // section with no subsections — off the section itself. `buildBeats` numbers
  // those synthesized cards, `buildEditModel` does not, so match by position:
  // the Nth body card in reading order is the Nth notes-carrying owner.
  // MATCH BY SHAPE, NEVER BY NUMBER. `buildBeats` numbers a body card from the
  // outline's shape — `3` is a leaf section, `3.2` is the second `####` under
  // section 3 — while `buildEditModel` numbers a `####` heading POSITIONALLY
  // (`6`, `7`, `8`…) because the heading carries no number of its own. The two
  // never agree in the body, so a lookup keyed on `beat.num` missed every time
  // and the edit was dropped in silence. Measured 2026-09-01 on
  // ai-avatar-generators: `0 edit(s) would be applied; 4 skipped` — a full
  // afternoon of the owner's edits would have reached nothing.
  //
  // So rebuild the same shape here: body sections in reading order, each one
  // either a leaf card (`S`) or the parent of `S.1 … S.n`.
  const bodyCards = buildBeats(md).beats.filter((b) => b.partKind === 'body')
  const notesRangeFor = new Map()
  const ownerForCard = new Map()
  model.sections
    .filter((s) => /\bBODY\b/i.test(s.part ?? ''))
    .sort((a, b) => a.line - b.line)
    .forEach((sec, si) => {
      const subs = model.beats
        .filter((b) => b.section === sec.name && b.part === sec.part)
        .sort((a, b) => a.line - b.line)
      if (subs.length === 0) ownerForCard.set(String(si + 1), sec)
      else subs.forEach((sub, i) => ownerForCard.set(`${si + 1}.${i + 1}`, sub))
    })

  // The desk's Notes column is a MERGE of five lanes, so the block an edit came
  // from is whichever one is actually there: `**NOTES**` on a plan written in the
  // current shape, `**VIDEO**` on one written before it. Write back under that
  // block's own header, or the plan grows a NOTES lane where the parser does not
  // expect one. Two merged lanes cannot be told apart after the merge, so that
  // case is skipped LOUDLY below rather than guessed at.
  const MERGED = new Set(['VIDEO', 'FACTS', 'RULES'])
  const rangeIn = (owner) => {
    if (!owner) return undefined
    const notes = owner.blocks.find((b) => b.kind === 'NOTES')
    if (notes) return notes
    const merged = owner.blocks.filter((b) => MERGED.has(b.kind))
    return merged.length === 1 ? merged[0] : undefined
  }
  // A leaf section IS its instruction block - buildBeats synthesizes the card from
  // it - so emptying that block would take the whole section off the desk. A `####`
  // subsection keeps its heading and just loses its notes, which is what an empty
  // box should mean. Track which is which.
  const headedCards = new Set()
  for (const card of bodyCards) {
    const owner = ownerForCard.get(card.num)
    const range = rangeIn(owner)
    if (!range) continue
    notesRangeFor.set(card.num, range)
    if (owner && model.beats.includes(owner)) headedCards.add(card.num)
  }

  // An INTRO or CONCLUSION beat has no `NOTES` lane — the desk's Notes block is
  // built from its `VIDEO` lane, and editing it stages something that had nowhere
  // to go. It was silently skipped, which is the wrong answer: the edit is real.
  //
  // So a beat whose notes came from exactly ONE source block writes back to that
  // block, under that block's own header. Exactly one, because `laneLines` merges
  // several lanes into one column and a merge cannot be undone — a beat with two
  // of them is skipped LOUDLY instead.
  // Intro and conclusion beats carry their own number in the heading (`A1 · …`,
  // `C1 · …`), so BEAT_RE picks it up and both models agree — those can be keyed
  // on the number directly.
  for (const beat of model.beats) {
    if (notesRangeFor.has(beat.num)) continue
    const range = rangeIn(beat)
    if (!range) continue
    notesRangeFor.set(beat.num, range)
    headedCards.add(beat.num)
  }

  const sayRangeFor = new Map()
  for (const beat of model.beats) {
    const say = beat.blocks.find((b) => b.kind === 'SAY' && b.spoken)
    if (say) sayRangeFor.set(beat.num, say)
  }

  const splices = []
  const skipped = []
  for (const it of items) {
    const range = it.kind === 'NOTES' ? notesRangeFor.get(it.num) : sayRangeFor.get(it.num)
    if (!range) {
      skipped.push(it)
      continue
    }
    // Keep the block's own header. A body card is `**NOTES**`; an intro beat's
    // block is `**VIDEO**` and must stay that way, or the plan grows a NOTES lane
    // in the introduction and the parser reads it as a body card.
    const header = range.text.split('\n')[0]
    // A BLANK LINE ENDS AN UNQUOTED LANE. The block parser collects a non-spoken
    // lane until the first empty line, so a blank written into the middle of one
    // truncates it on the next read — silently, because the file still parses.
    // The owner separates his bullets with blank lines, and writing 37 of his
    // lines back produced a block that read as 9. Spoken lanes are exempt: there
    // an empty line is a paragraph break and is written as a bare `>`.
    const body =
      it.kind === 'NOTES'
        ? it.lines.filter((l) => l.trim())
        : it.lines.map((l) => (l ? '> ' + l : '>'))
    // AN EMPTY BOX IS A DELETED BLOCK, not a header with nothing under it. Left as
    // a bare `**VIDEO**` the lane is still in the file, the next read finds it again,
    // and the round-trip guard below then rejects the whole write - which is exactly
    // what four staged deletions hit on 2026-09-01.
    const drop = it.kind === 'NOTES' && body.length === 0 && headedCards.has(it.num)
    splices.push({ range, text: drop ? null : [header, ...body].join('\n'), it, body })
  }

  const lines = md.split(/\r?\n/)
  for (const sp of splices.sort((a, b) => b.range.line - a.range.line)) {
    lines.splice(sp.range.line, sp.range.endLine - sp.range.line, ...(sp.text === null ? [] : sp.text.split('\n')))
  }
  const next = lines.join('\n')

  // Never write markdown that does not parse. Same guard the browser editor has.
  let nextBeats
  try {
    nextBeats = buildBeats(next).beats
    if (!nextBeats.length) throw new Error('that leaves the plan with no beats at all')
  } catch (err) {
    throw new Error(`refusing to write: ${String(err?.message ?? err)}`)
  }

  // AND NEVER WRITE MARKDOWN THAT PARSES BUT LOSES THE EDIT. Parsing was never
  // the bar. The bar is that reading the file back hands the desk exactly what
  // the owner typed, and every defect found in this path so far has had the same
  // shape — the write succeeded and the text was gone anyway. A lookup that
  // missed on a number the two parsers disagree about. A lane that truncated at
  // a blank line. A staged note merged back on top of the lane it came from.
  // None of those broke the parse, so none of them tripped the guard above.
  //
  // This round trip is the guard that catches the NEXT one, whatever shape it
  // takes: write it, read it back, and refuse the whole file if what comes back
  // is not what went in. Refusing costs a staged edit that is still staged;
  // writing costs work nobody notices is missing until the recording day.
  const byNum = new Map(nextBeats.map((b) => [b.num, b]))
  const lost = []
  for (const sp of splices) {
    const beat = byNum.get(sp.it.num)
    const wrote = sp.body.map((l) => l.replace(/^> ?/, ''))
    const readBack = sp.it.kind === 'NOTES' ? shownNotes(beat) : (beat?.say ?? [])
    if (!sameLines(readBack, wrote)) {
      lost.push(`  ${sp.it.num} ${sp.it.kind}: wrote ${wrote.length} line(s), reads back as ${readBack.length}`)
    }
  }
  if (lost.length) {
    throw new Error(
      `refusing to write — script-plan.md would not read back what was put in it:\n${lost.join('\n')}\n` +
        `Nothing was written and every edit is still staged.`,
    )
  }

  // A skipped edit is REAL WORK that did not land, so say which one and why.
  // It was a bare count, and a count reads like a footnote next to "0 edit(s)
  // would be applied" — which is exactly what it said while four sections of
  // the owner's edits were going nowhere.
  for (const it of skipped) {
    console.error(
      `SKIPPED ${it.num} ${it.kind}: no single block to write it back to. The desk merges ` +
        `several instruction lanes into one column and this beat has more than one of them, ` +
        `so edit it directly in script-plan.md.`,
    )
  }

  if (dryRun) {
    console.log(`${splices.length} edit(s) would be applied; ${skipped.length} skipped`)
    return
  }

  writeFileSync(planPath, next)
  const st = readStaged(key)
  writeFileSync(
    draftFile(key),
    JSON.stringify({ ...st, notes: {}, noteEdits: {}, says: {}, edits: {} }, null, 2) + '\n',
  )
  console.log(`applied ${splices.length} edit(s) to ${planPath}`)
  for (const it of skipped) console.log(`  SKIPPED ${it.num} ${it.kind} — no matching block in the plan`)
}

async function main(argv) {
  const [cmd, ...rest] = argv
  const { positional, base, fixture, out, force, dryRun } = parseArgs(rest)
  const key = positional[0]

  if (cmd === 'publish') {
    if (!key) {
      console.error('usage: node bin/desk.mjs publish <key> [--base https://script-desk.agrolloo.com] [--force]')
      process.exit(1)
    }
    return cmdPublish(key, base, force)
  }

  if (cmd === 'pull') {
    if (!key && !fixture) {
      console.error('usage: node bin/desk.mjs pull <key> [--base ...] | --fixture <file.json> --out <file.md>')
      process.exit(1)
    }
    return cmdPull(key, { base, fixturePath: fixture, outPath: out, force })
  }

  if (cmd === 'list') {
    return cmdList(base)
  }

  if (cmd === 'edits') {
    if (!key) {
      console.error('usage: node bin/desk.mjs edits <key>')
      process.exit(1)
    }
    return cmdEdits(key)
  }

  if (cmd === 'apply') {
    if (!key) {
      console.error('usage: node bin/desk.mjs apply <key> [--dry-run]')
      process.exit(1)
    }
    return cmdApply(key, { dryRun })
  }

  console.error('usage: node bin/desk.mjs <publish|pull|list|edits|apply> ...')
  process.exit(1)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(String(err?.message ?? err))
    process.exit(1)
  })
}
