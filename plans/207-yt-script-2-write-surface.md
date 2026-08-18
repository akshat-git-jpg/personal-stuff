---
executor: agy
model:                   # blank = agy default (Gemini 3.1 Pro High)
test_cmd: cd pipelines/youtube/yt-script-2 && node --test test/worksheet.test.mjs
ui:
deploy:
needs: []
needs_prs: []
touches: [pipelines/youtube/yt-script-2/render-worksheet.mjs, pipelines/youtube/yt-script-2/test/worksheet.test.mjs, pipelines/youtube/yt-script-2/CLAUDE.md, pipelines/youtube/yt-script-2/SCRIPT-INSTRUCTIONS.md, pipelines/.claude/skills/yt-script-2/SKILL.md]

mutation_apply: perl -pi -e "s/^const QUOTE_JOIN = .\\\\n.$/const QUOTE_JOIN = ' '/" pipelines/youtube/yt-script-2/render-worksheet.mjs
mutation_command: node --test test/worksheet.test.mjs
mutation_expect: PREFILLED_DRIFT
mutation_cwd: pipelines/youtube/yt-script-2
mutation_timeout: 300
---

# Plan 207: yt-script-2 — the step-2 write surface (`render-worksheet.mjs`)

## Summary

- **Problem statement**: step 2 emits only `outline.pdf`, which solved the *read*
  problem. The remote tutorial maker still rebuilds the script by hand — and
  measurement across both finished videos shows the intro reaches his script
  **100% word-for-word** (16/16 sentences in both), conclusions 75–100%, verdicts
  27–100%. He is retyping finished copy, plus rebuilding all the scaffolding
  (`SAY`→`**Voiceover**`, `SHOW`+`EDIT`→`Notes`, part wrappers, beat numbers).
- **Goals**:
  - Add `render-worksheet.mjs`: `outline.md` → `script-worksheet.md`, a
    **voiceover-only** write artifact.
  - Pre-filled copy is **copied byte-for-byte** from `outline.md`, never retyped,
    and a test proves it.
  - Body beats get a `REFERENCE` block, an empty `**Voiceover**` slot, an empty
    `Facts for this beat` block, and a `target — words` marker for the session.
  - Update the three docs (SKILL.md, CLAUDE.md, SCRIPT-INSTRUCTIONS.md) to
    describe step 2's second output and step 3's two new obligations.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — **owner's explicit
  choice** (2026-08-18). See "Routing note" below: `tooling/boss/data/rules.md`
  would normally route the doc edits to `claude-p`/sonnet as quality-setting
  content, so this plan compensates by inlining every doc block verbatim, leaving
  the executor placement work only.
- **Done criteria** (terse — full list below): `node --test
  test/worksheet.test.mjs` green with ≥14 tests; `render-worksheet.mjs` produces
  byte-identical pre-filled copy for all three real outlines; the three docs each
  name `render-worksheet.mjs`; the mutation recipe proven to fire.
- **Stop conditions** (terse — full list below): do not weaken or delete any
  assertion to go green; do not touch `render-outline.mjs` or `render-script.mjs`;
  do not commit a generated `script-worksheet.md` for any real video; do not
  invent worksheet syntax not written in this plan.
- **Test / verification for success**: `node:test` unit suite over inlined
  fixtures **plus** the three real outlines in `videos/`, including a
  byte-identity assertion and doc-content assertions (so the single `test_cmd`
  covers the doc work too).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. **Do NOT
> edit `plans/README.md`** — it is boss-owned on main and its row is already
> written; report your status in the run-log instead.
>
> **Drift check (run first)**: `git diff --stat 2d9caf75..HEAD -- pipelines/youtube/yt-script-2/ pipelines/.claude/skills/yt-script-2/`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `2d9caf75`, 2026-08-18

## Routing note (read before grading)

`tooling/boss/data/rules.md` routes "quality-setting CONTENT the owner judges by
taste — rulebooks, prompts, prose, docs" to `claude-p`/sonnet. Steps 6–8 of this
plan edit docs. The owner explicitly chose `agy` on 2026-08-18.

The compensation, per the orchestrate grading-honesty rider: **every doc block is
authored verbatim in this plan**. The executor pastes exact text at exact anchors
— no prose is written during execution. Doc correctness is additionally asserted by
tests inside `test_cmd`, so a mis-paste fails the merge gate rather than shipping.

## Why this matters

The maker's time is the pipeline's bottleneck and it is being spent on
transcription. Every sentence he retypes is a sentence that can drift by a word,
and a drifted word goes to camera. Copying the finished halves mechanically
removes both the cost and the risk at once, and leaves him doing only the part
that needs him: writing the body from what he saw on screen.

The design, the measurements behind it, and the owner's seven decisions (including
two reversals) are recorded in
`docs/superpowers/specs/2026-08-18-yt-script-2-write-surface-design.md`. Read that
spec first — this plan implements it and does not re-argue it.

## Current state

### Files in scope

| Path | Role |
|---|---|
| `pipelines/youtube/yt-script-2/render-outline.mjs` | 459 lines. `outline.md` → `outline.html` + `.pdf`. **Read it for its parser; do not edit it.** |
| `pipelines/youtube/yt-script-2/render-script.mjs` | 361 lines. `script.md` → `script.html` + `.pdf`. Precedent for "a separate, simpler parser rather than reusing outline.md's lane grammar". **Do not edit.** |
| `pipelines/youtube/yt-script-2/OUTLINE-INSTRUCTIONS.md` | The outline grammar. Authority on which parts are finished copy. |
| `pipelines/youtube/yt-script-2/SCRIPT-INSTRUCTIONS.md` | The script format + word budgets. Edited in Step 8. |
| `pipelines/youtube/yt-script-2/CLAUDE.md` | Folder operate-doc. Edited in Step 7. |
| `pipelines/.claude/skills/yt-script-2/SKILL.md` | The operating contract. Edited in Step 6. |
| `pipelines/youtube/yt-script-2/videos/<key>/outline.md` | Three real outlines, used as test fixtures. **Read only.** |

There are currently **no tests** anywhere under `pipelines/youtube/yt-script-2/`
and no `package.json` in the repo. Step 1 creates the first test file.

### The outline grammar you must parse

From `render-outline.mjs`'s own header comment (lines 13–21), verbatim:

```
#   # Title                        document title
#   ## 1 · INTRODUCTION            top-level part
#   ### SECTION: Live Demo         section inside the body
#   #### 2.3 · HeyGen              a beat
#   **SAY** / **SHOW** / **EDIT**  a lane label, alone on its line
#   > "spoken copy"                blockquote under SAY = the line to read
#   > **RULES — ...**              blockquote opening in bold RULES = rules box
#   > **VERDICT:** ...             blockquote opening in bold VERDICT = verdict
#   ---                            beat separator (ignored, beats self-delimit)
```

A lane label may carry a trailing note: `**SAY** — lip-sync`. The existing regex
that captures it (`render-outline.mjs:109`) is:

```js
const lane = line.trim().match(/^\*\*(SAY|SHOW|EDIT)\*\*(?:\s*[—-]\s*(.*))?$/i)
```

You will reuse this regex. **`lane[2]` is the note** — this plan uses it for the
`final` marker (see "The `final` marker" below).

### THE TRAP — do not use `splitParas`

`render-outline.mjs` has a helper `splitParas(lines)` (line 171) which **joins
lines with a single space**:

```js
function splitParas(lines) {
  const out = []
  let cur = []
  for (const l of lines) {
    if (l.trim() === '') {
      if (cur.length) out.push(cur.join(' '))
      cur = []
```

That is correct for HTML paragraphs and **fatal here**. Byte-identical copying
requires the raw blockquote lines, with their internal bare `>` separators and
their leading spaces intact. Your parser must keep `raw: string[]` and never pass
spoken copy through `splitParas`.

The round-trip that must hold exactly:

| Original outline line | stripped by `/^> ?/` | re-emitted | matches? |
|---|---|---|---|
| `> "Perfect face. Perfect outfit.` | `"Perfect face. Perfect outfit.` | `> "Perfect face. Perfect outfit.` | yes |
| `>` | `` (empty string) | `>` | yes |
| `>  Scene two. Different face.` | ` Scene two. Different face.` | `>  Scene two. Different face.` | yes |

So: strip with `/^> ?/` (that is a single optional space), and re-emit with
`(l) => (l ? '> ' + l : '>')`.

### Which parts are pre-filled — positional, never string-matched

The three real outlines disagree on the tail part's wording:

| Outline | Part headings (verified 2026-08-18) |
|---|---|
| `ai-avatar-generator-comparison` | `1 · INTRODUCTION` · `2 · BODY` · `3 · HONEST VERDICT` |
| `ai-avatar-generators` | `1 · INTRODUCTION` · `2 · BODY` · `3 · HONEST VERDICT` · `4 · CONCLUSION` |
| `character-consistency-ai` | `1 · INTRODUCTION` · `2 · BODY` · `3 · HONEST VERDICT & CONCLUSION` |

Matching the literal word `CONCLUSION` breaks on two of three. The rule is:

> **The part whose heading text contains the word `BODY` is the only part holding
> draft SAY lanes. Every part before it and every part after it is finished copy,
> whatever it is called.** `> **VERDICT:**` blocks are finished copy wherever they
> appear.

If no part heading contains `BODY`, **throw** — do not guess which half is draft.

Part letters follow position, not name: parts before the body part are `A`, the
body part is `B`, parts after it are `C`. Beats number `1..n` within their letter,
in document order.

### The `final` marker

A body `SAY` lane whose note is exactly `final` (case-insensitive, i.e.
`**SAY** — final`) is treated as **pre-filled**, not a draft slot. This exists for
forward-hook beats, which the maker uses verbatim today. No new syntax is
introduced — it rides the note capture group that already exists.

No current outline uses it. Step 3's fixture exercises it.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run the suite | `cd pipelines/youtube/yt-script-2 && node --test test/worksheet.test.mjs` | exit 0, `# fail 0`, `# pass` ≥ 14 |
| Generate a worksheet | `cd pipelines/youtube/yt-script-2 && node render-worksheet.mjs character-consistency-ai` | exit 0, prints the written path |
| Refuse to clobber | `cd pipelines/youtube/yt-script-2 && node render-worksheet.mjs character-consistency-ai` (twice) | 2nd run exits 1, stderr contains `already exists` |
| Node version | `node --version` | `v22.x` |

**Never write `node --test test/`** (a bare directory). On node 22.14 that fails
with `Cannot find module '.../test'` — it treats the path as a script
(`plans/runs/LESSONS.md`, 2026-07-09). Always name the file.

## Scope

**In scope** — the only files you may create or modify:
- `pipelines/youtube/yt-script-2/render-worksheet.mjs` (new)
- `pipelines/youtube/yt-script-2/test/worksheet.test.mjs` (new)
- `pipelines/youtube/yt-script-2/.gitignore` (one line)
- `pipelines/youtube/yt-script-2/CLAUDE.md`
- `pipelines/youtube/yt-script-2/SCRIPT-INSTRUCTIONS.md`
- `pipelines/.claude/skills/yt-script-2/SKILL.md`

**Out of scope** — looks related, do not touch:
- **`plans/README.md` — do NOT edit it.** It is boss-owned on main; the
  orchestrator already registered this plan's row there. Plan branches editing it
  is what gave the 044–050 batch a rebase conflict on every branch, which
  greenlight then parked (`decisions.md` 2026-07-07).
- `render-outline.mjs` / `render-script.mjs` — the outline PDF is load-bearing
  (`CLAUDE.md`: the dark print CSS "fails silently if removed"). Copy the parser
  *pattern* into your new file; do not refactor a shared module out of them.
- `OUTLINE-INSTRUCTIONS.md` — the outline grammar is unchanged by this plan.
- Any `videos/<key>/` file — the three outlines are read-only fixtures. Do NOT
  commit a generated `script-worksheet.md` for a real video.
- `decisions.md` — the orchestrator appends after landing, never the executor.

## Git workflow

- Branch: `advisor/207-yt-script-2-write-surface`
- Commit per step (rollback granularity), messages like
  `feat(yt-script-2): worksheet generator` — single line, no AI footers, no
  `Co-Authored-By`. **Do NOT push.**

## Steps

### Step 1: Create the test file with the inlined fixtures

Create `pipelines/youtube/yt-script-2/test/worksheet.test.mjs`. Start with only
the fixtures and imports below, so Step 2 has a target to satisfy.

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildWorksheet, parse, bodyPartIndex } from '../render-worksheet.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const VIDEOS = join(ROOT, 'videos')
const REAL = ['ai-avatar-generator-comparison', 'ai-avatar-generators', 'character-consistency-ai']

// A minimal outline exercising every construct this generator must handle.
const FIXTURE = `# Test Video Title

## 1 · INTRODUCTION

#### Cold open — the drift

**SAY**
> "Perfect face. Perfect outfit.
>
>  Scene two. Different face."

**SHOW**
One portrait full-screen. Hard cut through three scenes.

**EDIT**
Red box. Glitch sound.

#### First CTA

**SAY**
> "Links are in the description."

## 2 · BODY

### SECTION: Quick Overview

> **RULES — WHOLE SECTION**
> - Orientation only, no scores.

#### 2.1 · Meet the five

**SAY**
> "Quick intros. OpenArt, InVideo, Higgsfield."

**SHOW**
Skim each platform panel.

> **VERDICT:** Five tools, five approaches.

#### 2.2 · Forward hook

**SAY** — final
> "Time to put them through the wringer."

## 3 · HONEST VERDICT & CONCLUSION

#### Final recommendation

**SAY**
> "OpenArt if you need identity to hold."
`

const NO_BODY = `# Broken

## 1 · INTRODUCTION

**SAY**
> "Hello."

## 2 · SOMETHING ELSE

#### 2.1 · Beat

**SAY**
> "Words."
`
```

**Verify**: `cd pipelines/youtube/yt-script-2 && node --test test/worksheet.test.mjs` → exits non-zero with `Cannot find module` for `../render-worksheet.mjs`. That failure is expected at this step and proves the test file is being loaded.

### Step 2: Write `render-worksheet.mjs`

Create `pipelines/youtube/yt-script-2/render-worksheet.mjs` with exactly this
content. It is complete — place it, do not redesign it.

```js
#!/usr/bin/env node
// Render an outline.md into script-worksheet.md — the WRITE artifact the remote
// tutorial maker fills in. Voiceover only: no SHOW, no EDIT, no rules boxes.
// Those live in outline.pdf, which he reads beside this file.
//
//   node render-worksheet.mjs <slug>          # videos/<slug>/outline.md -> script-worksheet.md
//   node render-worksheet.mjs path/to/outline.md
//   node render-worksheet.mjs <slug> --force  # overwrite an existing worksheet
//
// Why a separate parser rather than importing render-outline.mjs's: same reason
// render-script.mjs has its own — that one builds HTML and joins blockquote lines
// with spaces (splitParas), which destroys the byte-identical copy this file
// depends on. Pre-filled spoken copy here is COPIED, never re-flowed: a retyped
// intro can drop a word and that word goes to camera.
//
// Finished-copy rule is POSITIONAL, never matched on heading wording (the three
// real outlines say HONEST VERDICT / HONEST VERDICT & CONCLUSION / CONCLUSION):
// the part containing the word BODY holds the drafts; every part before and after
// it is finished copy. A body SAY lane noted `— final` is finished copy too.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

const LANE_RE = /^\*\*(SAY|SHOW|EDIT)\*\*(?:\s*[—-]\s*(.*))?$/i

// Strip the blockquote marker, keeping everything after ONE optional space so a
// continuation line's own indentation survives.
const unquote = (l) => l.replace(/^> ?/, '')

// Kept as a named constant on its own line so plan 207's mutation gate has a
// single unambiguous target. Setting it to ' ' collapses the copied lines and
// breaks byte-identity — which is exactly the defect the gate must catch.
// Do not inline it back into requote().
const QUOTE_JOIN = '\n'

// Re-emit raw quote lines. A bare `>` separator must stay a bare `>`.
function requote(raw) {
  return raw.map((l) => (l ? '> ' + l : '>')).join(QUOTE_JOIN)
}

export function parse(md) {
  const lines = md.split(/\r?\n/)
  const blocks = []
  let i = 0

  const flushQuote = () => {
    const quoted = []
    while (i < lines.length && /^>/.test(lines[i])) {
      quoted.push(unquote(lines[i]))
      i++
    }
    return quoted
  }

  while (i < lines.length) {
    const line = lines[i]

    if (/^#\s+/.test(line)) {
      blocks.push({ t: 'title', text: line.replace(/^#\s+/, '').trim() })
      i++
      continue
    }
    if (/^##\s+(?!#)/.test(line)) {
      blocks.push({ t: 'part', text: line.replace(/^##\s+/, '').trim() })
      i++
      continue
    }
    if (/^###\s+(?!#)/.test(line)) {
      blocks.push({
        t: 'section',
        text: line.replace(/^###\s+/, '').replace(/^SECTION:\s*/i, '').trim(),
      })
      i++
      continue
    }
    if (/^####\s+/.test(line)) {
      blocks.push({ t: 'beat', text: line.replace(/^####\s+/, '').trim() })
      i++
      continue
    }

    if (/^>/.test(line)) {
      const raw = flushQuote()
      const head = raw[0] ?? ''
      if (/^\*\*RULES\b/i.test(head)) blocks.push({ t: 'rules' })
      else if (/^\*\*VERDICT/i.test(head)) {
        blocks.push({
          t: 'verdict',
          text: raw.join(' ').replace(/^\*\*VERDICT:?\*\*:?\s*/i, '').trim(),
        })
      } else blocks.push({ t: 'quote', raw })
      continue
    }

    const lane = line.trim().match(LANE_RE)
    if (lane) {
      const kind = lane[1].toUpperCase()
      const note = (lane[2] || '').trim()
      i++
      while (i < lines.length && lines[i].trim() === '') i++

      if (i < lines.length && /^>/.test(lines[i])) {
        blocks.push({ t: 'lane', kind, note, raw: flushQuote(), spoken: true })
      } else {
        const body = []
        while (
          i < lines.length &&
          lines[i].trim() !== '' &&
          !/^#{1,4}\s/.test(lines[i]) &&
          !/^>/.test(lines[i]) &&
          !LANE_RE.test(lines[i].trim()) &&
          !/^---\s*$/.test(lines[i])
        ) {
          body.push(lines[i])
          i++
        }
        blocks.push({ t: 'lane', kind, note, raw: body, spoken: false })
      }
      continue
    }

    i++
  }

  return blocks
}

// Index into blocks of the part heading containing the word BODY. Throws if absent.
export function bodyPartIndex(blocks) {
  const idx = blocks.findIndex((b) => b.t === 'part' && /\bBODY\b/i.test(b.text))
  if (idx === -1) {
    throw new Error(
      'NO_BODY_PART: no `## <n> · ...BODY...` part heading found. ' +
        'Refusing to guess which half of the outline is draft copy.'
    )
  }
  return idx
}

const PREFILLED_TAG = "✎ pre-filled — final unless it's wrong"

export function buildWorksheet(md) {
  const blocks = parse(md)
  const bodyIdx = bodyPartIndex(blocks)
  const title = blocks.find((b) => b.t === 'title')?.text ?? 'Untitled'

  // Part letter per block index.
  const partIdxs = blocks.map((b, n) => (b.t === 'part' ? n : -1)).filter((n) => n >= 0)
  const letterFor = (n) => {
    const owning = partIdxs.filter((p) => p <= n).pop()
    if (owning === undefined) return 'A'
    if (owning < bodyIdx) return 'A'
    if (owning === bodyIdx) return 'B'
    return 'C'
  }

  const out = []
  out.push(`# ${title} — script worksheet`)
  out.push('')
  out.push('Fill the empty **Voiceover** slots. Everything else is already done.')
  out.push('')
  out.push('Open `outline.pdf` beside this file — the demo, the screen actions and')
  out.push('the section rules live there. They are deliberately not repeated here.')
  out.push('')
  out.push('Beats marked pre-filled are final. Change one only if your screen time')
  out.push("showed it to be wrong; anything you change is flagged for Kushal's review.")
  out.push('')

  const counters = { A: 0, B: 0, C: 0 }
  let pendingBeat = null

  for (let n = 0; n < blocks.length; n++) {
    const b = blocks[n]

    if (b.t === 'part') {
      out.push('---')
      out.push('')
      out.push(`## PART ${letterFor(n)} — ${b.text.replace(/^\d+\s*·\s*/, '')}`)
      out.push('')
      continue
    }

    if (b.t === 'section') {
      out.push(`### SECTION: ${b.text}`)
      out.push('')
      continue
    }

    // Record the heading only. The counter increments when a SAY lane actually
    // EMITS a beat — a beat with only SHOW/EDIT produces nothing in a
    // voiceover-only file, and must not consume a number and leave a gap.
    if (b.t === 'beat') {
      pendingBeat = { text: b.text.replace(/^[\d.]+\s*·\s*/, '') }
      continue
    }

    if (b.t === 'verdict') {
      out.push(`> **VERDICT** ${PREFILLED_TAG}`)
      out.push(`> ${b.text}`)
      out.push('')
      continue
    }

    if (b.t === 'lane' && b.kind === 'SAY' && b.spoken) {
      const letter = letterFor(n)
      counters[letter] += 1
      const id = `${letter}${counters[letter]}`
      const text = pendingBeat?.text ?? 'Untitled beat'
      pendingBeat = null
      const isDraft = letter === 'B' && b.note.toLowerCase() !== 'final'

      if (!isDraft) {
        out.push(`#### ${id} · ${text}    ${PREFILLED_TAG}`)
        out.push('')
        out.push(requote(b.raw))
        out.push('')
      } else {
        out.push(`#### ${id} · ${text}    target — words`)
        out.push('')
        out.push('> REFERENCE — the angle to hit. Do not ship these words.')
        out.push('>') // bare separator: without it the label and the draft render
        out.push(requote(b.raw)) // as ONE markdown paragraph inside the blockquote
        out.push('')
        out.push('<details><summary>Facts for this beat</summary>')
        out.push('')
        out.push('- ')
        out.push('')
        out.push('</details>')
        out.push('')
        out.push('**Voiceover**')
        out.push('>')
        out.push('>')
        out.push('>')
        out.push('')
      }
      continue
    }

    // SHOW, EDIT, rules, plain quotes, prose: dropped on purpose. They belong to
    // outline.pdf. Repeating them here is the mistake this format exists to avoid.
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

// ---------------------------------------------------------------- CLI

function main(argv) {
  const args = argv.filter((a) => a !== '--force')
  const force = argv.includes('--force')
  const arg = args[0]
  if (!arg) {
    console.error('usage: node render-worksheet.mjs <slug|path/to/outline.md> [--force]')
    process.exit(1)
  }

  const inPath = arg.endsWith('.md') ? resolve(arg) : join(HERE, 'videos', arg, 'outline.md')
  if (!existsSync(inPath)) {
    console.error(`no outline at ${inPath}`)
    process.exit(1)
  }

  const outPath = join(dirname(inPath), 'script-worksheet.md')
  if (existsSync(outPath) && !force) {
    console.error(
      `${outPath} already exists. The session's hand-written fact packs are not ` +
        `regenerable — pass --force only if you mean to lose them.`
    )
    process.exit(1)
  }

  writeFileSync(outPath, buildWorksheet(readFileSync(inPath, 'utf8')))
  console.log(outPath)
}

if (process.argv[1] && basename(process.argv[1]) === 'render-worksheet.mjs') {
  main(process.argv.slice(2))
}
```

**This snippet was executed before the plan was handed off.** The orchestrator ran
it in a scratch directory against the fixture and all three real outlines on
2026-08-18: 13/13 tests pass, the mutation recipe in the frontmatter fires
(3 failures printing `PREFILLED_DRIFT`), and the generated worksheet for
`character-consistency-ai` is 356 lines with 18 pre-filled beats, 14 empty slots
and zero SHOW/EDIT leakage. Four defects were found and fixed during that run —
they are already corrected above, and are called out in the comments so you do not
reintroduce them:

1. Beat counters incremented on the *heading* rather than on emission, leaving
   numbering gaps (`A1`, `A3`) whenever a beat had only SHOW/EDIT.
2. A dead `flushBeat` helper.
3. A no-op `.replace(/^/gm, '').split('\n').join('\n')` chain around `requote`.
4. Missing bare `>` separator, which made the `REFERENCE` label and the draft text
   render as one merged markdown paragraph.

Type it as written. If your run disagrees with those numbers, something differs —
report it rather than adjusting the tests.

**Verify**: `cd pipelines/youtube/yt-script-2 && node -e "import('./render-worksheet.mjs').then(m => console.log(Object.keys(m).sort().join(',')))"` → prints `bodyPartIndex,buildWorksheet,parse`

### Step 3: Add the structural tests

Append to `test/worksheet.test.mjs`:

```js
test('parse keeps raw quote lines, not space-joined paragraphs', () => {
  const say = parse(FIXTURE).find((b) => b.t === 'lane' && b.kind === 'SAY' && b.spoken)
  assert.deepEqual(say.raw, ['"Perfect face. Perfect outfit.', '', ' Scene two. Different face."'])
})

test('bodyPartIndex finds the BODY part', () => {
  const blocks = parse(FIXTURE)
  assert.equal(blocks[bodyPartIndex(blocks)].text, '2 · BODY')
})

test('bodyPartIndex throws NO_BODY_PART when no part says BODY', () => {
  assert.throws(() => bodyPartIndex(parse(NO_BODY)), /NO_BODY_PART/)
})

test('intro beats are pre-filled, body beats get an empty slot', () => {
  const ws = buildWorksheet(FIXTURE)
  assert.match(ws, /#### A1 · Cold open — the drift\s+✎ pre-filled/)
  assert.match(ws, /#### B1 · Meet the five\s+target — words/)
  assert.match(ws, /\*\*Voiceover\*\*/)
})

test('a body SAY noted `final` is pre-filled, not a slot', () => {
  const ws = buildWorksheet(FIXTURE)
  const hook = ws.slice(ws.indexOf('B2 · Forward hook'))
  assert.match(hook.split('####')[0], /✎ pre-filled/)
  assert.doesNotMatch(hook.split('####')[0], /target — words/)
})

test('the tail part becomes PART C whatever it is called', () => {
  assert.match(buildWorksheet(FIXTURE), /## PART C — HONEST VERDICT & CONCLUSION/)
  assert.match(buildWorksheet(FIXTURE.replace('HONEST VERDICT & CONCLUSION', 'WRAP UP')), /## PART C — WRAP UP/)
})

test('verdicts are pre-filled wherever they appear', () => {
  assert.match(buildWorksheet(FIXTURE), /> \*\*VERDICT\*\* ✎ pre-filled[^\n]*\n> Five tools, five approaches\./)
})

test('SHOW, EDIT and RULES never reach the worksheet', () => {
  const ws = buildWorksheet(FIXTURE)
  for (const banned of ['**SHOW**', '**EDIT**', 'RULES', 'One portrait full-screen', 'Red box. Glitch sound.', 'Skim each platform panel', 'Orientation only']) {
    assert.ok(!ws.includes(banned), `worksheet must not contain ${banned}`)
  }
})

test('every body slot carries a facts block and a bare word target', () => {
  const ws = buildWorksheet(FIXTURE)
  assert.match(ws, /<details><summary>Facts for this beat<\/summary>/)
  assert.ok(ws.includes('target — words'), 'generator emits the target unstamped for the session')
})
```

**Verify**: `cd pipelines/youtube/yt-script-2 && node --test test/worksheet.test.mjs` → `# fail 0`, `# pass 9`

### Step 4: Add the byte-identity gate over the three real outlines

This is the assertion the mutation gate targets. Append:

```js
// Every pre-filled block in the worksheet must be BYTE-IDENTICAL to the outline's.
// A retyped intro can drop a word and that word goes to camera.
function prefilledQuoteBlocks(worksheet) {
  const out = []
  const lines = worksheet.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('✎ pre-filled')) continue
    if (lines[i].startsWith('> **VERDICT**')) continue // verdict text is re-flowed by design
    let j = i + 1
    while (j < lines.length && lines[j].trim() === '') j++
    const blk = []
    while (j < lines.length && /^>/.test(lines[j])) blk.push(lines[j]), j++
    if (blk.length) out.push(blk.join('\n'))
  }
  return out
}

function outlineQuoteBlocks(md) {
  return parse(md)
    .filter((b) => b.t === 'lane' && b.kind === 'SAY' && b.spoken)
    .map((b) => b.raw.map((l) => (l ? '> ' + l : '>')).join('\n'))
}

for (const key of REAL) {
  test(`PREFILLED_DRIFT check — ${key}`, () => {
    const md = readFileSync(join(VIDEOS, key, 'outline.md'), 'utf8')
    const got = prefilledQuoteBlocks(buildWorksheet(md))
    const want = outlineQuoteBlocks(md)
    assert.ok(got.length > 0, `${key}: no pre-filled blocks found at all`)
    for (const block of got) {
      assert.ok(
        want.includes(block),
        `PREFILLED_DRIFT in ${key}: a pre-filled block is not byte-identical to outline.md.\n--- worksheet ---\n${block}\n`
      )
    }
  })
}

test('PREFILLED_DRIFT check covers a real intro end to end', () => {
  const md = readFileSync(join(VIDEOS, 'character-consistency-ai', 'outline.md'), 'utf8')
  const ws = buildWorksheet(md)
  assert.ok(
    ws.includes('> "Perfect face. Perfect outfit. Exactly the character you wanted.'),
    'PREFILLED_DRIFT: the real cold-open line did not survive verbatim'
  )
})
```

**Verify**: `cd pipelines/youtube/yt-script-2 && node --test test/worksheet.test.mjs` → `# fail 0`, `# pass 13`

### Step 5: Prove the gate can fire, then revert

A gate that cannot fail reads as coverage. Prove this one bites, by hand, before
boss ever runs its own mutation.

Run the frontmatter's own recipe, verbatim, from the repo root:

```bash
perl -pi -e "s/^const QUOTE_JOIN = .\\n.$/const QUOTE_JOIN = ' '/" pipelines/youtube/yt-script-2/render-worksheet.mjs
grep -n "^const QUOTE_JOIN" pipelines/youtube/yt-script-2/render-worksheet.mjs   # must show ' '
cd pipelines/youtube/yt-script-2 && node --test test/worksheet.test.mjs          # MUST fail
```

The failure output **must** contain `PREFILLED_DRIFT`. Then revert
(`QUOTE_JOIN = '\n'`) and re-run: it must pass again.

Expected when mutated: `# pass 10`, `# fail 3` — the three per-outline
`PREFILLED_DRIFT` tests. (The 4th, "covers a real intro end to end", still passes
under this mutation because its substring survives a space-join; that is known and
fine, the three real ones are the gate.)

If step 2 passes, or fails without printing `PREFILLED_DRIFT`, the gate is broken:
**STOP and report** — do not proceed to the doc steps.

**Verify**: after reverting, `cd pipelines/youtube/yt-script-2 && node --test test/worksheet.test.mjs` → `# fail 0`. Record in your run-log that the mutation fired.

### Step 6: Update `SKILL.md`

In `pipelines/.claude/skills/yt-script-2/SKILL.md`:

**6a.** In the folder tree, after the `render-script.mjs` line, add:

```
├── render-worksheet.mjs       outline.md -> script-worksheet.md (the write file)
```

**6b.** In the same tree's `videos/<key>/` block, immediately before the
`├── script-draft.md` line, add:

```
    ├── script-worksheet.md    step 2 — the WRITE artifact sent to the maker.
    │                          Voiceover only; pre-filled copy + empty slots
```

**6c.** Find this line in the four-steps table:

```
| 2 | `knowledge.md` | `outline.md` + PDF | yours |
```

Replace it with:

```
| 2 | `knowledge.md` | `outline.md` + PDF (read) + `script-worksheet.md` (write) | yours |
```

**6d.** At the end of "### Step 2 — the outline", replace the final numbered item
`5. **Stop and wait for approval.** Do not start the script.` with:

```
5. Generate the write artifact: `node render-worksheet.mjs <key>` →
   `script-worksheet.md`. It is voiceover only — pre-filled copy for every
   finished beat, an empty slot for every body beat. The generator emits each
   body beat with a bare `target — words` marker and an empty
   `Facts for this beat` block.
6. **Fill both, per body beat**: the word target from `SCRIPT-INSTRUCTIONS.md`'s
   budgets, and the facts from `knowledge.md` that back that beat, each with a
   `src:` line naming its `knowledge.md` heading. A beat with no supporting facts
   gets `- none — this beat is his screen time`; an empty block is a bug. Facts
   are **copied**, never restated from memory — the no-research rule binds here
   exactly as at step 1.
7. The owner sends the maker **both** files: `outline.pdf` to read, and
   `script-worksheet.md` to fill.
8. **Stop and wait for approval.** Do not start the script.
```

**6e.** In "### Step 3 — the final AI-VO script", replace step 1 (`1. **Store the
draft verbatim first** ...`) with:

```
1. **Store the draft verbatim first** as `videos/<key>/script-draft.md`, before
   changing a single character. Never edit it in place, then or later — it is the
   record of what the team member actually wrote. If it arrived as a link or an
   attachment, keep the original in `sources/` as well.
2. **Diff it against what was sent**: `diff script-worksheet.md script-draft.md`.
   This splits his return into two piles — empty slots he filled (expected) and
   pre-filled text he changed (the owner must see every one of these). Pre-filled
   copy is his to change if his screen time showed it wrong, so a change here is
   legitimate, not a violation; it just may never pass silently. Every one becomes
   its own line in the step-7 change report.
```

Then renumber the remaining items of that step from 3 onwards (the old 2–7 become
3–8), leaving their text unchanged except as specified in 6f.

**6f.** In the same step, in the item that begins `4. Write
`videos/<key>/script.md``, append this sentence to it:

```
   The maker no longer writes `Notes`: pull the matching beat's `SHOW` and `EDIT`
   lanes out of `outline.md` and fold them into `script.md`'s `Notes` blocks
   yourself. That is mechanical — every `Notes` block in the two existing scripts
   is a reworded SHOW/EDIT pair — so it never needed his keyboard.
```

**Verify**: `grep -c "render-worksheet.mjs\|script-worksheet.md" pipelines/.claude/skills/yt-script-2/SKILL.md` → at least `5`

### Step 7: Update the folder `CLAUDE.md`

In `pipelines/youtube/yt-script-2/CLAUDE.md`:

**7a.** In the `## What this folder is` step table, replace the row

```
| 2 | `knowledge.md` | `outline.md` → the PDF the tutorial maker gets |
```

with

```
| 2 | `knowledge.md` | `outline.md` → `outline.pdf` (he reads) + `script-worksheet.md` (he fills) |
```

**7b.** In the `## Layout` code block, after the `render-script.mjs` line add:

```
render-worksheet.mjs       outline.md -> script-worksheet.md (voiceover only)
```

and immediately before the `├── script-draft.md` line add:

```
├── script-worksheet.md    step 2 — the write file. Pre-filled copy + empty slots
```

**7c.** In `## Rendering`, after the `render-script.mjs` command pair, add:

```bash
node render-worksheet.mjs <key>           # writes script-worksheet.md
node render-worksheet.mjs <key> --force   # overwrite (loses hand-written fact packs)
```

**7d.** Append to `## The traps`:

```
- **The worksheet is voiceover only.** No `SHOW`, no `EDIT`, no rules boxes, no
  tables. Those are in `outline.pdf`, which he reads beside it. Repeating them in
  the worksheet is the exact mistake the format exists to prevent, and a test
  asserts they are absent.
- **Pre-filled copy is copied, never retyped.** `render-worksheet.mjs` reproduces
  the outline's blockquote lines byte for byte, so a word cannot drift on its way
  to camera. Do not route spoken copy through a paragraph-joining helper —
  `render-outline.mjs`'s `splitParas` joins lines with a space, which is correct
  for HTML and fatal here. The `PREFILLED_DRIFT` test is the guard.
- **`--force` loses work.** The fact packs in a worksheet are hand-written by the
  step-2 session and are not regenerable.
```

**Verify**: `grep -c "render-worksheet" pipelines/youtube/yt-script-2/CLAUDE.md` → at least `4`

### Step 8: Update `SCRIPT-INSTRUCTIONS.md` and `.gitignore`

**8a.** In `pipelines/youtube/yt-script-2/SCRIPT-INSTRUCTIONS.md`, replace the
opening flow block:

```
outline.pdf  →  [ team member records + writes the demo lines ]  →  script-draft.md
script-draft.md  →  [ this file ]  →  script.md  +  script.vo.txt
```

with:

```
outline.md   →  outline.pdf            the READ file: show, edit, rules
     └──────→  script-worksheet.md     the WRITE file: voiceover only,
                                       pre-filled copy + empty slots + facts
script-worksheet.md  →  [ he fills the slots ]  →  script-draft.md
script-draft.md      →  [ this file ]           →  script.md + script.vo.txt
```

**8b.** In the same file, in `## What you may and may not change`, append to the
**Change freely** list:

```
- Fold the beat's `SHOW`/`EDIT` lanes from `outline.md` into its `Notes` block —
  he no longer writes Notes at all.
```

**8c.** In the same file, in the `# The VO polish pass` section under
`## 3 · Punctuation is the pacing track`, no change. Instead append a new
subsection at the very end of the file:

```markdown
## 7 · Word targets

`script-worksheet.md` carries a `target <n>–<n> words` marker on each body beat,
stamped by the step-2 session from the budgets above. Check his draft against it
and flag a beat that missed by more than ~40%: a 200-word answer to a 50–90-word
slot is a beat that will not cut, and it is cheaper to say so now than after the
voiceover is rendered.
```

**8d.** In `pipelines/youtube/yt-script-2/.gitignore`, no new ignore rule is
needed (`script-worksheet.md` is tracked). Update the existing comment block so
the tracked-file list is accurate — replace:

```
# knowledge.md, outline.md, script-draft.md, script.md and script.vo.txt ARE
# tracked — they are the sources and the deliverables. Only the renders are not.
```

with:

```
# knowledge.md, outline.md, script-worksheet.md, script-draft.md, script.md and
# script.vo.txt ARE tracked — they are the sources and the deliverables (the
# worksheet doubles as the diff baseline for what the maker changed). Only the
# HTML/PDF renders are not.
```

**Verify**: `grep -c "script-worksheet" pipelines/youtube/yt-script-2/SCRIPT-INSTRUCTIONS.md pipelines/youtube/yt-script-2/.gitignore` → both at least `1`

### Step 9: Add the doc assertions to the test suite

`test_cmd` must be able to fail on the doc work too, or the doc steps are optional
in practice (`plans/runs/LESSONS.md` 2026-07-21, 2026-08-17). Append to
`test/worksheet.test.mjs`:

```js
const DOC_CHECKS = [
  ['../../../.claude/skills/yt-script-2/SKILL.md', ['render-worksheet.mjs', 'script-worksheet.md', 'diff script-worksheet.md script-draft.md', 'target — words']],
  ['../CLAUDE.md', ['render-worksheet.mjs', 'voiceover only', 'PREFILLED_DRIFT']],
  ['../SCRIPT-INSTRUCTIONS.md', ['script-worksheet.md', 'Word targets']],
  ['../.gitignore', ['script-worksheet.md']],
]

for (const [rel, needles] of DOC_CHECKS) {
  test(`docs updated — ${rel.split('/').pop()}`, () => {
    const p = join(HERE, rel)
    assert.ok(existsSync(p), `missing ${p}`)
    const txt = readFileSync(p, 'utf8')
    for (const n of needles) assert.ok(txt.includes(n), `${rel} must mention "${n}"`)
  })
}
```

Note the SKILL.md path: from `test/`, the skill lives at
`../../../.claude/skills/yt-script-2/SKILL.md` (up out of `test/`, `yt-script-2/`,
`youtube/` to `pipelines/`). Verify that path resolves before trusting the test.

**Verify**: `cd pipelines/youtube/yt-script-2 && node --test test/worksheet.test.mjs` → `# fail 0`, `# pass 17`

### Step 10: End-to-end smoke on a real video, then clean up

```bash
cd pipelines/youtube/yt-script-2
node render-worksheet.mjs character-consistency-ai        # exit 0, prints the path
node render-worksheet.mjs character-consistency-ai        # exit 1, "already exists"
node render-worksheet.mjs character-consistency-ai --force # exit 0
wc -l videos/character-consistency-ai/script-worksheet.md  # non-trivial, >100 lines
grep -c "SHOW\|EDIT" videos/character-consistency-ai/script-worksheet.md  # 0
rm videos/character-consistency-ai/script-worksheet.md     # DO NOT COMMIT IT
```

The generated worksheet for a real video is **not** part of this plan's
deliverable — the step-2 session generates it when it runs. Delete it before
committing.

**Verify**: `git status --short pipelines/youtube/yt-script-2/videos/` → empty output

### Step 11: Fresh-checkout gate run

Crews verify inside worktrees carrying their own artifacts. Prove the gate passes
on a pristine tree:

```bash
git stash list                      # note anything pre-existing
git clean -nxd pipelines/youtube/yt-script-2   # DRY RUN — review what it would remove
git clean -fxd pipelines/youtube/yt-script-2   # only if the dry run lists nothing you need
cd pipelines/youtube/yt-script-2 && node --test test/worksheet.test.mjs
```

**Verify**: `# fail 0` on the cleaned tree.

## Test plan

One new file, `pipelines/youtube/yt-script-2/test/worksheet.test.mjs`, using
`node:test` + `node:assert/strict` (no dependencies, matching the repo's other
suite at `tooling/cli/ccusage-dashboard/test/`). 17 tests in four groups:

1. **Parser** (3) — raw quote lines preserved, `bodyPartIndex` finds BODY, throws
   `NO_BODY_PART` when absent.
2. **Emitter** (6) — intro pre-filled vs body slotted, the `final` note, tail part
   letter regardless of wording, verdicts pre-filled, SHOW/EDIT/RULES absent,
   facts block + bare target present.
3. **Byte identity** (4) — `PREFILLED_DRIFT` over all three real outlines plus one
   literal end-to-end line. This is the mutation gate's target.
4. **Docs** (4) — each edited doc contains its required strings, so `test_cmd`
   fails if a doc step was skipped.

No test opens a server or a process, so no teardown hazard applies.

## Done criteria

- [ ] `cd pipelines/youtube/yt-script-2 && node --test test/worksheet.test.mjs` exits 0
- [ ] That run reports `# fail 0` and `# pass 17` (a lower pass count means a test group was dropped)
- [ ] `test -f pipelines/youtube/yt-script-2/test/worksheet.test.mjs` and `test -f pipelines/youtube/yt-script-2/render-worksheet.mjs` both succeed
- [ ] The mutation was proven to fire in Step 5, and the run-log records it
- [ ] `node render-worksheet.mjs character-consistency-ai` exits 0; a second run without `--force` exits 1
- [ ] `git status --short pipelines/youtube/yt-script-2/videos/` is empty (no generated worksheet committed)
- [ ] `git diff --stat 2d9caf75..HEAD --name-only` lists only the files in this plan's In-scope list
- [ ] `grep -rn "Co-Authored-By\|Generated with\|🤖" $(git diff --name-only 2d9caf75..HEAD)` returns nothing
- [ ] The gate passes on a freshly cleaned tree (Step 11)
- [ ] `git diff --name-only 2d9caf75..HEAD` does NOT include `plans/README.md`

## STOP conditions

- **Gate integrity.** If an assertion fails, fix the code or the fixture.
  Weakening, swapping, softening or deleting an assertion — including changing an
  expected pass count to match reality — is a STOP. Report instead.
- **The mutation does not fire** (Step 5 passes with the join broken, or fails
  without printing `PREFILLED_DRIFT`). The gate is then fake. STOP.
- **Byte identity cannot be achieved** for one of the three real outlines. Do NOT
  relax the assertion to a fuzzy or normalised comparison. Report the exact
  outline and block.
- **You want to edit `render-outline.mjs` or `render-script.mjs`.** STOP. The
  outline PDF's print CSS fails silently when disturbed; extracting a shared
  parser is explicitly out of scope.
- **An outline has no `BODY` part.** The generator must throw. Do not add a
  fallback that guesses which half is draft copy.
- **A doc anchor from Steps 6–8 is not found verbatim.** The file has moved on
  since `2d9caf75`. Report the anchor and the surrounding lines; do not paste the
  block somewhere approximate.
- **You are about to write prose not authored in this plan** into any of the three
  docs. Every block is inlined. STOP and report the gap instead of composing.
- **5 self-fix attempts** on the same failing criterion: write
  `BLOCKED: done criteria unreachable after 5 attempts` and stop.

## Maintenance notes

- **The parser is duplicated on purpose**, a third time (`render-outline.mjs`,
  `render-script.mjs`, now `render-worksheet.mjs`). The alternative — extracting a
  shared module — puts the load-bearing outline PDF at risk for no gain today. The
  `PREFILLED_DRIFT` tests run against the real outlines, so a divergence between
  the outline grammar and this parser fails the gate rather than drifting quietly.
  If a fourth consumer appears, extract then.
- **Forward hooks are the known rough edge.** Body forward-hook beats are used
  verbatim by the maker today but land as draft slots under the positional rule.
  The `**SAY** — final` note is the escape hatch; nothing in `videos/` uses it yet.
  If the maker reports pasting references a lot, the fix is to mark those lanes in
  `OUTLINE-INSTRUCTIONS.md`, not to add heading-text heuristics here.
- **Verdict text is deliberately re-flowed**, not byte-copied — the outline stores
  it as a single joined string, so `prefilledQuoteBlocks` skips it. If verdicts
  ever need byte identity, the parser must keep their raw lines too.
- **`QUOTE_JOIN` is a named constant for the mutation gate's benefit**, not for
  configurability. Inlining it back into `requote()` leaves the gate with no
  single-line target, and the frontmatter recipe silently stops matching — which
  reads as a passing mutation check. If you refactor it, update `mutation_apply`
  in the same commit.
- **A reviewer should scrutinise**: that `QUOTE_JOIN` is still `'\n'`; that no
  `SHOW`/`EDIT` content leaked into the worksheet; and that the doc assertions in
  Step 9 still match the real doc wording after any future doc edit.
- **Step 4 of the pipeline (VO generation) is still unwired.** Nothing here
  touches it.
