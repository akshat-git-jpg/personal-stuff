---
executor: agy
model:
test_cmd: cd pipelines/youtube/yt-script && node --test test/*.test.mjs && node lib/build-script-json.test.mjs
ui:
deploy:
needs: ["PR #212 (plan 251) must land first — this plan calls pipelines/video/tts/lib/vo-synth.mjs, which plan 251 creates"]
needs_prs: [212]
touches: [pipelines/youtube/yt-script/lib/build-script-json.mjs, pipelines/youtube/yt-script/lib/build-script-json.test.mjs, pipelines/youtube/yt-script/run.sh, pipelines/youtube/yt-script/.gitignore, pipelines/youtube/yt-script/SCRIPT-INSTRUCTIONS.md, pipelines/youtube/yt-script/CLAUDE.md, pipelines/youtube/yt-script/steps/100-write-script-llm/step.json, pipelines/youtube/yt-script/steps/100-write-script-llm/README.md, pipelines/youtube/yt-script/steps/120-voiceover-run/step.json, pipelines/youtube/yt-script/steps/120-voiceover-run/README.md, pipelines/.claude/skills/yt-script/SKILL.md, pipelines/video/tts/OUTPUTS.md]

mutation_apply: |
  perl -pi -e 's/words < 8/words < 0/' pipelines/youtube/yt-script/lib/build-script-json.mjs
mutation_command: cd pipelines/youtube/yt-script && node lib/build-script-json.test.mjs
mutation_expect: "BEAT_TOO_SHORT"
mutation_cwd:
mutation_timeout: 600
---

# Plan 252: Wire yt-script step 120 to the yt-vo engine

## Summary

- **Problem statement**: `yt-script` step 120 is documented as "NOT WIRED".
  Step 100 is specified to emit `videos/<key>/script.vo.txt`, a flat blob with
  pronunciation respellings baked into the text — and no such file has ever been
  produced (zero exist on disk at `d923b178`). The `yt-vo` engine cannot consume
  a flat blob on its good path: `vo-synth.mjs` reads a sectioned
  `videos/<slug>/script.json` and applies `respell.json` per section. So the
  script pipeline's final artifact and the voiceover engine's only input do not
  meet.
- **Goals**:
  - Step 100 emits `videos/<key>/script.json` (tp3 schema) and
    `videos/<key>/respell.json` instead of `script.vo.txt`.
  - `script.vo.txt` is removed from the flow entirely.
  - Pronunciation moves out of `script.md` and into `respell.json`; `script.md`
    keeps normal spelling.
  - `yt-script` gets a `run.sh` with `vo` / `vo-lock` / `status` verbs that call
    the shared hub lib from plan 251.
  - Step 120 stops saying "NOT WIRED" and carries the real commands.
- **Decisions confirmed**:
  - Step 120 feeds yt-vo by its **per-section HTTP path** (`synth_section`), not
    the batch CLI -> because `respell.json` only works through
    `deriveSpoken(display_text, respellMap)` on that path, and per-section
    re-roll plus lock state are wanted.
  - Pronunciation owner -> **yt-vo owns it.** The lexicon table in `script.md`
    becomes `videos/<key>/respell.json`. `script.md` says `HeyGen`, never
    `hay-jen`.
  - `script.vo.txt` -> **dropped.** `script.json` replaces it. Two files holding
    the same spoken words would drift, and the file has never been produced.
  - Schema -> **full tp3 schema** (sequential `s01…sNN` ids, `demo` boolean,
    `recording.status`), so `lint-script.mjs` and the stage machine work for free
    (rejected: a minimum-fields shape plus a yt-script-only linter).
  - Runner -> yt-script gets its own thin `run.sh`, matching tp3's verb shape.
  - `channel` field -> the literal `"main"`. The tp3 schema requires a non-empty
    `channel` string; yt-script is single-channel today. Documented in
    `SCRIPT-INSTRUCTIONS.md` so it is a stated constant, not a mystery value.
  - `stage` at write time -> `"tts"`, with `spoken_text: ""`. See "The stage trap"
    below; this is the only combination that both passes `vo-synth`'s stage check
    and lets `respell.json` apply.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High).
- **Done criteria** (terse): the yt-script suite still green at 50 tests, a new
  `build-script-json` unit suite green, `script.vo.txt` gone from every doc, and
  `run.sh <key> status` works on a real video folder.
- **Stop conditions** (terse): any `steps.test.mjs` failure, any live Modal call,
  any edit to a `videos/*/script-draft.md`, any attempt to migrate the two
  legacy-format videos.
- **Test / verification for success**: the existing four-file yt-script suite
  plus a new `lib/build-script-json.test.mjs` that validates the emitted shape
  against the real tp3 validator, with an armed mutation gate.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d923b178..HEAD -- pipelines/youtube/yt-script pipelines/.claude/skills/yt-script`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plan 251, PR #212 (boss refuses to dispatch until it closes)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `d923b178`, 2026-08-26

## Why this matters

The whole `yt-script` flow exists to produce a script an AI voice reads
correctly on the first take. Step 120 is the step that speaks it, and it does
nothing. Everything upstream — thirteen steps, six owner gates, a published
freelancer desk — currently terminates in a file (`script.vo.txt`) that has
never been written once and that the engine could not use if it were.

Fixing it also removes a duplicated mechanism. `yt-script` specifies its own
pronunciation lexicon inside `SCRIPT-INSTRUCTIONS.md`; `yt-vo` already has
`respell.json` and applies it at synth time. Two respell systems means a
mispronunciation can be fixed in the wrong one, and a fix in `script.md` costs a
step-100 re-run and a re-approval at gate 110. One system means editing
`respell.json` and re-rolling one section.

## Current state

### Where step 120 is today

`pipelines/youtube/yt-script/steps/120-voiceover-run/README.md`, in full:

```markdown
# 120 - the voiceover

**[RUN]** &nbsp; Not wired yet.

NOT WIRED. `script.vo.txt` is the intended input for the `yt-vo` skill and the TTS hub at
`pipelines/video/tts`. Nothing in this skill runs it today.

**Reads:** `script.vo.txt`

**Writes:** `voiceover audio`

---

## Not wired

`script.vo.txt` is written and ready, but no step here consumes it.

When it is wired, it goes through the `yt-vo` skill (source:
`pipelines/.claude/skills/yt-vo`) and the voice registry in
`pipelines/video/tts`.

Do not improvise a TTS call from this skill.
```

Its `step.json` has `"consumes": ["script.vo.txt"]`, `"produces": ["voiceover
audio"]`, `"optional": true`, and a summary beginning `"NOT WIRED."`.

### What actually exists on disk

```
videos/ai-avatar-generator-comparison/   knowledge.md script-plan.md script.md
videos/ai-avatar-generators/             script-plan.md (+ retired html/pdf)
videos/ai-avatar-online-courses/         knowledge.md script-plan.md script.md
videos/ai-video-tools-comparison/        knowledge.md script-plan.md
videos/character-consistency-ai/         knowledge.md script-plan.md script.md
                                         script-worksheet.md desk-draft.json
```

**No `script.vo.txt` exists.** Three videos have `script.md`. The file this plan
deletes from the spec was never produced.

`yt-script` has **no `run.sh`**, **no `package.json`**, and `lib/` contains only
`beats.mjs`. Tests run as `node --test test/*.test.mjs` — measured at `d923b178`:
**50 tests, 50 pass**.

### What `script.md` looks like now

From `videos/ai-avatar-generator-comparison/script.md` (233 lines):

```markdown
# Best AI Avatar Generator for Online Courses & Training — Script

Part A: Keep the voiceover exactly as written. Follow the notes during recording.
...
## PART A — INTRODUCTION

### 1. Cold Open

**Voiceover**
> "Every time a course update breaks a lesson, you know what happens next: ..."

**Notes**
[Visual placeholder — team to produce: open on a fast montage ...]

### 2. Reveal

**Voiceover**
> "So I tested five of the leading platforms — HeyGen, Synthesia, VEED.io, ..."
```

So the extraction contract is: **each `### N. Title` heading is one section; its
`**Voiceover**` blockquote is `display_text`; its `**Notes**` block is `notes`.**
Beats are already numbered sequentially from 1, which maps directly onto the tp3
schema's required `s01`, `s02`, … ids.

### What `vo-synth.mjs` actually requires

From `pipelines/video/tts/lib/vo-synth.mjs` (after plan 251):

```js
if (script.stage !== "tts" && script.stage !== "polished") {
  console.error(`stage must be polished or tts (got ${script.stage})`);
  process.exit(1);
}
```

and per section, via `spokenFor`:

```js
export function spokenFor(section, respellMap = {}) {
  if (section.flags && section.flags.length > 0) {
    throw new Error(`${section.id}: unresolved flags — polish the script first`);
  }
  const text = section.spoken_text
    ? section.spoken_text
    : deriveSpoken(section.display_text, respellMap);
  if (!text.trim()) throw new Error(`${section.id}: spoken text is empty`);
  if (scanFlags(text).length > 0) throw new Error(`${section.id}: spoken text still contains flag markers`);
  return text;
}
```

It reads `respell.json` from `<root>/videos/<slug>/respell.json` (optional — a
missing file is fine) and writes wavs to `<root>/videos/<slug>/audio/<id>.wav`.

### The stage trap — read before writing any code

`pipelines/youtube/tutorial-pipeline-3/lib/schema.mjs` `validateScript` has a
`polished`-stage branch:

```js
if (stage === 'polished') {
  ...
  if (section.spoken_text === '') {
    errors.push(`${sid}: polished stage requires non-empty spoken_text`);
  }
}
```

And `deriveSpoken` only runs when `spoken_text` is empty (see `spokenFor` above).
So the two constraints collide:

- `spoken_text: ""` is **required** for `respell.json` to have any effect.
- `stage: "polished"` **forbids** an empty `spoken_text`.
- `vo-synth` **rejects** any stage that is not `polished` or `tts`.

**The resolution: write `stage: "tts"` with `spoken_text: ""`.** `vo-synth`
accepts `tts`, and `validateScript`'s default stage (`generated`) applies no
`spoken_text` rule. Do not call `lint-script.mjs --stage polished` on a
yt-script `script.json`; the default stage is correct here.

After a synth run, `vo-synth` writes the derived text back into `spoken_text`, so
`vo-lock` then finds it non-empty and `lockSection` passes. `set-stage.mjs <key>
locked` then moves `tts -> locked`, which is the legal +1 step in `STAGES`.

### The tp3 schema fields yt-script must fill

From `validateScript`, the required shape:

| Field | Rule | yt-script value |
|---|---|---|
| `video` | `/^[a-z0-9][a-z0-9-]*$/` | the video key |
| `channel` | non-empty string | the literal `"main"` |
| `version` | integer >= 1 | `1` |
| `stage` | one of the seven stages | `"tts"` |
| `sections` | array, length >= 3 | one per `### N. Title` beat |
| `sections[i].id` | exactly `s01`, `s02`, … sequential | `s` + zero-padded index+1 |
| `sections[i].demo` | boolean; **at least one section must be `true`** | `true` for PART B beats, `false` otherwise |
| `sections[i].display_text` | non-empty, 8–320 words (error outside) | the Voiceover text |
| `sections[i].spoken_text` | string | `""` |
| `sections[i].flags` | array, must match inline `[VERIFY:`/`[FILL:` markers | `[]` |
| `sections[i].notes` | string | the Notes block, or `""` |
| `sections[i].version` | integer >= 1 | `1` |
| `sections[i].tts` | `{regens_used:int>=0, locked:bool, take:string|null}` | `{regens_used: 0, locked: false, take: null}` |
| `sections[i].recording.status` | `none` when `demo:false`; one of `pending`/`received`/`qc-passed`/`re-record` when `demo:true` | `"none"` / `"pending"` |

**The 8-word floor is a real risk.** A short beat ("Trial links are in the
description below.") is 7 words and would be a hard schema error. Step 3 handles
it: the builder must **report** any beat under 8 words rather than pad it, and
that is a STOP condition, not something to paper over.

### `.gitignore` today

`pipelines/youtube/yt-script/.gitignore` ignores only the four retired
HTML/PDF renders plus `videos/*/desk-draft.json`. It has no audio rules. tp3's,
for reference:

```
videos/*/audio/
videos/*/recordings/
videos/*/qc/
videos/*/*.wav
videos/*/*.mp3
videos/*/*.mp4
videos/*/*.mov
```

### The two docs tests that constrain edits

`test/steps.test.mjs` asserts:
- every step folder matches `^\d{3}-[a-z0-9-]+-(llm|run|human)$`;
- each `step.json`'s `slug`/`number`/`actor` match its folder, and `oneLiner` and
  `summary` are non-empty;
- **SKILL.md's step table lists exactly the folders on disk** (regex
  `^\| \`(\d{3}-[a-z0-9-]+)\` \|`);
- the sentence matching `\b[A-Z][a-z]+ owner gates: ([^.]+)\.` names exactly the
  `-human` folders on disk;
- no `step.json` `produces` entry matches `\.(html|pdf)\b`.

`test/desk-docs.test.mjs` asserts step 100's README does **not** match
`node render-(outline|script)\.mjs`. It says nothing about `script.vo.txt`, so
removing that file breaks no existing assertion.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| yt-script docs suite | `cd pipelines/youtube/yt-script && node --test test/*.test.mjs` | exit 0, `# pass 50` (unchanged) |
| new builder unit suite | `cd pipelines/youtube/yt-script && node lib/build-script-json.test.mjs` | exit 0, `# fail 0` |
| the merge gate | `cd pipelines/youtube/yt-script && node --test test/*.test.mjs && node lib/build-script-json.test.mjs` | exit 0 |
| runner smoke | `cd pipelines/youtube/yt-script && bash run.sh ai-avatar-generator-comparison status` | prints `script.json: missing` (no script.json is generated by this plan) |
| plan 251's hub is present | `ls pipelines/video/tts/lib/vo-synth.mjs` | the path exists |

Never write `node --test <dir>` — a directory argument fails on node 22.14
(plans/runs/LESSONS.md 2026-07-09). Globs and explicit files are fine.

## Scope

**In scope**:
- `pipelines/youtube/yt-script/lib/build-script-json.mjs` — new.
- `pipelines/youtube/yt-script/lib/build-script-json.test.mjs` — new.
- `pipelines/youtube/yt-script/run.sh` — new.
- `pipelines/youtube/yt-script/.gitignore` — add audio rules.
- `pipelines/youtube/yt-script/SCRIPT-INSTRUCTIONS.md` — sections 1, 2, 5 and the
  file table.
- `pipelines/youtube/yt-script/CLAUDE.md` — the `videos/<key>/` file list and a
  new commands block.
- `pipelines/youtube/yt-script/steps/100-write-script-llm/{step.json,README.md}`.
- `pipelines/youtube/yt-script/steps/120-voiceover-run/{step.json,README.md}`.
- `pipelines/.claude/skills/yt-script/SKILL.md` — the step-120 row, the file
  table, and the hard rule mentioning `script.vo.txt`.
- `pipelines/video/tts/OUTPUTS.md` — one row for yt-script audio.

**Out of scope**:
- `pipelines/video/tts/lib/**` — plan 251 owns it. Do not edit the hub lib; if
  `vo-synth` needs a change to serve yt-script, that is a STOP.
- `pipelines/youtube/tutorial-pipeline-3/**` — untouched.
- `videos/ai-avatar-online-courses/` and `videos/ai-video-tools-comparison/`.
  These two are in the pre-spec format that makes `buildBeats` throw
  `LEGACY_OUTLINE_FORMAT`. Looks related; **do not migrate them**. This plan adds
  a downstream step, not a data migration.
- Any `videos/*/script-draft.md`. That file is the maker's words, kept as
  provenance, and is never edited.
- `apps/yt-script-desk/**`. The desk publishes `script-plan.md` and is unaffected.
- Any live Modal call. Everything here is offline; `MODAL_TTS_URL` is not set in
  a crew shell and must not be needed.
- `steps/110-approve-script-human/**` — the gate's wording stands.

## Git workflow

- Branch: `advisor/252-yt-script-wire-voiceover`
- Commit: one per step, `feat(yt-script): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: Add the audio gitignore rules

Append to `pipelines/youtube/yt-script/.gitignore`:

```
# Generated voiceover. Audio never lives in the repo (pipelines/CLAUDE.md house
# rule); vo-synth writes here and the takes belong in ~/kb-scratch. Step 120.
videos/*/audio/
videos/*/*.wav
videos/*/*.mp3
```

**Verify**: `cd pipelines/youtube/yt-script && mkdir -p videos/.probe/audio && touch videos/.probe/audio/x.wav && git check-ignore -q videos/.probe/audio/x.wav && echo IGNORED && rm -rf videos/.probe`
-> prints `IGNORED`

### Step 2: Write `lib/build-script-json.mjs`

This is the intelligence-heavy part of the plan, so the module is specified here
in full. Create `pipelines/youtube/yt-script/lib/build-script-json.mjs`:

```js
// script.md -> script.json, the per-section feed the yt-vo engine reads.
//
// Step 100 writes script.md for humans and this file derives the machine copy,
// so the two cannot drift the way script.md + script.vo.txt would have. The
// shape is tp3's (pipelines/youtube/tutorial-pipeline-3/lib/schema.mjs) because
// pipelines/video/tts/lib/vo-synth.mjs reads exactly that shape.

// A section heading: "### 12. Pricing & Value"
const HEADING = /^###\s+(\d+)\.\s+(.+?)\s*$/
// A part heading: "## PART B — BODY"
const PART = /^##\s+PART\s+([ABC])\b/i

export const SCHEMA_ERROR = 'SECTIONS_SCHEMA_BAD'
export const SHORT_BEAT_ERROR = 'BEAT_TOO_SHORT'

// Pulls the blockquote body that follows a **Voiceover** label. Strips the
// leading "> " and the wrapping double quotes the house style uses, and joins
// wrapped lines back into paragraphs.
function readVoiceover(lines) {
  const out = []
  for (const raw of lines) {
    if (!raw.startsWith('>')) break
    out.push(raw.replace(/^>\s?/, ''))
  }
  return out
    .join('\n')
    .replace(/^\s*"/, '')
    .replace(/"\s*$/, '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

// Everything after a **Notes** label until the next label or heading.
function readNotes(lines) {
  const out = []
  for (const raw of lines) {
    if (HEADING.test(raw) || PART.test(raw) || /^\*\*(Voiceover|Notes)\*\*/.test(raw)) break
    out.push(raw)
  }
  return out.join('\n').trim()
}

export function wordCount(text) {
  return String(text).split(/\s+/).filter(Boolean).length
}

// script.md text -> [{ number, title, part, display_text, notes }]
export function parseScriptMd(md) {
  const lines = String(md).split('\n')
  const beats = []
  let part = 'A'
  let current = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const p = line.match(PART)
    if (p) {
      part = p[1].toUpperCase()
      continue
    }

    const h = line.match(HEADING)
    if (h) {
      current = { number: Number(h[1]), title: h[2].trim(), part, display_text: '', notes: '' }
      beats.push(current)
      continue
    }

    if (!current) continue

    if (/^\*\*Voiceover\*\*/.test(line)) {
      current.display_text = readVoiceover(lines.slice(i + 1))
      continue
    }
    if (/^\*\*Notes\*\*/.test(line)) {
      current.notes = readNotes(lines.slice(i + 1))
      continue
    }
  }

  return beats
}

// beats -> the tp3-shaped script.json object.
//
// stage is "tts", not "polished", and every spoken_text is "". That pairing is
// deliberate and it is the only one that works: deriveSpoken (and therefore
// respell.json) only runs when spoken_text is empty, while validateScript's
// "polished" branch forbids an empty spoken_text. vo-synth accepts "tts".
export function buildScriptJson(key, beats) {
  const errors = []

  if (!/^[a-z0-9][a-z0-9-]*$/.test(key)) {
    errors.push(`${SCHEMA_ERROR}: key "${key}" is not a valid video key`)
  }
  if (beats.length < 3) {
    errors.push(`${SCHEMA_ERROR}: ${beats.length} sections, tp3 schema needs at least 3`)
  }

  const sections = beats.map((b, i) => {
    const id = `s${String(i + 1).padStart(2, '0')}`
    const demo = b.part === 'B'
    const words = wordCount(b.display_text)

    if (!b.display_text) {
      errors.push(`${SCHEMA_ERROR}: ${id} (${b.title}) has no Voiceover text`)
    } else if (words < 8) {
      // Never pad it to pass. A beat this short is an editorial decision.
      errors.push(`${SHORT_BEAT_ERROR}: ${id} (${b.title}) is ${words} words; the schema floor is 8`)
    } else if (words > 320) {
      errors.push(`${SCHEMA_ERROR}: ${id} (${b.title}) is ${words} words; the schema ceiling is 320`)
    }

    if (/\[(VERIFY|FILL):/.test(b.display_text)) {
      errors.push(`${SCHEMA_ERROR}: ${id} still carries a [VERIFY:/[FILL: marker`)
    }

    return {
      id,
      demo,
      display_text: b.display_text,
      spoken_text: '',
      flags: [],
      notes: b.notes,
      version: 1,
      tts: { regens_used: 0, locked: false, take: null },
      recording: { status: demo ? 'pending' : 'none' },
    }
  })

  if (!sections.some((s) => s.demo)) {
    errors.push(`${SCHEMA_ERROR}: no PART B section found, so no section has demo:true`)
  }

  return {
    script: { video: key, channel: 'main', version: 1, stage: 'tts', sections },
    errors,
  }
}
```

**Verify**: `cd pipelines/youtube/yt-script && node -e "import('./lib/build-script-json.mjs').then(m=>console.log(Object.keys(m).sort().join(',')))"`
-> `SCHEMA_ERROR,SHORT_BEAT_ERROR,buildScriptJson,parseScriptMd,wordCount`

### Step 3: Write `lib/build-script-json.test.mjs`

The test must validate the emitted object against **tp3's real validator**, not a
re-implementation, so a schema change there fails here. Create
`pipelines/youtube/yt-script/lib/build-script-json.test.mjs`:

```js
// The emitted script.json is checked against tp3's OWN validateScript, not a
// local copy of the rules: if tp3's schema moves, this suite goes red instead of
// yt-script silently emitting a shape vo-synth cannot read.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseScriptMd, buildScriptJson, wordCount, SCHEMA_ERROR, SHORT_BEAT_ERROR } from './build-script-json.mjs'
import { validateScript } from '../../tutorial-pipeline-3/lib/schema.mjs'

const MD = `# Some Video — Script

## PART A — INTRODUCTION

### 1. Cold Open

**Voiceover**
> "Every time a course update breaks a lesson, you know what happens next, and
> that is the bottleneck these tools are supposed to fix."

**Notes**
[Visual placeholder — open on a montage of studio setup.]

### 2. Reveal

**Voiceover**
> "So I tested five of the leading platforms, scoring each one on realism, voice
> quality and pricing, and by the end you will know which one fits."

## PART B — BODY

### 3. Quick Overview

**Voiceover**
> "Before we get into scoring, let us take a quick look at what each of these
> five platforms actually offers you today."

**Notes**
Show each dashboard. Hide the billing page.

## PART C — VERDICT

### 4. Final Recommendation

**Voiceover**
> "None of these are bad, they are just built for different priorities, and the
> one I would pick is the second."
`

test('parseScriptMd finds every beat, its part and its notes', () => {
  const beats = parseScriptMd(MD)
  assert.equal(beats.length, 4)
  assert.deepEqual(beats.map((b) => b.number), [1, 2, 3, 4])
  assert.deepEqual(beats.map((b) => b.part), ['A', 'A', 'B', 'C'])
  assert.match(beats[0].display_text, /^Every time a course update/)
  assert.doesNotMatch(beats[0].display_text, /^>/, 'blockquote marker survived')
  assert.doesNotMatch(beats[0].display_text, /^"/, 'wrapping quote survived')
  assert.match(beats[0].notes, /Visual placeholder/)
  assert.equal(beats[1].notes, '', 'a beat with no Notes block gets an empty string')
  assert.match(beats[2].notes, /Hide the billing page/)
})

test('the emitted object passes tp3 validateScript', () => {
  const { script, errors } = buildScriptJson('some-video', parseScriptMd(MD))
  assert.deepEqual(errors, [], 'builder reported its own errors')
  const res = validateScript(script)
  assert.deepEqual(res.errors, [], `SECTIONS_SCHEMA_BAD: ${res.errors.join(' | ')}`)
  assert.ok(res.ok)
})

test('ids are sequential sNN and PART B is the demo section', () => {
  const { script } = buildScriptJson('some-video', parseScriptMd(MD))
  assert.deepEqual(script.sections.map((s) => s.id), ['s01', 's02', 's03', 's04'])
  assert.deepEqual(script.sections.map((s) => s.demo), [false, false, true, false])
  assert.deepEqual(
    script.sections.map((s) => s.recording.status),
    ['none', 'none', 'pending', 'none'],
  )
})

test('stage is tts and spoken_text is empty, so respell.json can apply', () => {
  const { script } = buildScriptJson('some-video', parseScriptMd(MD))
  assert.equal(script.stage, 'tts', 'stage must be tts: vo-synth rejects anything else that allows empty spoken_text')
  for (const s of script.sections) {
    assert.equal(s.spoken_text, '', 'deriveSpoken only runs when spoken_text is empty')
  }
})

test('a beat under 8 words is reported, never padded', () => {
  const short = MD.replace(
    '> "None of these are bad, they are just built for different priorities, and the\n> one I would pick is the second."',
    '> "Links below."',
  )
  const { errors } = buildScriptJson('some-video', parseScriptMd(short))
  assert.ok(
    errors.some((e) => e.startsWith(SHORT_BEAT_ERROR)),
    `expected a ${SHORT_BEAT_ERROR}, got: ${errors.join(' | ')}`,
  )
})

test('a surviving VERIFY marker is an error', () => {
  const flagged = MD.replace('the second."', 'the [VERIFY: which one] second."')
  const { errors } = buildScriptJson('some-video', parseScriptMd(flagged))
  assert.ok(errors.some((e) => e.includes('[VERIFY:')), `got: ${errors.join(' | ')}`)
})

test('a bad key is rejected', () => {
  const { errors } = buildScriptJson('Some Video', parseScriptMd(MD))
  assert.ok(errors.some((e) => e.startsWith(SCHEMA_ERROR)), `got: ${errors.join(' | ')}`)
})

test('wordCount ignores whitespace runs', () => {
  assert.equal(wordCount('  a   b \n c '), 3)
})
```

**Verify**: `cd pipelines/youtube/yt-script && node lib/build-script-json.test.mjs`
-> exit 0, `# fail 0`, 8 tests

### Step 4: Write `run.sh`

Create `pipelines/youtube/yt-script/run.sh` (chmod +x). It mirrors tp3's verb
shape and calls the hub lib plan 251 created.

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ $# -lt 2 ]; then
  echo "usage: bash run.sh <key> <status|vo|vo-lock>"
  exit 2
fi

key="$1"
verb="$2"

YTS_ROOT="${YTS_ROOT:-$(pwd)}"
# The voiceover engine lives in the TTS hub, never in this pipeline
# (pipelines/video/tts/CLAUDE.md, plan 251). --root is the whole contract.
TTS_LIB="../../video/tts/lib"

case "$verb" in
  status)
    script_json="$YTS_ROOT/videos/$key/script.json"
    if [ -f "$script_json" ]; then
      echo "script.json: present"
      node -e "const o=require('fs').readFileSync('$script_json','utf8');const s=JSON.parse(o);console.log('stage: '+s.stage);console.log('sections: '+s.sections.length);console.log('locked: '+s.sections.filter(x=>x.tts&&x.tts.locked).length);"
    else
      echo "script.json: missing"
    fi
    ;;
  vo)
    node "$TTS_LIB/vo-synth.mjs" "$key" --root "$YTS_ROOT" "${@:3}"
    ;;
  vo-lock)
    node "$TTS_LIB/vo-lock.mjs" "$key" --root "$YTS_ROOT" "${@:3}"
    ;;
  *)
    echo "usage: bash run.sh <key> <status|vo|vo-lock>"
    exit 2
    ;;
esac
```

**Verify**: `cd pipelines/youtube/yt-script && bash run.sh ai-avatar-generator-comparison status`
-> prints `script.json: missing` and exits 0

### Step 5: Rewrite step 120

`pipelines/youtube/yt-script/steps/120-voiceover-run/step.json`:

```json
{
  "number": "120",
  "slug": "120-voiceover-run",
  "title": "the voiceover",
  "actor": "run",
  "actorLabel": "[RUN]",
  "oneLiner": "Synthesizes the voiceover section by section, then locks the takes.",
  "consumes": [
    "script.json",
    "respell.json"
  ],
  "produces": [
    "videos/<key>/audio/<id>.wav"
  ],
  "gate": null,
  "external": false,
  "optional": false,
  "summary": "Runs the `yt-vo` engine over `script.json` one section at a time via the Modal `synth_section` endpoint, using `respell.json` for pronunciation. Re-roll a single section with `--only`, listen, then lock. Wired 2026-08-26 (plan 252); before that this step did nothing and `script.vo.txt`, its supposed input, had never once been produced."
}
```

`pipelines/youtube/yt-script/steps/120-voiceover-run/README.md`:

```markdown
# 120 - the voiceover

**[RUN]** &nbsp; Synthesizes the voiceover section by section, then locks the takes.

Runs the `yt-vo` engine over `script.json` one section at a time via the Modal
`synth_section` endpoint, using `respell.json` for pronunciation. Re-roll a single
section with `--only`, listen, then lock. Wired 2026-08-26 (plan 252); before that
this step did nothing and `script.vo.txt`, its supposed input, had never once been
produced.

**Reads:** `script.json`, `respell.json`

**Writes:** `videos/<key>/audio/<id>.wav`

---

## The commands

```bash
cd pipelines/youtube/yt-script
bash run.sh <key> status              # stage, section count, how many are locked
bash run.sh <key> vo                  # every unlocked section
bash run.sh <key> vo --only s03       # re-roll one
bash run.sh <key> vo --force --only s03   # re-roll one that is already locked
bash run.sh <key> vo-lock             # lock the takes you have listened to
```

`MODAL_TTS_URL` and `MODAL_TTS_TOKEN` come from `pipelines/.env`. The engine,
the voice and the reference clip live in `pipelines/video/tts/` — this step owns
text and collects wavs, and never picks a voice.

## Read the `yt-vo` skill before running this

`pipelines/.claude/skills/yt-vo/SKILL.md` owns what "good" means before a take is
locked, in this order: wrong words -> respell and re-roll; a faint onset "tsh" ->
ignore, the assemble step trims it; racing or dragging -> re-roll, it is
stochastic; flat delivery -> `--emo-text "warm, confident"`.

**Two re-rolls wrong the same way means the text is wrong, not the engine.**

## Fixing a pronunciation

Edit `videos/<key>/respell.json`, then re-roll that section:

```json
{ "HeyGen": "hay-jen", "n8n": "N eight N" }
```

`script.md` keeps the normal spelling. The respell map is applied at synth time
by `deriveSpoken`, and only to sections whose `spoken_text` is still empty — which
is every section until its first synth. After that, `spoken_text` holds the
derived text, so a later respell edit needs a re-roll to take effect.

## There is no unlock

Only a text edit clears a lock, and that resets the take. A locked take is what
the freelancer records against, so swapping it silently desyncs footage that
already exists. Lock when you have actually listened.
```

**Verify**: `cd pipelines/youtube/yt-script && node --test test/steps.test.mjs`
-> exit 0, `# fail 0`

### Step 6: Update step 100

In `pipelines/youtube/yt-script/steps/100-write-script-llm/step.json`, change
`produces` from `["script.md", "script.vo.txt"]` to
`["script.md", "script.json", "respell.json"]` and rewrite the summary to:

```
"summary": "`script-draft.md` -> `script.md` (human-readable) + `script.json` (the per-section feed step 120 reads) + `respell.json` (pronunciation). Follows `SCRIPT-INSTRUCTIONS.md`. This is a FINALISE pass over someone else's words, not a fresh write - his phrasing survives unless it is wrong."
```

In its `README.md`, replace the paragraph beginning `Write \`script.md\`, then
\`script.vo.txt\`` with:

```markdown
Write `script.md`, then derive `script.json` from it:

```bash
cd pipelines/youtube/yt-script
node -e "
import('./lib/build-script-json.mjs').then(async (m) => {
  const fs = await import('node:fs/promises')
  const key = process.argv[1]
  const md = await fs.readFile(\`videos/\${key}/script.md\`, 'utf8')
  const { script, errors } = m.buildScriptJson(key, m.parseScriptMd(md))
  if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
  await fs.writeFile(\`videos/\${key}/script.json\`, JSON.stringify(script, null, 2) + '\n')
  console.log(\`\${script.sections.length} sections\`)
})
" <key>
```

Then write `videos/<key>/respell.json` — every word an engine is likely to get
wrong, mapped to a plain-letters respelling. `script.md` keeps normal spelling;
the map is applied at synth time, never written into the script.

If the builder reports `BEAT_TOO_SHORT`, do not pad the beat to clear it. Raise
it to the owner — a beat under 8 words is an editorial call, and the maker wrote
those words.
```

Keep the "His words, not yours" and "Report the diff" sections exactly as they
are.

**Verify**: `cd pipelines/youtube/yt-script && node --test test/steps.test.mjs test/desk-docs.test.mjs`
-> exit 0, `# fail 0`

### Step 7: Update `SCRIPT-INSTRUCTIONS.md`

Four edits to `pipelines/youtube/yt-script/SCRIPT-INSTRUCTIONS.md`.

**7a — the file table near the top.** Replace the two-row table:

```markdown
| File | For | Contains |
|---|---|---|
| `script.md` | humans — the owner, the editor | everything: Voiceover, Notes, headings. Normal spelling |
| `script.json` | the VO engine (step 120) | one entry per beat: `display_text`, `notes`, `tts` state |
| `respell.json` | the VO engine (step 120) | pronunciation map, applied at synth time |
```

**7b — section 1, the lexicon.** Replace the whole of `## 1 · The pronunciation
lexicon` with:

```markdown
## 1 · The pronunciation map

Pronunciation is **not** written into the script. It lives in
`videos/<key>/respell.json`, and the engine applies it at synth time
(`deriveSpoken` in `pipelines/video/tts/lib/spoken.mjs`).

```json
{
  "HeyGen": "hay-jen",
  "Descript": "dee-script",
  "n8n": "N eight N",
  "ElevenLabs": "eleven labs",
  "1080p": "ten-eighty p",
  "API": "A-P-I",
  ".mp4": "dot em-pee-four"
}
```

Rules for the map:

- **One key per distinct problem word**, not per occurrence.
- **Cover these categories every time:** product and brand names, acronyms,
  file extensions and formats, version numbers, prices and currency, units,
  numbers that are read as digits vs. words, and any non-English word.
- **Respell phonetically in plain letters with hyphens.** No IPA, no
  engine-specific phoneme codes.
- Matching is whole-word and case-sensitive, longest key first.
- `script.md` carries **no** lexicon table. It used to, and that meant the
  respelling existed in two places. One source only (plan 252, 2026-08-26).
```

**7c — section 2, substitution.** Replace the whole of `## 2 · Substitution — the
lexicon is applied, not attached` with:

```markdown
## 2 · Never write a pronunciation hint into the text

Brackets and parentheticals are read out loud or choked on. And now that
`respell.json` owns pronunciation, a respelling typed into the script is worse
than useless — it gets respelled a second time.

```
BAD   We'll start with HeyGen [hay-jen].
BAD   We'll start with HeyGen (pronounced hay-jen).
BAD   We'll start with hay-jen.
GOOD  script.md     -> We'll start with HeyGen.
      respell.json  -> { "HeyGen": "hay-jen" }
```

The one place a respelling ever appears is `respell.json`.
```

**7d — section 5.** Replace the whole of `## 5 · Building \`script.vo.txt\`` with:

```markdown
## 5 · Building `script.json`

`script.json` is derived from `script.md` by `lib/build-script-json.mjs` (step
100's README has the command). You do not hand-write it. What you control is
`script.md`, because the builder reads it:

- Each `### N. Title` heading becomes one section, id `s01`, `s02`, … in order.
- Its `**Voiceover**` blockquote becomes `display_text` — the spoken words.
- Its `**Notes**` block becomes `notes` — never spoken.
- A beat under `## PART B` gets `demo: true`; A and C get `demo: false`.

Then check, because this file is the last thing between the draft and the audio:

- [ ] The builder exits 0 and reports the section count you expect.
- [ ] No `[PLACEHOLDER]`, no `[illegible]`, no `[VERIFY:` / `[FILL:` anywhere.
- [ ] No em dashes, semicolons or ellipses in any `display_text`. Punctuation is
      the pacing track and those three have no spoken form.
- [ ] No production instruction sits in a `display_text` — it belongs in `notes`.
- [ ] Every problem word has a `respell.json` key.
- [ ] `stage` is `"tts"` and every `spoken_text` is `""`. Both are required: the
      respell map only applies while `spoken_text` is empty, and `vo-synth`
      refuses any stage other than `tts` or `polished`.

`script.vo.txt` is gone (plan 252, 2026-08-26). It was specified for two years of
this flow and never once produced, and it duplicated the spoken words that
`script.json` now holds.
```

Also fix the stale ASCII chain at the top of the file, which still names
`outline.pdf` and `script-worksheet.md` as the handoff:

```
knowledge.md  ->  outline.md  ->  script-plan.md  ->  [ the desk ]
     script-plan.md  ->  [ he writes ]  ->  script-draft.md
     script-draft.md ->  [ this file ] ->  script.md + script.json + respell.json
```

**Verify**: `cd pipelines/youtube/yt-script && ! grep -q "script.vo.txt" SCRIPT-INSTRUCTIONS.md && echo CLEAN`
-> prints `CLEAN`

### Step 8: Update `SKILL.md` and `CLAUDE.md`

In `pipelines/.claude/skills/yt-script/SKILL.md` (edit the real file at that
path, never through the `.claude/skills/yt-script` symlink):

**8a** — the step table's last row becomes:

```
| `120-voiceover-run` | [RUN] | Synthesizes the voiceover per section, then locks the takes |
```

**8b** — the file table: delete the `script.vo.txt` row and add two rows after
`script.md`:

```
| `videos/<key>/script.json` | 100 | The per-section engine feed. Step 120's input |
| `videos/<key>/respell.json` | 100 | Pronunciation map, applied at synth time |
```

**8c** — the ASCII chain gains a final hop:

```
knowledge.md  ->  outline.md   ->  script-plan.md  ->  script-draft.md  ->  script.md + script.json
  (010)           (030)            (050)               (090, his words)     (100)
```

**8d** — the hard rule `**Step 100 finalises someone else's draft.**` is
unchanged. Add one hard rule after it:

```markdown
- **Pronunciation lives in `respell.json`, never in the script.** A respelling
  typed into `script.md` is applied twice. The engine owns pronunciation
  (`pipelines/video/tts/lib/spoken.mjs`).
```

**8e** — the "The files" table and the `120` row are the only step-table changes.
**Do not touch the `Six owner gates: 020, 040, 055, 060, 080, 110.` sentence** —
this plan adds no human step, and `steps.test.mjs` asserts that sentence matches
the `-human` folders on disk.

In `pipelines/youtube/yt-script/CLAUDE.md`: in the `videos/<key>/` block, replace
the `script.vo.txt` line with

```
script.json         100 - the per-section engine feed; step 120's input
respell.json        100 - pronunciation map, applied at synth time
audio/              120 - generated wavs, gitignored
```

and add a commands block after the desk one:

```bash
bash run.sh <key> status            # stage, sections, how many locked
bash run.sh <key> vo                # 120 - synth every unlocked section
bash run.sh <key> vo --only s03     # re-roll one
bash run.sh <key> vo-lock           # lock what you have listened to
```

Add one row to `pipelines/video/tts/OUTPUTS.md` naming `yt-script` and
`pipelines/youtube/yt-script/videos/<key>/audio/` (match the file's existing row
format).

**Verify**: `cd pipelines/youtube/yt-script && node --test test/*.test.mjs && git grep -c "script.vo.txt" -- pipelines/youtube/yt-script pipelines/.claude/skills/yt-script`
-> the suite exits 0 with `# pass 50`; the grep exits 1 (no matches remain)

## Test plan

- **New**: `lib/build-script-json.test.mjs`, 8 tests. It imports tp3's real
  `validateScript` rather than restating the rules, so a schema change in tp3
  turns this red instead of letting yt-script emit an unreadable shape. It also
  pins the two non-obvious contract points that a reader would otherwise
  "clean up": `stage === 'tts'` and `spoken_text === ''`.
- **Unchanged**: the four `test/*.test.mjs` suites, 50 tests. `steps.test.mjs`
  covers the step-120 rewrite and the SKILL.md table; `desk-docs.test.mjs` covers
  step 100's README.
- **Mutation gate**: lowering the 8-word floor to 0 inside `buildScriptJson` must
  make `lib/build-script-json.test.mjs` fail printing `BEAT_TOO_SHORT`. That
  proves the builder's own validation actually runs, rather than passing because
  tp3's validator happened to be lenient about short sections.
- **Not tested here**: a live Modal synth. It costs money, needs
  `MODAL_TTS_URL`/`MODAL_TTS_TOKEN` that a crew shell does not have, and is the
  owner's call. `bash run.sh <key> status` is the offline smoke.

## Done criteria

- [ ] `cd pipelines/youtube/yt-script && node --test test/*.test.mjs` exits 0 with
      `# pass 50`.
- [ ] `cd pipelines/youtube/yt-script && node lib/build-script-json.test.mjs`
      exits 0 with `# fail 0` and 8 tests.
- [ ] `git grep -c "script.vo.txt" -- pipelines/youtube/yt-script pipelines/.claude/skills/yt-script`
      exits 1 (zero matches).
- [ ] `cd pipelines/youtube/yt-script && bash run.sh ai-avatar-generator-comparison status`
      prints `script.json: missing` and exits 0.
- [ ] `cd pipelines/youtube/yt-script && bash run.sh nope-not-a-verb 2>&1; test $? -eq 2`
      — a bad verb exits 2, not 0.
- [ ] `steps/120-voiceover-run/step.json` has `"optional": false` and its summary
      does not contain `NOT WIRED`.
- [ ] `git check-ignore -q pipelines/youtube/yt-script/videos/x/audio/y.wav` exits 0.
- [ ] `git diff --stat d923b178..HEAD --name-only` lists no file outside this
      plan's in-scope list.

## STOP conditions

- **A gate assertion fails: fix the code or the fixture. Weakening, swapping,
  skipping or deleting an assertion is a STOP.** In particular `steps.test.mjs`
  exists because this exact docs table drifted before.
- `buildScriptJson` reports `BEAT_TOO_SHORT` on a real video. Do **not** pad the
  beat, merge it into its neighbour, or lower the 8-word floor. Report which beat
  and stop — those are the maker's words and shortening the schema to fit them is
  the owner's call.
- `vo-synth.mjs` or anything else under `pipelines/video/tts/lib/` needs an edit
  to serve yt-script. Plan 251 owns that code; a required change there means the
  `--root` contract does not hold and the design needs revisiting.
- You are about to run a live Modal call, `modal deploy`, or `modal run`. Nothing
  in this plan needs one, and they cost money.
- You are about to touch `videos/ai-avatar-online-courses/` or
  `videos/ai-video-tools-comparison/`. Those two are in the pre-spec format and
  migrating them is explicitly out of scope.
- You are about to edit a `videos/*/script-draft.md`. That file is never edited.
- The `Six owner gates:` sentence in SKILL.md needs changing. It does not — this
  plan adds no human step. If a test says otherwise, something else is wrong.

## Maintenance notes

- **`stage: "tts"` + `spoken_text: ""` is a two-sided constraint, not a
  preference.** `deriveSpoken` (and therefore `respell.json`) only runs while
  `spoken_text` is empty; `validateScript`'s `polished` branch forbids an empty
  `spoken_text`; `vo-synth` rejects any stage but `tts` or `polished`. A future
  reader who "tidies" the stage to `polished` breaks pronunciation silently — the
  synth still succeeds, it just stops respelling. The unit test pins both values
  for exactly that reason.
- **A respell edit after the first synth needs a re-roll.** `vo-synth` writes the
  derived text back into `spoken_text`, and `deriveSpoken` then stops running for
  that section. This is `yt-vo`'s documented behaviour, not a bug.
- **`script.json` is derived, `script.md` is the source.** If they disagree,
  regenerate rather than hand-editing the JSON. Nothing enforces that today; if
  hand-edits start happening, add a freshness check comparing mtimes.
- **The 8-word floor comes from tp3's schema**, which was written for tutorial
  sections of 45–170 words. yt-script beats are shorter. If it fires often, the
  right fix is a yt-script-specific floor in `validateScript`'s options, not a
  padded script.
- A reviewer should scrutinise: the blockquote parser in `readVoiceover` against a
  real `script.md` (multi-paragraph blockquotes with `>` on blank lines are the
  fiddly case), and that `demo` really is `true` for exactly the PART B beats.
- `SCRIPT-INSTRUCTIONS.md` still describes some of the pre-2026-08-23 flow in
  places this plan did not touch. Worth a separate cleanup pass; not folded in
  here to keep the diff reviewable.
