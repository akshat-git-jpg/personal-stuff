---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
ui: false
deploy:
needs: []
---

# Plan 159: Teach the pipeline the three source files (intro / body / conclusion)

## Summary

- **Problem statement**: The owner records every video as three files — `src/intro.mp4`, `src/body.mp4`, `src/conclusion.mp4` — and `concat.txt` lists them. **No pipeline code reads any of it.** The structure is used once to build the audio and then discarded, after which `segments.mjs` *guesses* structure by keyword-matching the transcript for demo words in rolling windows. The pipeline cannot tell an intro from minute twelve.
- **Goals**:
  - Derive exact `intro` / `body` / `conclusion` boundaries by measuring the three source files. Deterministic, no inference.
  - Hard-fail a video whose source is missing `intro.mp4` or `conclusion.mp4` (owner rule 2026-07-28).
  - Warn when a recorded part never made it into the cut — the exact defect that left test-03's conclusion unused.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — deterministic file probing plus unit tests.
- **Done criteria** (terse): `bash scripts/check.sh` exits 0; test-03's `segments.json` carries a `structure` array with the three measured parts; a workdir missing `conclusion.mp4` fails loudly.
- **Stop conditions** (terse): any existing lint rule changes behaviour; `structure` is written as `segments[].kind` instead of its own field.
- **Test / verification for success**: unit tests in `lib/segments.test.mjs` plus a real run against `videos/test-03`.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 12646f6..HEAD -- pipelines/video/visuals-flow-2/lib/segments.mjs pipelines/video/visuals-flow-2/lib/video-manifest.mjs`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `12646f6`, 2026-07-28

## Why this matters

This is the third instance this week of the pipeline's recurring failure class — *information computed on one surface and never consumed on the next*. The first two were the chroma plate and the exposure regression. This one is the most expensive, because it is why intro and conclusion quality keeps being fixed per-video instead of once:

**there is nowhere to put a durable answer about intros, because nothing in the pipeline knows what an intro is.**

The owner's words: *"I don't want to keep going back and forth for every video. Intro and Conclusion are most important and I want best quality there."* The prerequisite for any lasting intro rule is a pipeline that can point at the intro. That is this plan, and nothing more — deliberately. The editorial question of *what makes a good intro* is subjective and is explicitly NOT encoded here (owner, 2026-07-28: *"its subjective. Pls dont make this hardcoded"*).

The gate is on **inputs**, not on editorial structure (owner, 2026-07-28: *"block if drive doesn't hav intro and conclusion files"*). A video whose conclusion was never recorded is the root cause of test-03's missing payoff; failing at the door is cheaper than discovering it after the cut.

## Current state

**`videos/test-03/concat.txt`**, verbatim — the structure the owner already provides:

```
file '/Users/kbtg/codebase/personal-stuff/pipelines/video/visuals-flow-2/videos/test-03/src/intro.mp4'
file '/Users/kbtg/codebase/personal-stuff/pipelines/video/visuals-flow-2/videos/test-03/src/body.mp4'
file '/Users/kbtg/codebase/personal-stuff/pipelines/video/visuals-flow-2/videos/test-03/src/conclusion.mp4'
```

Measured durations (`ffprobe -v error -show_entries format=duration -of csv=p=0`):

| file | duration |
|---|---|
| `src/intro.mp4` | 117.567 |
| `src/body.mp4` | 879.733 |
| `src/conclusion.mp4` | 79.233 |
| sum | 1076.533 |
| `vo.full.mp3` | 1076.352 |

The 0.18s difference is mp3 encoder padding — expect small drift, do not treat it as an error.

**`lib/segments.mjs`** — how structure is currently invented (lines 5–16, 43):

```js
const DEMO_CUES = [ ... ];
const WINDOW = 30;   // s — rolling window the density is measured over
const MIN_HITS = 2;  // hits inside a window to call it demo
const MIN_SEG = 20;  // s — shorter runs are merged into their neighbour

export function proposeSegments(transcript) {
...
    steps.push({ start: t, end: t + 5, kind: hits >= MIN_HITS ? 'demo' : 'narration' });
```

**`videos/test-03/segments.json`**, verbatim:

```json
{"video":"test-03","confirmed":false,"segments":[{"kind":"narration","start":0,"end":190},{"kind":"demo","start":190,"end":300.23}]}
```

**Why `structure` must be a NEW field, not a new `kind`.** `lib/lint-cues.mjs` branches on segment kind in at least five places, e.g.:

```js
  const kindAt = (t) => (segments.find(s => t >= s.start && t < s.end) ?? {}).kind ?? 'narration';
...
    if (s.kind === 'demo' || s.kind === 'playback') {
...
    if (['demo', 'playback'].includes(kPrev) || ['demo', 'playback'].includes(kCurr)) continue;
```

Every non-demo kind falls through to narration handling. Introducing `kind: 'intro'` would silently reclassify the opening and change which cadence rules apply to it. `structure` (where the parts are, from the files) and `segments` (what is on screen, demo vs narration) are orthogonal facts and must stay separate fields.

**Existing coverage**: only `videos/test-03` has the three-file layout; `videos/test-01` has no `src/` at all. The gate is therefore going-forward: it fires when a workdir HAS a `src/` directory. A workdir with no `src/` at all is a pre-convention video and is skipped with a warning, not an error.

**Convention to imitate**: `lib/segments.test.mjs` — `node:test` + `node:assert/strict`. Temp workdirs are built under a gitignored `.test-tmp/` (see `pipelines/video/card-library/CLAUDE.md`'s "never commit generated media" rule); follow whatever the neighbouring tests already do for scratch dirs.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0, `visuals-flow check OK` |
| Segments tests | `cd pipelines/video/visuals-flow-2 && node --test lib/segments.test.mjs` | all pass |
| Probe a duration | `ffprobe -v error -show_entries format=duration -of csv=p=0 <file>` | seconds as a float |
| Inspect structure | `cd pipelines/video/visuals-flow-2 && node -e "console.log(JSON.stringify(require('./videos/test-03/segments.json').structure,null,2))"` | see Step 5 |

## Scope

**In scope**:
- `pipelines/video/visuals-flow-2/lib/source-structure.mjs` (new)
- `pipelines/video/visuals-flow-2/lib/source-structure.test.mjs` (new)
- `pipelines/video/visuals-flow-2/lib/segments.mjs` (write `structure` into `segments.json`)
- `pipelines/video/visuals-flow-2/scripts/check.sh` (register the new test file — see Step 6)
- `pipelines/video/visuals-flow-2/videos/test-03/segments.json` (regenerated output)
- `pipelines/video/visuals-flow-2/PIPELINE.md` (document the three-file convention + the `structure` field)

**Out of scope**:
- `lib/lint-cues.mjs` — no rule may change behaviour in this plan. Rules that USE `structure` are plan 160.
- `lib/cue-rules.mjs` — no editorial rules here. The owner has explicitly said intro structure is subjective and must not be hardcoded.
- The `segments[]` array's demo/narration detection — leave `proposeSegments`'s heuristic exactly as it is.
- `lib/assemble.mjs` — its own `concat.txt` (written to a tmp dir) is a different file with the same name. Do not touch it.
- Re-cutting test-03.

## Git workflow

- Branch: `advisor/159-vf2-source-structure`
- Commit: `feat(vf2): derive intro/body/conclusion structure from the source files` — no AI footers. Do NOT push.

## Steps

### Step 1: Create `lib/source-structure.mjs`

New module. Inline source — place it and wire it, do not redesign it:

```js
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// The owner records every video as three files. That IS the structure — the
// pipeline used to throw it away and re-guess it from transcript keywords.
// Order matters: it is the timeline order.
export const PARTS = ['intro', 'body', 'conclusion'];
export const REQUIRED_PARTS = ['intro', 'conclusion'];

export function probeDuration(file) {
  const res = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
  ], { encoding: 'utf8' });
  if (res.status !== 0) return null;
  const d = parseFloat((res.stdout || '').trim());
  return Number.isFinite(d) ? d : null;
}

// Returns { structure, errors, warnings }.
// structure: [{ part, start, end }] in timeline order, or [] when there is no
// src/ directory at all (a pre-convention workdir).
export function sourceStructure(workdir, { total = null, probe = probeDuration } = {}) {
  const errors = [];
  const warnings = [];
  const srcDir = path.join(workdir, 'src');

  if (!fs.existsSync(srcDir)) {
    warnings.push('no src/ directory — this workdir predates the intro/body/conclusion convention; structure is unavailable');
    return { structure: [], errors, warnings };
  }

  const present = {};
  for (const part of PARTS) {
    const f = path.join(srcDir, `${part}.mp4`);
    present[part] = fs.existsSync(f) ? f : null;
  }

  for (const part of REQUIRED_PARTS) {
    if (!present[part]) {
      errors.push(`src/${part}.mp4 is missing — every video must be recorded as intro.mp4 + body.mp4 + conclusion.mp4. A video with no ${part} cannot be cut.`);
    }
  }
  if (errors.length) return { structure: [], errors, warnings };

  const structure = [];
  let t = 0;
  for (const part of PARTS) {
    const f = present[part];
    if (!f) continue;
    const d = probe(f);
    if (d === null) {
      errors.push(`could not read the duration of src/${part}.mp4`);
      return { structure: [], errors, warnings };
    }
    structure.push({ part, start: +t.toFixed(3), end: +(t + d).toFixed(3) });
    t += d;
  }

  // A part that exists in the source but never reaches the cut is exactly how
  // test-03 shipped without its conclusion: the cut stopped at the length of
  // the screen recording and nobody was told.
  if (total !== null) {
    for (const s of structure) {
      if (s.start >= total) {
        warnings.push(`the ${s.part} (source ${s.start.toFixed(1)}s-${s.end.toFixed(1)}s) is entirely OUTSIDE this ${total.toFixed(1)}s cut — it was recorded but never used`);
      } else if (s.end > total + 0.5) {
        warnings.push(`the ${s.part} is truncated by this cut (source ends ${s.end.toFixed(1)}s, cut ends ${total.toFixed(1)}s)`);
      }
    }
  }

  return { structure, errors, warnings };
}
```

**Verify**: `cd pipelines/video/visuals-flow-2 && node --check lib/source-structure.mjs && echo SYNTAX_OK` -> `SYNTAX_OK`

### Step 2: Prove it against the real workdir

```bash
cd pipelines/video/visuals-flow-2 && node -e "
import('./lib/source-structure.mjs').then(m=>{
  const r = m.sourceStructure('videos/test-03', { total: 300.23 });
  console.log(JSON.stringify(r, null, 2));
});"
```

**Verify**: `structure` has three entries — `intro` `0`→`117.567`, `body` `117.567`→`997.3`, `conclusion` `997.3`→`1076.533` (±0.01) — `errors` is empty, and `warnings` contains one line saying the **conclusion** is entirely outside the cut.

### Step 3: Prove the gate fires

```bash
cd pipelines/video/visuals-flow-2
mkdir -p .test-tmp/nogate/src && : > .test-tmp/nogate/src/intro.mp4 && : > .test-tmp/nogate/src/body.mp4
node -e "
import('./lib/source-structure.mjs').then(m=>{
  const r = m.sourceStructure('.test-tmp/nogate');
  console.log('errors:', r.errors.length, '|', r.errors[0] || '');
});"
rm -rf .test-tmp/nogate
```

**Verify**: prints `errors: 1` and a message naming `src/conclusion.mp4`.

### Step 4: Write `structure` into `segments.json`

In `lib/segments.mjs`, when writing `segments.json`, call `sourceStructure(workdir, { total })` and include the result as a top-level `structure` key. Print every returned warning to stderr, and **exit non-zero if `errors` is non-empty**, printing each error.

The written shape becomes:

```json
{
  "video": "test-03",
  "confirmed": false,
  "structure": [ { "part": "intro", "start": 0, "end": 117.567 }, ... ],
  "segments": [ { "kind": "narration", "start": 0, "end": 190 }, ... ]
}
```

Do NOT alter the `segments` array or `proposeSegments`. `structure` is additive.

**Verify**: `cd pipelines/video/visuals-flow-2 && node --check lib/segments.mjs && echo SYNTAX_OK` -> `SYNTAX_OK`

### Step 5: Regenerate test-03's segments.json

Run whatever `segments.mjs` entry point writes the file for an existing workdir (read its `usage:` line; `--propose` is the documented flag). Preserve the existing `segments` array values — if the entry point would re-derive and change them, instead add the `structure` key to the existing file by hand via a small node script, leaving `segments` byte-identical.

**Verify**:
```bash
cd pipelines/video/visuals-flow-2 && node -e "
const s=require('./videos/test-03/segments.json');
console.log('parts:', s.structure.map(x=>x.part).join(','));
console.log('segments unchanged:', JSON.stringify(s.segments)==='[{\"kind\":\"narration\",\"start\":0,\"end\":190},{\"kind\":\"demo\",\"start\":190,\"end\":300.23}]');
"
```
-> `parts: intro,body,conclusion` and `segments unchanged: true`

### Step 6: Tests, and register them in `check.sh`

Create `lib/source-structure.test.mjs` with at least these cases, using a fake `probe` function so no media is needed:

1. three files present -> three contiguous parts, `start` of each equals `end` of the previous, no errors
2. `conclusion.mp4` missing -> exactly one error naming `src/conclusion.mp4`, `structure` empty
3. `intro.mp4` missing -> exactly one error naming `src/intro.mp4`
4. no `src/` directory -> no errors, one warning, `structure` empty
5. `total` shorter than the conclusion's start -> a warning containing `never used`

**`scripts/check.sh` enumerates its test files explicitly** — a new test file that is not added there never runs. Add `lib/source-structure.test.mjs` to that list.

**Verify**: `cd pipelines/video/visuals-flow-2 && node --test lib/source-structure.test.mjs 2>&1 | tail -4` -> `# fail 0`, and `grep -c "source-structure.test.mjs" scripts/check.sh` -> `1`

### Step 7: Document the convention

In `PIPELINE.md`, add a short section stating: every video's `src/` must contain `intro.mp4`, `body.mp4` and `conclusion.mp4`; `intro` and `conclusion` are required and their absence is a hard error; `structure` in `segments.json` is derived by measuring those files and is distinct from `segments` (which describes demo vs narration on screen).

**Verify**: `cd pipelines/video/visuals-flow-2 && grep -c "conclusion.mp4" PIPELINE.md` -> at least `1`

### Step 8: Full gate

**Verify**: `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` -> exit 0, ends `visuals-flow check OK`

## Test plan

Five unit tests (Step 6) driven by an injected `probe` so they need no media files — that is why `sourceStructure` takes `probe` as an option. The "never used" warning case is the one that matters most: it is the mechanism that would have told the owner months ago that the conclusion was not in the cut.

No test asserts anything about lint behaviour, because this plan must not change any.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` exits 0
- [ ] `node --test lib/source-structure.test.mjs` reports `# fail 0`
- [ ] `scripts/check.sh` contains `lib/source-structure.test.mjs`
- [ ] `videos/test-03/segments.json` has a `structure` array of three parts and a byte-identical `segments` array
- [ ] running structure on `videos/test-03` with `total: 300.23` warns that the conclusion is outside the cut
- [ ] a workdir with `src/` but no `conclusion.mp4` produces a hard error
- [ ] `git diff --stat` shows `lib/lint-cues.mjs` and `lib/cue-rules.mjs` UNCHANGED

## STOP conditions

- Any existing lint or resolve test changes result. This plan adds a field and must change no behaviour. Report which test moved.
- The three measured parts do not sum to within 1s of `vo.full.mp3`'s duration for test-03 — the source files or the concat order are not what this plan assumes. Report the measured numbers.
- `structure` cannot be added without also modifying `segments[]`. Stop and report rather than reclassifying segment kinds.
- The gate would fire on a workdir that has no `src/` directory. That is a pre-convention video and must warn, not error. Fix and continue.

## Maintenance notes

- `structure` answers "which part of the video is this?" and `segments` answers "is the screen being demoed right now?". They are independent; resist any future urge to merge them.
- The hard error is deliberately on the INPUT (files on disk), not on editorial content. Intro quality is subjective and the owner has ruled that it must not be hardcoded — plan 160 adds guidance for the cue pass, not a checklist.
- The "recorded but never used" warning is the cheapest safety net in the pipeline. If a future change makes cuts routinely shorter than the source, that warning will fire constantly — the right response is to fix the cut, not to silence the warning.
