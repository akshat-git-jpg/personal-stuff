---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: []
needs_prs: [196]
touches: [pipelines/video/visuals-flow/lib/transcript-quality.mjs, pipelines/video/visuals-flow/lib/transcript-suspect.mjs, pipelines/video/visuals-flow/lib/transcript-second-opinion.mjs, pipelines/video/visuals-flow/lib/transcript-diff.mjs, pipelines/video/visuals-flow/lib/transcript-diff.test.mjs, pipelines/video/visuals-flow/run.sh, pipelines/video/visuals-flow/steps, pipelines/video/visuals-flow/PIPELINE.md]

mutation_apply: python3 - <<'PY'
p='pipelines/video/visuals-flow/lib/transcript-diff.mjs'
s=open(p).read()
marker='transcriptDiff'
assert marker in s, 'marker missing — plan 198 Step 2 did not land'
# Report a clean diff regardless of what changed: the cleanup becomes unreviewable
# while every gate stays green, which is the state this plan exists to end.
s = s.replace('return { changes, total: changes.length };', 'return { changes: [], total: 0 };')
open(p,'w').write(s)
PY
mutation_command: cd pipelines/video/visuals-flow && node --test lib/transcript-diff.test.mjs
mutation_expect: TRANSCRIPT-DIFF-INVISIBLE
mutation_cwd:
mutation_timeout:
---

# Plan 198: visuals-flow — the transcript cleanup is a step, not a paragraph in a README

## Summary

- **Problem statement**: fixing what the speech recogniser got wrong is one of the
  most consequential things this pipeline does — `510-assemble` burns captions
  from transcript words **verbatim**, so a garbled brand name ships on screen —
  and it is not a step. It lives as prose inside `steps/010-transcribe-run/README.md`
  and three loose commands (`transcript-quality.mjs`, `transcript-suspect.mjs`,
  `transcript-second-opinion.mjs`). On `consistent-ai-influencer` it made **141
  token-level changes** and fixed four of five product names ("Hejian", "Arcad",
  "Open Art", "Higgs Field"), none of it visible to the ledger, the registry or
  the next-hint.
- **Goals**:
  - Make the cleanup its own registry step producing a real artifact.
  - Produce a **diff** — raw ASR vs cleaned — as the reviewable output, and run
    the second-opinion pass inside the step so words the cleanup *missed* are
    annotated onto that diff rather than lost.
  - Leave the structure derivation exactly where it is. It already reads the
    three `src/*.mp4` durations; there is nothing to fix.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — the diff module is
  written out below; the rest is a declaration and dispatch.
- **Done criteria** (terse — full list below): `check.sh` exits 0; the cleanup is
  a step producing `transcript.diff.json`; `transcript-second-opinion` is no
  longer a bare command.
- **Stop conditions** (terse — full list below): the cleanup would change word
  timings; `checkTimingIntegrity` is bypassed; any renumbering.
- **Test / verification for success**: `scripts/check.sh` plus a new
  `lib/transcript-diff.test.mjs`, and a mutation proving the diff can go blind.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2e2dd69d..HEAD -- pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/steps pipelines/video/visuals-flow/run.sh`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 196 (the `checks/` report contract and the "every step declares an artifact" schema)
- **Category**: dx
- **Difficulty**: standard
- **Planned at**: commit `2e2dd69d`, 2026-08-07

## Why this matters

Everything downstream quotes the transcript. `steps/010-transcribe-run/README.md`
states the ordering constraint outright: *"Do this BEFORE any anchor exists —
anchors quote the transcript verbatim, so later text edits break them."* A
transcript fixed late is not a cheap fix; it invalidates every anchor authored
against it.

So the pipeline's most order-sensitive operation is also its least visible one.
It is documented, it has tooling, and it is machine-guarded against desync — but
it is not a step, so nothing records that it ran, nothing parks the next-hint on
it, and a run that skips it looks identical to a run that did it.

The owner removed the transcript **gate** from the design (2026-08-07) — this
plan adds no approval. What it adds is an artifact: the diff. 141 changes on one
video is a reviewable object; the same 141 changes scrolling past in a terminal
is not.

## Current state

All paths relative to `pipelines/video/visuals-flow/`.

### What exists, and where it is documented

`steps/010-transcribe-run/README.md` carries the whole procedure as prose. The
load-bearing paragraphs:

> **Transcript quality pass (before the cue pass, always — plan 149).** Whisper's
> punctuation is a prosody guess, not a proofread, and step 110 burns captions
> from transcript words VERBATIM […] `run.sh` always keeps the raw engine output
> as `transcript.<engine>-raw.bak.json` first, then runs one of two modes,
> machine-gated by `lib/transcript-quality.mjs`'s `checkTimingIntegrity()` so a
> text edit can never desync captions from the audio

Two modes:
- **script-first** (a `script.txt` exists): `node lib/transcript-quality.mjs align <slug>`
- **cleanup** (default): an LLM pass, then `node lib/transcript-quality.mjs apply <slug> <cleaned.json>`,
  then `node lib/transcript-suspect.mjs <slug>` and `node lib/transcript-second-opinion.mjs <slug>`

Either mode *"fails loudly and leaves `transcript.json` as the raw ASR output"*
when `checkTimingIntegrity()` rejects the result.

### The artifacts already on disk

`videos/consistent-ai-influencer/` carries, from a real run:

```
transcript.json               173.4K   the live transcript
transcript.cleaned.json       236.0K   the LLM's cleaned word list
transcript.groq-raw.bak.json  175.4K   the raw ASR backup
transcript-suspects.json        2.1K   the suspect gate's output
transcript-meta.json             86B
```

So `transcript-suspect.mjs` **does** write an artifact. `transcript-quality.mjs`
writes the backup and the transcript. What does not exist is a **diff** — the one
representation that makes 141 scattered changes reviewable — and
`transcript-second-opinion.mjs`'s findings have nowhere to land.

### Why the structure derivation needs nothing

`lib/source-structure.mjs` already computes the intro/body/conclusion spans from
the three recordings:

```js
// The owner records every video as three files. That IS the structure — the
```
```js
      errors.push(`src/${part}.mp4 is missing — every video must be recorded as intro.mp4 + body.mp4 + conclusion.mp4. A video with no ${part} cannot be cut.`);
```
```js
    structure.push({ part, start: +t.toFixed(3), end: +(t + d).toFixed(3) });
```

It reads durations and stacks them. There is no inference to remove and no
measurement to replace — this plan touches none of it.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate (merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exits 0, `visuals-flow check OK` |
| Diff tests | `cd pipelines/video/visuals-flow && node --test lib/transcript-diff.test.mjs` | exits 0 |
| Registry doc check | `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs --check` | exits 0 |
| run.sh self-test | `cd pipelines/video/visuals-flow && bash scripts/test-run-sh.sh` | `run.sh test OK` |

## Scope

**In scope**:
- New `lib/transcript-diff.mjs` + `lib/transcript-diff.test.mjs`
- `lib/transcript-quality.mjs` — write the diff after a successful apply/align
- `lib/transcript-second-opinion.mjs` — annotate the diff instead of only printing
- New step folder `012-clean-transcript-llm` (+ README, + the cleanup prompt moved
  out of 010's README)
- `steps/010-transcribe-run/README.md` — keep transcription, hand the cleanup
  procedure to 012 rather than duplicating it
- `run.sh` (a `clean-transcript` verb), `PIPELINE.md` (regenerated)

**Out of scope** — looks related, do not touch:
- **`lib/source-structure.mjs` and the spans.** Already correct; see above.
- **The narration/demo split** in `lib/segments.mjs`. It is load-bearing (six
  modules read it) and unchanged by this plan.
- **`checkTimingIntegrity()`'s logic.** Call it, never weaken it.
- **Renumbering.** Plan 199 owns every number and rename with the ledger
  migration. `012` is a free slot chosen only so it sorts after `010`.
- **Any transcript gate.** The owner removed it from the design (2026-08-07).
  This plan produces a reviewable artifact and no approval.
- **`videos/`.** Existing transcripts are untouched; the diff appears on the next
  cleanup run.

## Git workflow

- Branch: `advisor/198-vf-transcript-cleanup-is-a-step`
- Commit per step, message `plan 198 step N: <what>` — no AI footers. Do NOT push.

## Steps

### Step 1: Confirm a green baseline

```bash
cd pipelines/video/visuals-flow && bash scripts/check.sh
```

**Verify**: exits 0. If red before you change anything, STOP.

### Step 2: `lib/transcript-diff.mjs`

Create it with exactly this content:

```js
import fs from 'node:fs';
import path from 'node:path';

// 141 scattered token changes scrolling past in a terminal is not a review.
// The same 141 as a diff is (plan 198). This is the artifact the cleanup step
// produces — the ONLY representation in which a human can see what the machine
// decided to change about the words that will be burned into captions verbatim.
//
// Compares by INDEX, not by alignment: checkTimingIntegrity() guarantees the
// cleaned list has the same length and the same word times as the raw one, so
// index i is the same spoken word in both. If that guarantee ever breaks, this
// throws rather than producing a plausible-looking wrong diff.
export function transcriptDiff(rawWords, cleanWords) {
  if (rawWords.length !== cleanWords.length) {
    throw new Error(
      `TRANSCRIPT-DIFF-INVISIBLE: raw has ${rawWords.length} words, cleaned has ${cleanWords.length} — ` +
      'checkTimingIntegrity() should have rejected this; a length change means the diff cannot be trusted',
    );
  }
  const changes = [];
  for (let i = 0; i < rawWords.length; i++) {
    const before = rawWords[i]?.text ?? '';
    const after = cleanWords[i]?.text ?? '';
    if (before === after) continue;
    changes.push({ i, start: rawWords[i]?.start ?? null, before, after });
  }
  return { changes, total: changes.length };
}

// `suspects` are words the second-opinion pass still doubts — including ones the
// cleanup did NOT change. A diff alone cannot show those: it only shows what
// moved. Carrying them on the same artifact is what makes the review complete.
export function writeTranscriptDiff(workdir, { rawWords, cleanWords, suspects = [] }) {
  const { changes, total } = transcriptDiff(rawWords, cleanWords);
  const out = path.join(workdir, 'transcript.diff.json');
  const report = {
    total,
    changes,
    suspects,
    note: 'changes[] is what the cleanup altered; suspects[] is what a second pass still doubts, including words it did not touch',
  };
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  return report;
}
```

**Verify**: `node -e "import('./lib/transcript-diff.mjs').then(m=>console.log(Object.keys(m).sort().join(',')))"`
→ `transcriptDiff,writeTranscriptDiff`

### Step 3: `lib/transcript-diff.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { transcriptDiff, writeTranscriptDiff } from './transcript-diff.mjs';

const raw =   [{ text: 'Open',  start: 0 }, { text: 'Art', start: 1 }, { text: 'is', start: 2 }];
const clean = [{ text: 'OpenArt', start: 0 }, { text: 'Art', start: 1 }, { text: 'is', start: 2 }];

test('a changed word appears in the diff', () => {
  const d = transcriptDiff(raw, clean);
  assert.equal(d.total, 1,
    'TRANSCRIPT-DIFF-INVISIBLE: a cleanup that changed a word must show exactly one change');
  assert.deepEqual(d.changes[0], { i: 0, start: 0, before: 'Open', after: 'OpenArt' },
    'TRANSCRIPT-DIFF-INVISIBLE: the change must carry index, time, before and after');
});

test('an unchanged transcript diffs to nothing', () => {
  assert.equal(transcriptDiff(raw, raw).total, 0);
});

test('a length mismatch throws rather than guessing', () => {
  assert.throws(() => transcriptDiff(raw, clean.slice(0, 2)), /TRANSCRIPT-DIFF-INVISIBLE/);
});

test('suspects ride on the same artifact as the changes', () => {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-tdiff-'));
  writeTranscriptDiff(w, { rawWords: raw, cleanWords: clean, suspects: [{ i: 2, text: 'is', why: 'low confidence' }] });
  const r = JSON.parse(fs.readFileSync(path.join(w, 'transcript.diff.json'), 'utf8'));
  assert.equal(r.total, 1);
  assert.equal(r.suspects.length, 1,
    'TRANSCRIPT-DIFF-INVISIBLE: words the cleanup did NOT change but a second pass doubts must survive onto the artifact — a diff alone cannot show them');
  fs.rmSync(w, { recursive: true, force: true });
});
```

**Verify**: `node --test lib/transcript-diff.test.mjs` → exits 0, 4 tests pass

### Step 4: wire the diff into the quality pass

In `lib/transcript-quality.mjs`, after a successful `apply` or `align` — i.e.
**after `checkTimingIntegrity()` has passed**, never before — call
`writeTranscriptDiff(workdir, { rawWords, cleanWords, suspects: [] })` using the
raw backup (`transcript.<engine>-raw.bak.json`) as `rawWords` and the newly
written transcript as `cleanWords`.

If the raw backup is absent (a workdir that predates the backup convention),
skip the diff and print a note — do not fabricate a comparison.

In `lib/transcript-second-opinion.mjs`, after computing its findings, merge them
into the existing `transcript.diff.json` as `suspects` rather than only printing.
Read the file, set `suspects`, write it back. If the diff does not exist yet,
print the same guidance the step README gives and exit non-zero.

**Verify**: `grep -lc "writeTranscriptDiff" lib/transcript-quality.mjs lib/transcript-second-opinion.mjs | wc -l` → `2`

### Step 5: `012-clean-transcript-llm`

Create `steps/012-clean-transcript-llm/step.json`:

```json
{
  "number": "012",
  "slug": "012-clean-transcript-llm",
  "title": "clean the transcript",
  "actor": "llm",
  "actorLabel": "[LLM] + [RUN]",
  "verbs": ["clean-transcript"],
  "consumes": ["transcript.json"],
  "produces": ["transcript.diff.json"],
  "gate": null,
  "tab": null,
  "external": false,
  "optional": false,
  "nextHint": "run.sh <slug> clean-transcript  (before any anchor exists — anchors quote the transcript verbatim)",
  "summary": "raw ASR `transcript.json` -> a corrected `transcript.json` + `transcript.diff.json`. Repunctuates, fixes brand and product names, trims discourse fillers — never grammar or phrasing. Machine-gated by `checkTimingIntegrity()`: a text edit that would desync captions from audio is refused and the raw ASR is kept. Assemble burns captions from these words VERBATIM, so a garble here ships on screen."
}
```

Move the cleanup procedure out of `steps/010-transcribe-run/README.md` into
`steps/012-clean-transcript-llm/README.md`, together with the existing
`cleanup-prompt.md` if it lives under 010. Leave 010's README covering
transcription and the raw backup, with a one-line pointer to 012 — **do not leave
a second copy of the procedure behind**; two copies of an ordering rule is how
they drift.

Add a `clean-transcript)` case in `run.sh` that runs the mode selection
(script-first when `script.txt` exists, otherwise print the cleanup prompt),
then the apply, then the suspect and second-opinion passes.

**Verify**: `node lib/steps.mjs verbs | grep -c "^clean-transcript$"` → `1`; and
`node scripts/gen-pipeline-table.mjs && node scripts/gen-pipeline-table.mjs --check` exits 0

### Step 6: full gate, then prove the diff can go blind

```bash
cd pipelines/video/visuals-flow && bash scripts/check.sh
```

Then run the frontmatter mutation: make `transcriptDiff` return an empty change
list, confirm `node --test lib/transcript-diff.test.mjs` **fails** printing
`TRANSCRIPT-DIFF-INVISIBLE`, revert, confirm green.

**Verify**: `check.sh` exits 0; mutation fails with the expected string.

## Test plan

- `lib/transcript-diff.test.mjs` (4 tests) covers a change, no change, the
  length-mismatch throw, and suspects surviving onto the artifact.
- The registry's validation proves `012` loads and declares an artifact.
- `scripts/test-run-sh.sh` proves the new verb dispatches.
- The mutation proves the diff is load-bearing: a cleanup whose diff reports
  nothing is exactly as unreviewable as no diff at all, and every other gate
  would stay green through it.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0
- [ ] `ls steps/012-clean-transcript-llm/step.json` exists and `node scripts/gen-pipeline-table.mjs --check` exits 0
- [ ] `node --test lib/transcript-diff.test.mjs` exits 0 with 4 passing tests
- [ ] `grep -c "Transcript quality pass" steps/010-transcribe-run/README.md` → `0` (the procedure moved, it was not copied)
- [ ] `node lib/steps.mjs verbs | grep -c "^clean-transcript$"` → `1`
- [ ] The frontmatter mutation makes `transcript-diff.test.mjs` fail printing `TRANSCRIPT-DIFF-INVISIBLE`; reverting restores green
- [ ] `lib/source-structure.mjs` is unmodified: `git diff --stat 2e2dd69d..HEAD -- lib/source-structure.mjs` is empty

## STOP conditions

- **Baseline red** at Step 1, before any change.
- **`checkTimingIntegrity()` would be bypassed, weakened or called after the
  write.** It is the only thing standing between a text edit and desynced
  captions. The diff is written *after* it passes, never instead of it.
- **The diff requires realigning words.** If raw and cleaned lengths differ, the
  correct behaviour is the throw specified in Step 2 — do NOT implement fuzzy
  alignment to make a diff possible. A plausible-looking wrong diff is worse than
  an error.
- **Any renumbering or renaming of an existing step folder.** Plan 199 owns every
  rename with the ledger migration.
- **Gate integrity.** If an assertion fails, fix the code or the fixture.
  Weakening, `skip`-ing or deleting an assertion is a STOP.

## Maintenance notes

- **Plan 5 of 6** (194 → 195 → 196 → 197 → **198** → 199). `012` is a temporary
  free slot; plan 199 renumbers it into the `0xx` intake bucket.
- **No transcript gate, by owner decision** (2026-08-07). If one is ever wanted,
  `transcript.diff.json` is already the review surface it would gate on — add a
  `gate` and a `tab` to `012`'s declaration and nothing else changes.
- **`transcript-suspects.json` and `transcript.diff.json` overlap.** The suspect
  gate's standalone artifact predates this plan; after it, suspects also ride on
  the diff. Consider retiring the standalone file once the diff proves sufficient
  — but not in this plan, and not without checking who reads it.
- **A reviewer should scrutinise**: that the cleanup procedure was *moved* out of
  010's README rather than copied (two copies of "do this before any anchor
  exists" will drift), and that the diff is written from the raw **backup** rather
  than from a re-read of the live transcript, which would diff a file against
  itself and always report zero.
