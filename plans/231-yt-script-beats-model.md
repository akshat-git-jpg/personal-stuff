---
executor: agy
model:
test_cmd: cd pipelines/youtube/yt-script && node --test test/beats.test.mjs test/worksheet.test.mjs
ui:
deploy:
needs: []
needs_prs: []
touches: [pipelines/youtube/yt-script/lib/beats.mjs, pipelines/youtube/yt-script/render-worksheet.mjs, pipelines/youtube/yt-script/OUTLINE-INSTRUCTIONS.md, pipelines/youtube/yt-script/test/beats.test.mjs]

mutation_apply: perl -0pi -e "s/const BODY_DRAFTS_ARE_INSTRUCTIONS = true/const BODY_DRAFTS_ARE_INSTRUCTIONS = false/" pipelines/youtube/yt-script/lib/beats.mjs
mutation_command: cd pipelines/youtube/yt-script && node --test test/beats.test.mjs
mutation_expect: BODY_DRAFT_LEAKED
mutation_cwd:
mutation_timeout:
---

# Plan 231: `lib/beats.mjs` — one parsed beat model for `outline.md`

## Summary

- **Problem statement**: `outline.md` is parsed twice today (`render-outline.mjs` for the PDF, `render-worksheet.mjs` for the write file) and neither exposes a reusable structured model. The new script-desk UI (plans 232–233) needs the outline as typed JSON — beats, lanes, and which beats are pre-filled copy versus ones the maker writes.
- **Goals**:
  - Add `pipelines/youtube/yt-script/lib/beats.mjs` exporting `buildBeats(md)` → `{ title, beats: [...] }`.
  - Add a `**FACTS**` lane to `OUTLINE-INSTRUCTIONS.md` and teach the parser to read it.
  - Keep `render-worksheet.mjs` output **byte-identical** — its 20 existing tests must stay green.
  - Land a firing gate proving a body SAY draft never lands in a beat's spoken copy.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High)
- **Done criteria** (terse): `node --test test/beats.test.mjs test/worksheet.test.mjs` exits 0 with 20 worksheet tests still passing.
- **Stop conditions** (terse): any worksheet byte-identity test fails; you are tempted to weaken an assertion.
- **Test / verification for success**: `node:test` unit tests plus byte-identity regression against three real outlines.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ca36925c..HEAD -- pipelines/youtube/yt-script/`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `ca36925c`, 2026-08-23

## Why this matters

The owner is replacing the `outline.pdf` + `script-worksheet.md` handoff with a single hosted page (plans 232–233). That page needs the outline as data: for each beat, what the maker reads aloud, what he writes himself, and what the recording/edit/fact instructions are — held apart, because the whole point of the new UI is that instructions never sit in the same vertical stream as the words.

There is already a working parser inside `render-worksheet.mjs`. Do not write a second one. This plan lifts a structured model on top of the existing `parse()` so both consumers agree about what a beat is, and locks the one rule that matters with a mutation-proven test.

**The load-bearing rule** (decisions.md 2026-08-18): a BODY beat's `**SAY**` lane is a short draft prompt, **not** finished copy, and it must never be shown to the maker as something he can paste. In this model it becomes `angle` — an instruction — and `say` stays `null`. Getting this backwards silently recreates the exact copy-paste failure the owner removed in plan 207.

## Current state

### `pipelines/youtube/yt-script/render-worksheet.mjs`

Exports `parse(md)`, `bodyPartIndex(blocks)`, `buildWorksheet(md)`. `parse` returns a flat block list:

```js
{ t: 'title',   text }
{ t: 'part',    text }            // `## 1 · INTRODUCTION`
{ t: 'section', text }            // `### SECTION: Live Demo`, `SECTION:` stripped
{ t: 'beat',    text }            // `#### 2.3 · HeyGen`
{ t: 'lane',    kind, note, raw, spoken }   // kind SAY|SHOW|EDIT; spoken=true means raw came from a `>` blockquote
{ t: 'quote',   raw }
{ t: 'rules' }                    // NOTE: raw is currently DROPPED
{ t: 'verdict', text }
```

Two constants matter:

```js
const LANE_RE = /^\*\*(SAY|SHOW|EDIT)\*\*(?:\s*[—-]\s*(.*))?$/i
```

and inside the quote branch:

```js
      if (/^\*\*RULES\b/i.test(head)) blocks.push({ t: 'rules' })
```

`bodyPartIndex(blocks)` returns the index of the `## … BODY …` part heading and throws `NO_BODY_PART` if absent. Parts before it are intro, the part itself is body, parts after are outro. `buildWorksheet` uses that split for its A/B/C letters.

### `pipelines/youtube/yt-script/test/worksheet.test.mjs`

20 tests, all green today. Three of them assert byte-identity of the regenerated worksheet against the checked-in one for the real videos:

```js
const REAL = ['ai-avatar-generator-comparison', 'ai-avatar-generators', 'character-consistency-ai']
```

**These are your safety net. They must still pass at the end.**

### `pipelines/youtube/yt-script/OUTLINE-INSTRUCTIONS.md`

Owner-owned. It carries the table of recognised markdown forms:

```
| `**SAY**` alone on a line, then a `>` blockquote | Amber chip, serif text, amber rail |
| `**SHOW**` alone on a line, then plain lines | Teal chip, sans text, teal rail |
| `**EDIT**` alone on a line, then plain lines | Rose chip, sans text, rose rail |
```

There is no `FACTS` lane today. The three real outlines contain zero of them, so adding it is additive — every existing outline parses to `facts: []`.

### Real data you can check against

`pipelines/youtube/yt-script/videos/character-consistency-ai/outline.md` — 26 `####` beats, 25 `**SAY**`, 12 `**SHOW**`, 2 `**EDIT**`. Beat headings look like `#### 2.9 · Remembering the character next week`. Some beats (`#### 2.4`, `#### 2.6`) carry no lanes at all.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run both suites (the merge gate) | `cd pipelines/youtube/yt-script && node --test test/beats.test.mjs test/worksheet.test.mjs` | exit 0, `fail 0` |
| Run only the existing suite | `cd pipelines/youtube/yt-script && node --test test/worksheet.test.mjs` | exit 0, `pass 20` |
| Eyeball the model on real data | `cd pipelines/youtube/yt-script && node lib/beats.mjs character-consistency-ai \| head -40` | JSON, first beat has `"num"` and `"title"` |

## Scope

**In scope**:
- `pipelines/youtube/yt-script/lib/beats.mjs` (new)
- `pipelines/youtube/yt-script/render-worksheet.mjs` (two surgical edits only — see Step 1)
- `pipelines/youtube/yt-script/OUTLINE-INSTRUCTIONS.md` (add the FACTS row + a short section)
- `pipelines/youtube/yt-script/test/beats.test.mjs` (new)

**Out of scope**:
- `render-outline.mjs` and `render-script.mjs` — they have their own parsers on purpose (each one's header explains why). Do not consolidate them.
- `test/worksheet.test.mjs` — do not edit it. If it fails, your change is wrong.
- Any file under `videos/` — never regenerate or edit a checked-in outline or worksheet.
- `apps/` — the UI is plans 232–233.

## Git workflow

- Branch: `advisor/231-yt-script-beats-model`
- Commit: `feat(yt-script): structured beat model for the script desk` — no AI footers. Do NOT push.

## Steps

### Step 1: Two surgical edits to `render-worksheet.mjs`

Both are additive; neither changes worksheet output.

**1a.** Widen the lane regex to admit `FACTS`:

```js
const LANE_RE = /^\*\*(SAY|SHOW|EDIT|FACTS)\*\*(?:\s*[—-]\s*(.*))?$/i
```

`buildWorksheet` already drops every non-`SAY` lane, so a `FACTS` lane produces no worksheet output.

**1b.** Stop discarding the RULES body. Change:

```js
      if (/^\*\*RULES\b/i.test(head)) blocks.push({ t: 'rules' })
```

to:

```js
      if (/^\*\*RULES\b/i.test(head)) blocks.push({ t: 'rules', raw })
```

`buildWorksheet` never reads `rules` blocks, so this is invisible to it.

**Verify**: `cd pipelines/youtube/yt-script && node --test test/worksheet.test.mjs` → `pass 20`, `fail 0`.

### Step 2: Create `lib/beats.mjs`

Create the directory `pipelines/youtube/yt-script/lib/` and write this file **exactly**. The named constant `BODY_DRAFTS_ARE_INSTRUCTIONS` is the mutation gate's single target — keep it on its own line and do not inline it.

```js
#!/usr/bin/env node
// One structured beat model for an outline.md, shared by the script desk UI.
//
// This does NOT own a parser. It lifts a typed model on top of the block parser
// already inside render-worksheet.mjs, so the worksheet and the desk can never
// disagree about what a beat is.
//
//   import { buildBeats } from './lib/beats.mjs'
//   node lib/beats.mjs <key>            # prints JSON for videos/<key>/outline.md
//
// The load-bearing rule (decisions.md 2026-08-18): a BODY beat's SAY lane is a
// short DRAFT PROMPT, not finished copy. It must never reach the maker as
// something he can paste — plan 207 removed exactly that. So a body draft lands
// in `angle` (an instruction, shown in the desk's instruction track) and `say`
// stays null. An intro/outro SAY, or a body SAY explicitly noted `— final`, is
// finished copy and lands in `say`.

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, bodyPartIndex } from '../render-worksheet.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

// Single mutation target. Setting this to false routes body SAY drafts into
// `say`, i.e. straight to the maker as pasteable copy — the exact defect the
// gate must catch. Do not inline it back into the condition.
const BODY_DRAFTS_ARE_INSTRUCTIONS = true

// `#### 2.9 · Remembering the character next week` -> ['2.9', 'Remembering …']
const BEAT_RE = /^([0-9A-Za-z][0-9A-Za-z.]*)\s*·\s*(.*)$/

export function buildBeats(md) {
  const blocks = parse(md)
  const bodyIdx = bodyPartIndex(blocks)
  const title = blocks.find((b) => b.t === 'title')?.text ?? 'Untitled'

  const partIdxs = blocks.map((b, n) => (b.t === 'part' ? n : -1)).filter((n) => n >= 0)
  const partKindFor = (n) => {
    const owning = partIdxs.filter((p) => p <= n).pop()
    if (owning === undefined || owning < bodyIdx) return 'intro'
    if (owning === bodyIdx) return 'body'
    return 'outro'
  }

  const beats = []
  let curPart = null
  let curPartKind = 'intro'
  let curSection = null
  let curRules = []
  let pending = null

  const flush = () => {
    if (pending) beats.push(pending)
    pending = null
  }

  for (let n = 0; n < blocks.length; n++) {
    const b = blocks[n]

    if (b.t === 'part') {
      flush()
      curPart = b.text
      curPartKind = partKindFor(n)
      curSection = null
      curRules = []
      continue
    }

    if (b.t === 'section') {
      flush()
      curSection = b.text
      curRules = []
      continue
    }

    if (b.t === 'rules') {
      // raw[0] is the `**RULES — …**` header line; the rest are `- item` lines.
      curRules = (b.raw ?? [])
        .slice(1)
        .map((l) => l.replace(/^\s*-\s*/, '').trim())
        .filter(Boolean)
      continue
    }

    if (b.t === 'beat') {
      flush()
      const m = b.text.match(BEAT_RE)
      pending = {
        num: m ? m[1] : String(beats.length + 1),
        title: (m ? m[2] : b.text).trim(),
        part: curPart,
        partKind: curPartKind,
        section: curSection,
        mode: curPartKind === 'body' ? 'write' : 'read',
        say: null,
        angle: null,
        show: [],
        edit: [],
        facts: [],
        rules: curRules.slice(),
        verdict: null,
      }
      continue
    }

    if (!pending) continue

    if (b.t === 'verdict') {
      pending.verdict = b.text
      continue
    }

    if (b.t === 'lane') {
      if (b.kind === 'SAY') {
        const isFinal = (b.note || '').trim().toLowerCase() === 'final'
        if (curPartKind === 'body' && !isFinal && BODY_DRAFTS_ARE_INSTRUCTIONS) {
          pending.angle = b.raw.slice()
          pending.mode = 'write'
        } else {
          pending.say = b.raw.slice()
          pending.mode = 'read'
        }
      } else if (b.kind === 'SHOW') {
        pending.show.push(...b.raw)
      } else if (b.kind === 'EDIT') {
        pending.edit.push(...b.raw)
      } else if (b.kind === 'FACTS') {
        pending.facts.push(...b.raw)
      }
      continue
    }
  }

  flush()
  return { title, beats }
}

// ---------------------------------------------------------------- CLI

function main(argv) {
  const arg = argv[0]
  if (!arg) {
    console.error('usage: node lib/beats.mjs <key|path/to/outline.md>')
    process.exit(1)
  }
  const inPath = arg.endsWith('.md')
    ? resolve(arg)
    : join(HERE, '..', 'videos', arg, 'outline.md')
  if (!existsSync(inPath)) {
    console.error(`no outline at ${inPath}`)
    process.exit(1)
  }
  process.stdout.write(JSON.stringify(buildBeats(readFileSync(inPath, 'utf8')), null, 2) + '\n')
}

if (process.argv[1] && basename(process.argv[1]) === 'beats.mjs') {
  main(process.argv.slice(2))
}
```

**Verify**: `cd pipelines/youtube/yt-script && node lib/beats.mjs character-consistency-ai | head -30` → JSON starting with a `"title"` key, then a `"beats"` array whose first entry has `"num"`, `"title"`, `"mode"`.

### Step 3: Add the FACTS lane to `OUTLINE-INSTRUCTIONS.md`

Add one row to the forms table, immediately after the `**EDIT**` row:

```
| `**FACTS**` alone on a line, then plain lines | Slate chip, sans text — numbers for this beat |
```

Then add this short section immediately before the `## The rules box` heading:

```markdown
## The FACTS lane

A beat may carry a `**FACTS**` lane: the numbers, prices, limits and product
names that beat depends on, lifted from `knowledge.md`. Plain lines, never a
blockquote — it is not spoken.

```
**FACTS**
Higgsfield Soul ID trains once, about 5 minutes.
Midjourney needs the reference URL pasted into every prompt.
```

It exists so the script desk can put a beat's numbers beside that beat instead
of making the maker hunt through the whole knowledge file. It is optional: an
outline with no FACTS lanes parses fine and the desk simply shows no facts.

**FACTS is never spoken copy.** Putting it in a blockquote makes the parser
treat it as prose, and the desk will not show it.
```

**Verify**: `grep -c 'FACTS' pipelines/youtube/yt-script/OUTLINE-INSTRUCTIONS.md` → `5` or more.

### Step 4: Write `test/beats.test.mjs`

Create the file. Every assertion that guards the load-bearing rule must carry the literal marker `BODY_DRAFT_LEAKED` **in its assertion message only** — never in a test name, never in a passing code path, because boss greps the failure output for it.

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBeats } from '../lib/beats.mjs'
import { buildWorksheet } from '../render-worksheet.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const VIDEOS = join(ROOT, 'videos')
const REAL = ['ai-avatar-generator-comparison', 'ai-avatar-generators', 'character-consistency-ai']

const FIXTURE = `# Test Video Title

## 1 · INTRODUCTION

#### A1 · Cold open

**SAY**
> "Perfect face. Perfect outfit."
>
> "Scene two. Different person."

**SHOW**
One portrait full-screen.

## 2 · BODY

### SECTION: The test

> **RULES — WHOLE SECTION**
> - No replay of the scene grid.
> - Animation only.

#### 2.1 · Five scenes, five tools

**SAY**
> Cover how the grids came back.

**SHOW**
Run the same prompt through all five tools.

**EDIT**
Side-by-side grid.

**FACTS**
Soul ID trains once, about 5 minutes.
Midjourney needs the URL pasted every time.

#### 2.2 · A locked body line

**SAY** — final
> "This one is finished copy and stays finished."

#### 2.3 · Notes only

**SHOW**
Just a screen recording note, no spoken lane.

## 3 · CONCLUSION

#### C1 · Sign off

**SAY**
> "Links below."

> **VERDICT:** OpenArt wins on memory.
`

const fx = () => buildBeats(FIXTURE)
const byNum = (n) => fx().beats.find((b) => b.num === n)

test('the title comes off the H1', () => {
  assert.equal(fx().title, 'Test Video Title')
})

test('beat number and title split on the middot', () => {
  const b = byNum('2.1')
  assert.ok(b, 'beat 2.1 must exist')
  assert.equal(b.title, 'Five scenes, five tools')
})

test('an intro SAY is finished copy', () => {
  const b = byNum('A1')
  assert.equal(b.mode, 'read')
  assert.deepEqual(b.say, ['"Perfect face. Perfect outfit."', '', '"Scene two. Different person."'])
  assert.equal(b.angle, null)
})

test('a body SAY draft becomes an instruction, never spoken copy', () => {
  const b = byNum('2.1')
  assert.equal(b.mode, 'write', 'BODY_DRAFT_LEAKED: body beat 2.1 must be a write beat')
  assert.equal(
    b.say,
    null,
    'BODY_DRAFT_LEAKED: a body SAY draft reached `say`, so the maker would see it as pasteable copy'
  )
  assert.deepEqual(b.angle, ['Cover how the grids came back.'])
})

test('no real outline puts a body draft into say', () => {
  for (const key of REAL) {
    const md = readFileSync(join(VIDEOS, key, 'outline.md'), 'utf8')
    for (const b of buildBeats(md).beats) {
      if (b.partKind === 'body' && b.say !== null && b.angle === null) {
        assert.ok(
          b.mode === 'read',
          `BODY_DRAFT_LEAKED: ${key} beat ${b.num} has spoken copy without being marked final`
        )
      }
      assert.ok(
        !(b.say !== null && b.angle !== null),
        `BODY_DRAFT_LEAKED: ${key} beat ${b.num} carries both say and angle`
      )
    }
  }
})

test('a body SAY noted `final` stays finished copy', () => {
  const b = byNum('2.2')
  assert.equal(b.mode, 'read')
  assert.deepEqual(b.say, ['"This one is finished copy and stays finished."'])
  assert.equal(b.angle, null)
})

test('a body beat with no SAY at all is still a write beat', () => {
  const b = byNum('2.3')
  assert.equal(b.mode, 'write')
  assert.equal(b.say, null)
  assert.equal(b.angle, null)
  assert.deepEqual(b.show, ['Just a screen recording note, no spoken lane.'])
})

test('SHOW, EDIT and FACTS land in their own arrays', () => {
  const b = byNum('2.1')
  assert.deepEqual(b.show, ['Run the same prompt through all five tools.'])
  assert.deepEqual(b.edit, ['Side-by-side grid.'])
  assert.deepEqual(b.facts, [
    'Soul ID trains once, about 5 minutes.',
    'Midjourney needs the URL pasted every time.',
  ])
})

test('section RULES attach to every beat in that section', () => {
  for (const n of ['2.1', '2.2', '2.3']) {
    assert.deepEqual(byNum(n).rules, ['No replay of the scene grid.', 'Animation only.'])
  }
  assert.deepEqual(byNum('A1').rules, [])
})

test('part kind splits on the BODY heading', () => {
  assert.equal(byNum('A1').partKind, 'intro')
  assert.equal(byNum('2.1').partKind, 'body')
  assert.equal(byNum('C1').partKind, 'outro')
})

test('a verdict attaches to the beat it follows', () => {
  assert.equal(byNum('C1').verdict, 'OpenArt wins on memory.')
})

test('every real outline parses and every beat has a num and a title', () => {
  for (const key of REAL) {
    const md = readFileSync(join(VIDEOS, key, 'outline.md'), 'utf8')
    const { beats } = buildBeats(md)
    assert.ok(beats.length > 5, `${key}: expected more than 5 beats, got ${beats.length}`)
    for (const b of beats) {
      assert.ok(b.num && String(b.num).length, `${key}: a beat has no num`)
      assert.ok(b.title && b.title.length, `${key}: beat ${b.num} has no title`)
      assert.ok(['read', 'write'].includes(b.mode), `${key}: beat ${b.num} has mode ${b.mode}`)
    }
  }
})

test('the worksheet is still byte-identical after the parser change', () => {
  for (const key of REAL) {
    const md = readFileSync(join(VIDEOS, key, 'outline.md'), 'utf8')
    const onDisk = join(VIDEOS, key, 'script-worksheet.md')
    let expected
    try {
      expected = readFileSync(onDisk, 'utf8')
    } catch {
      continue // this video has no checked-in worksheet
    }
    assert.equal(buildWorksheet(md), expected, `${key}: worksheet output drifted`)
  }
})
```

**Verify**: `cd pipelines/youtube/yt-script && node --test test/beats.test.mjs` → `fail 0`.

### Step 5: Run the merge gate

**Verify**: `cd pipelines/youtube/yt-script && node --test test/beats.test.mjs test/worksheet.test.mjs` → exit 0, `fail 0`, and the worksheet suite still reports its 20 tests.

### Step 6: Prove the gate fires

Run the mutation by hand once so you know boss's run will behave:

```bash
perl -0pi -e "s/const BODY_DRAFTS_ARE_INSTRUCTIONS = true/const BODY_DRAFTS_ARE_INSTRUCTIONS = false/" pipelines/youtube/yt-script/lib/beats.mjs
cd pipelines/youtube/yt-script && node --test test/beats.test.mjs 2>&1 | grep -c BODY_DRAFT_LEAKED
```

**Verify**: the grep prints a number greater than 0, and the test run exits non-zero. Then revert:

```bash
perl -0pi -e "s/const BODY_DRAFTS_ARE_INSTRUCTIONS = false/const BODY_DRAFTS_ARE_INSTRUCTIONS = true/" pipelines/youtube/yt-script/lib/beats.mjs
cd pipelines/youtube/yt-script && node --test test/beats.test.mjs test/worksheet.test.mjs
```

exits 0 again. **Confirm `BODY_DRAFT_LEAKED` does not appear anywhere in a passing run**: `cd pipelines/youtube/yt-script && node --test test/beats.test.mjs 2>&1 | grep -c BODY_DRAFT_LEAKED` → `0`.

## Test plan

`test/beats.test.mjs` (new, ~13 tests) covers: title extraction, beat num/title split, intro copy, the body-draft rule (fixture + all three real outlines), the `— final` escape hatch, a SAY-less body beat, lane routing including the new FACTS lane, section rules inheritance, part-kind split, verdict attachment, and a byte-identity re-check of the worksheet.

`test/worksheet.test.mjs` is untouched and must stay at 20 passing.

## Done criteria

- [ ] `cd pipelines/youtube/yt-script && node --test test/beats.test.mjs test/worksheet.test.mjs` exits 0 with `fail 0`.
- [ ] `node --test test/worksheet.test.mjs` still reports `pass 20`.
- [ ] `node lib/beats.mjs character-consistency-ai` prints valid JSON (pipe to `node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` — exit 0).
- [ ] `git status --porcelain videos/` is empty — no checked-in outline or worksheet was modified.
- [ ] The mutation in Step 6 makes the suite fail printing `BODY_DRAFT_LEAKED`, and reverting makes it pass.
- [ ] `grep -c BODY_DRAFT_LEAKED` on a clean passing run returns `0`.

## STOP conditions

- **A worksheet byte-identity test fails.** Your parser edit changed output. Fix `lib/beats.mjs` or your edit to `render-worksheet.mjs` — never edit the checked-in worksheet, and never edit `test/worksheet.test.mjs`.
- **If a gate assertion fails, fix the code or the fixture; weakening, swapping, or deleting the assertion is a STOP.**
- `bodyPartIndex` throws `NO_BODY_PART` on a real outline — stop and report which video; do not add a fallback that guesses.
- You find yourself writing a second markdown parser. Stop — reuse `parse()` from `render-worksheet.mjs`.

## Maintenance notes

- `lib/beats.mjs` is the contract plans 232 and 233 build on. Changing the beat shape is a breaking change for the desk UI.
- `BODY_DRAFTS_ARE_INSTRUCTIONS` exists only as a mutation target, mirroring the `QUOTE_JOIN` pattern already in `render-worksheet.mjs`. Do not "clean it up".
- `render-outline.mjs` and `render-script.mjs` still hold their own parsers by design — each file's header says why. Consolidating them would break byte-identity guarantees in two more places.
