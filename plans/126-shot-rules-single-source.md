<!-- boss frontmatter -->
---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: ["Independent of 124/125/127; same pattern as 118"]
---

# Plan 126: Extend the single-source pattern to the 070 shot pass

## Summary

- **Problem statement**: `lib/lint-shots.mjs` carries a comment reading "Tune constants here, nowhere else", directly above constants that `steps/070-shot-pass-llm/shot-pass-prompt.md` restates as prose. The claim is false and unenforced: 070 has the exact drift hazard that plan 118's machinery was built to eliminate for 020.
- **Goals**:
  - Move the shot constants into `lib/shot-constants.mjs`, imported by `lib/lint-shots.mjs`.
  - Generate them into `shot-pass-prompt.md` inside a marker pair.
  - Add `lib/check-shot-rulebook.mjs` gating the pair, wired into `scripts/check.sh`.
- **Executor proposed**: `claude-p` / `sonnet` — the prompt is quality-setting content the owner judges by taste (`tooling/boss/data/rules.md`).
- **Done criteria** (terse — full list below): constants live in one module; the prompt's numbers are generated; an induced constant edit fails the gate; `bash scripts/check.sh` green.
- **Stop conditions** (terse — full list below): suite red before starting; any change to a constant's VALUE; shot lint output changes for an existing video.
- **Test / verification for success**: a drift test mutating a shot constant and asserting the new gate fails naming it.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat be36087..HEAD -- pipelines/video/visuals-flow/lib/lint-shots.mjs pipelines/video/visuals-flow/steps/070-shot-pass-llm pipelines/video/visuals-flow/scripts/check.sh`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Difficulty**: standard
- **Planned at**: commit `be36087`, 2026-07-22

## Why this matters

020 and 070 are the same shape: an LLM step with a self-contained prompt and a linter that judges its output. 020 got a real single source in plan 118. 070 did not, and the gap is not theoretical: the code and the prompt already state the same numbers independently, so the first retune of either silently teaches the model a fiction.

The comment at `lint-shots.mjs:10` makes this worse by asserting a guarantee the code does not provide. A future editor reading "Tune constants here, nowhere else" will do exactly that and ship a stale prompt.

## Current state

### `lib/lint-shots.mjs` lines 6-18 verbatim

```js
// Budget + shape rules for full-screen avatar spans. Seeded from
// tutorial-pipeline-2's 060 rulebook knobs (U-curve, ~5:00 total cap from the
// HeyGen 4 limit); the cap is enforced in BOTH engine modes so a test-mode
// plan is production-shaped by construction. 2026-07-20 Youri recalibration:
// rhythm adopted, totals kept for cost. Tune constants here, nowhere else.
const AVATAR_FULL_CAP = 300;        // s — hard total ceiling (HeyGen 4 limit at production)
const AVATAR_FULL_TARGET = 240;     // s — scaled by video length (T/1800); warn under
const SPAN_MIN = 10;                // s — error: a shorter full-screen moment isn't worth a clip (Youri bridges run 10–30s)
const SPAN_MAX_MID = 45;            // s — warn: a MID-VIDEO bridge this long drags (reference cycle: 10–30s)
const SPAN_MAX_ZONE = 120;          // s — warn: even intro/outro host stretches drag past this
const FRONT_ZONE = 0.15;            // U-curve: expect a span starting in the first 15% of the VO
const BACK_ZONE = 0.15;             //          and one in the last 15%
const GAP_AVATAR_MAX = 180;         // s — warn: reference cycles host↔content much tighter than the old 300
```

### The duplicate, `steps/070-shot-pass-llm/shot-pass-prompt.md` lines 46-48 verbatim

```
4. Total full-screen time: aim near 4 minutes for a ~30-min video, never above
   5 minutes total. Mid-video spans are 10–30s bridges; only the intro and the
   conclusion may run longer (up to ~2 minutes). No span under ~10 seconds.
```

`4 minutes` is `AVATAR_FULL_TARGET`, `5 minutes` is `AVATAR_FULL_CAP`, `~10 seconds` is `SPAN_MIN`, `~2 minutes` is `SPAN_MAX_ZONE`. Four constants, retyped in prose, unit-converted, unchecked.

### The pattern to copy

`lib/cue-constants.mjs` (shape), `lib/build-prompt.mjs` (generator + markers + `--check`), `lib/check-rulebook.mjs:59-96` (drift gates 1 and 2, including `STRAY_NUMBER_PATTERNS`). Read all three before starting; this plan is a deliberate parallel of them.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate (merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, ends `visuals-flow check OK` |
| Unit tests only | `cd pipelines/video/visuals-flow && node --test lib/` | 0 failures |
| Shot lint on a real video | `cd pipelines/video/visuals-flow && node lib/lint-shots.mjs test-02` | same output as before your change |
| New gate alone | `cd pipelines/video/visuals-flow && node lib/check-shot-rulebook.mjs` | prints `shot rulebook ok` |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/shot-constants.mjs` (new)
- `pipelines/video/visuals-flow/lib/build-shot-prompt.mjs` (new)
- `pipelines/video/visuals-flow/lib/check-shot-rulebook.mjs` (new)
- `pipelines/video/visuals-flow/lib/check-shot-rulebook.test.mjs` (new)
- `pipelines/video/visuals-flow/lib/lint-shots.mjs`
- `pipelines/video/visuals-flow/steps/070-shot-pass-llm/shot-pass-prompt.md`
- `pipelines/video/visuals-flow/steps/070-shot-pass-llm/RULEBOOK.md`
- `pipelines/video/visuals-flow/scripts/check.sh`

**Out of scope**:
- `lib/cue-constants.mjs`, `lib/build-prompt.mjs`, `lib/check-rulebook.mjs` — do NOT refactor the 020 machinery into a shared generic. Two parallel implementations that each stay readable beat one abstraction serving two masters; the owner can unify later if a third step appears.
- `lib/resolve-shots.mjs` — no resolver changes.
- `MIN_SCREEN_ERROR` and any constant not restated in the prompt — leave those as local consts. Only the four the prompt duplicates need governing, plus any you find while reading.
- `videos/**` — never touch a video workdir.

## Git workflow

- Branch: `advisor/126-shot-rules-single-source`
- Commit: `visuals-flow: single-source the shot-pass constants` — no AI footers. Do NOT push.

## Steps

### Step 1: Create `lib/shot-constants.mjs`

Mirror `cue-constants.mjs` exactly in shape: an exported object, each entry `{ value, rule }`, `rule: null` for a constant the prompt should not state.

```js
// Single source of truth for shot-pass constraints.
// lib/lint-shots.mjs enforces these; lib/build-shot-prompt.mjs renders them
// into steps/070-shot-pass-llm/shot-pass-prompt.md; lib/check-shot-rulebook.mjs
// fails if the rendered block and these values disagree. Never restate a number
// in prose — add it here and regenerate.
export const SHOT_CONSTANTS = {
  AVATAR_FULL_CAP:    { value: 300, rule: 'Total full-screen avatar time must never exceed 300s (lint error). This is the HeyGen 4 production limit, enforced in both engine modes.' },
  AVATAR_FULL_TARGET: { value: 240, rule: 'Aim for about 240s of total full-screen avatar time, scaled by video length (T/1800); the linter warns below it.' },
  SPAN_MIN:           { value: 10,  rule: 'No avatar span may be shorter than 10s (lint error) — a shorter full-screen moment is not worth a clip.' },
  SPAN_MAX_MID:       { value: 45,  rule: 'A mid-video avatar span longer than 45s drags (lint warning); mid-video bridges should run 10s to 30s.' },
  SPAN_MAX_ZONE:      { value: 120, rule: 'Even an intro or outro host stretch drags past 120s (lint warning).' },
  FRONT_ZONE:         { value: 0.15, rule: 'Expect one avatar span starting within the first 15% of the voiceover (U-curve shape).' },
  BACK_ZONE:          { value: 0.15, rule: 'Expect one avatar span starting within the last 15% of the voiceover (U-curve shape).' },
  GAP_AVATAR_MAX:     { value: 180, rule: 'Consecutive avatar spans must start no more than 180s apart (lint warning) — host and content cycle tighter than the old 300s.' },
};
```

Keep every value IDENTICAL to the current literals. This plan changes no behaviour.

**Verify**: `cd pipelines/video/visuals-flow && node -e "import('./lib/shot-constants.mjs').then(m=>console.log(m.SHOT_CONSTANTS.AVATAR_FULL_CAP.value, m.SHOT_CONSTANTS.SPAN_MIN.value))"` -> `300 10`

### Step 2: Import them in `lib/lint-shots.mjs`

Replace the eight local `const` declarations with a single import plus local aliases, keeping every downstream reference unchanged:

```js
import { SHOT_CONSTANTS as SC } from './shot-constants.mjs';

const AVATAR_FULL_CAP = SC.AVATAR_FULL_CAP.value;
const AVATAR_FULL_TARGET = SC.AVATAR_FULL_TARGET.value;
const SPAN_MIN = SC.SPAN_MIN.value;
const SPAN_MAX_MID = SC.SPAN_MAX_MID.value;
const SPAN_MAX_ZONE = SC.SPAN_MAX_ZONE.value;
const FRONT_ZONE = SC.FRONT_ZONE.value;
const BACK_ZONE = SC.BACK_ZONE.value;
const GAP_AVATAR_MAX = SC.GAP_AVATAR_MAX.value;
```

Replace the "Tune constants here, nowhere else" sentence in the block comment with "Values live in lib/shot-constants.mjs; the prompt is generated from them." Keep the rest of that comment: it carries real provenance (the Youri recalibration, the HeyGen 4 origin).

**Verify**: `cd pipelines/video/visuals-flow && node lib/lint-shots.mjs test-02` -> byte-identical output to before this change (capture it first)

### Step 3: Create `lib/build-shot-prompt.mjs`

Copy `lib/build-prompt.mjs` and adapt: `SHOT_CONSTANTS`, path `steps/070-shot-pass-llm/shot-pass-prompt.md`, and these markers:

```js
export const SHOT_BEGIN_MARKER = '<!-- BEGIN GENERATED SHOT CONSTRAINTS — edit lib/shot-constants.mjs, then run node lib/build-shot-prompt.mjs -->';
export const SHOT_END_MARKER = '<!-- END GENERATED SHOT CONSTRAINTS -->';
```

Keep the same `--check` behaviour: compare, print `shot prompt constraints up to date` or exit 1 with a diff.

**Verify**: `cd pipelines/video/visuals-flow && node lib/build-shot-prompt.mjs --check` -> exits 1 (markers absent yet), with a clear error

### Step 4: Put the marker pair in `shot-pass-prompt.md` and delete the prose numbers

Replace lines 46-48 with the marker pair. Then rewrite the surrounding numbered item so it no longer states any number, keeping only the judgment that is not a constant, for example: `4. Place spans at natural pauses, never over hands-on narration. Mid-video spans are bridges; only the intro and conclusion may run long.`

Run the generator to fill the block.

**Verify**: `cd pipelines/video/visuals-flow && node lib/build-shot-prompt.mjs && node lib/build-shot-prompt.mjs --check` -> exit 0

### Step 5: Create `lib/check-shot-rulebook.mjs`

Mirror `check-rulebook.mjs`'s drift gates 1 and 2 for the shot pair:

- gate 1: the prompt's generated block matches a fresh render, naming stale constant keys on mismatch
- gate 2: no stray restatement of a governed number outside the block. Use these patterns, which cover the prose forms the current file uses:

```js
const STRAY_NUMBER_PATTERNS = [
  /\b5 minutes\b/,
  /\b4 minutes\b/,
  /\b10 seconds\b/,
  /\b2 minutes\b/,
  /\b300s\b/,
  /\b240s\b/,
  /\b180s\b/,
];
```

- gate 3: `steps/070-shot-pass-llm/RULEBOOK.md` must contain the string `shot-constants.mjs`, so the fold is pointed at the source. Add that pointer line to that RULEBOOK as part of this step.

Print `shot rulebook ok` on success.

**Verify**: `cd pipelines/video/visuals-flow && node lib/check-shot-rulebook.mjs` -> prints `shot rulebook ok`

### Step 6: Wire it into `scripts/check.sh`

Add the new gate next to the existing rulebook gate, so it runs in the merge gate. Match the existing style in that file.

**Verify**: `cd pipelines/video/visuals-flow && bash scripts/check.sh` -> exit 0, output now includes `shot rulebook ok`

### Step 7: Drift regression test

Add `lib/check-shot-rulebook.test.mjs` following `lib/check-rulebook.test.mjs`'s fixture style (explicit paths into a temp dir, never the real repo files):

- mutating one `SHOT_CONSTANTS` value and checking against the unmodified prompt fails, naming that key
- a fixture prompt with `5 minutes` outside the generated block fails gate 2

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/` -> 0 failures

## Test plan

The regression test in Step 7 is the product. Without it this plan is just a file move that can rot the same way. Model it directly on the existing `check-rulebook.test.mjs`.

## Done criteria

- [ ] `lib/shot-constants.mjs` exports all eight constants with unchanged values
- [ ] `lib/lint-shots.mjs` declares none of them locally
- [ ] `node lib/lint-shots.mjs test-02` output is unchanged from before the plan
- [ ] `shot-pass-prompt.md` states no governed number outside the generated block
- [ ] `node lib/build-shot-prompt.mjs --check` exits 0
- [ ] `node lib/check-shot-rulebook.mjs` prints `shot rulebook ok`
- [ ] Mutating a constant makes the gate fail naming it
- [ ] `bash scripts/check.sh` exits 0 and runs the new gate

## STOP conditions

- `bash scripts/check.sh` is already red before you start. Report and stop.
- `node lib/lint-shots.mjs test-02` output changes at any point. That means a value changed; revert and report. This plan must be behaviour-neutral.
- You are tempted to refactor `build-prompt.mjs` and `build-shot-prompt.mjs` into one generic module. Do not: that is explicitly out of scope, and the shared abstraction is harder to review than the duplication.
- A constant has no sensible prose form. Set `rule: null` and leave it ungoverned rather than inventing a rule.
- You find yourself editing anything under `videos/`. Stop immediately.

## Maintenance notes

- After this lands, 020 and 070 have identical machinery. If a third LLM step ever appears, THAT is the moment to extract a shared generator, with three real call sites to design against.
- `SPAN_MAX_MID` currently has no prose form in the prompt at all; giving it one is a small behaviour improvement for the model, and is intentional.
