<!-- boss frontmatter -->
---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow && node --test
ui:
deploy:
needs: ["Independent of 115/116/117; 120 depends on this"]
---

# Plan 118: Single-source the cue constraints — the prompt is generated from the linter, not written beside it

## Summary

- **Problem statement**: Every density/cap threshold exists three times — as code in `lib/lint-cues.mjs`, as prose in `cue-pass-prompt.md`, and again as prose in `RULEBOOK.md`. `check-rulebook.mjs` validates structure but never checks the numbers agree. Two constraints are already wrong: the total-cue-count band (W3) appears nowhere in the prompt, and the prompt's end-zone rule contradicts hard error E4.
- **Goals**:
  - Move every threshold into one exported module, imported by the linter.
  - **Generate** the prompt's constraints block from those constants, and fail the rulebook gate on any drift.
  - Fix the two known prompt/linter contradictions, including a catalog card that is currently impossible to place legally.
- **Executor proposed**: `claude-p` / `sonnet` — the prompt and RULEBOOK are quality-setting content the owner judges by taste (`tooling/boss/data/rules.md`).
- **Done criteria** (terse — full list below): constants live in one file; `check-rulebook.mjs` fails on an induced drift; the prompt states the count band and the true end-zone rule; `node --test` green.
- **Stop conditions** (terse — full list below): suite red before starting; any threshold change that alters existing videos' lint output.
- **Test / verification for success**: a drift test that mutates a constant and asserts the rulebook gate fails.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 18488a2..HEAD -- pipelines/video/visuals-flow/lib/lint-cues.mjs pipelines/video/visuals-flow/lib/check-rulebook.mjs pipelines/video/visuals-flow/steps/020-cue-pass-llm`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Difficulty**: standard
- **Planned at**: commit `18488a2`, 2026-07-21

## Why this matters

The cue pass is explicitly model-portable: `cue-pass-prompt.md` is self-contained, has no repo access, and the skill states any "Sonnet-class-or-better" session may run it. That design only works if the prompt tells the model **exactly** what the linter will enforce. Today it does not, and the gaps are not hypothetical — a cue-pass session on 2026-07-21 hit all of them:

1. **W3 total-count is invisible.** `TARGET_RATE_MIN = 1.0` / `TARGET_RATE_MAX = 1.9` cues per minute appears nowhere in the prompt. The session exceeded the band twice and only discovered it by running the linter.
2. **The end-zone rule is inverted.** The prompt says *"end-card allowed in the last 20s"*. Lint E4 raises a **hard error** for any cue ending after `T - 20` unless its slug starts with `brand/` or `link-in-description/`. The session placed a `like-subscribe/like-subscribe` outro — the card's only sensible position — and got a hard error.
3. **`like-subscribe/` is structurally unplaceable.** It exists in `catalog.json` purely for the outro, and the outro is exactly where E4 forbids it. The catalog offers a card the linter refuses.
4. **Nothing detects drift.** `check-rulebook.mjs` checks that sections exist and the worked example parses. If someone retunes `GAP_FULLFRAME_MAX` in code, the prompt keeps teaching the old number silently, and every future cue pass is planned against a fiction.

A model cannot be blamed for violating a constraint it was never shown. Removing that class of failure is the point of this plan.

## Current state

### `lib/lint-cues.mjs` lines 5–22, verbatim

```js
const CAP_STAT_HIT = 3;
const SPACING_STAT_HIT = 90;
const CAP_FULLFRAME = 3;
const ZONE_END = 20;
// Density recalibration 2026-07-21 (owner: "motion graphics more frequent —
// long stretches were bare"). Moderate ~2x: fullframe beat every ~35-60s, floor
// rate 1.0/min, and W6 forbids any interior stretch >50s with no graphic at all
// (fullframe OR overlay). Supersedes the Youri-wave starting numbers per the
// same owner-directive precedent; the 060 fold tunes from here. decisions.md.
const GAP_FULLFRAME_MAX = 60;
const GAP_FULLFRAME_MIN = 35;
const DENSITY_OVERLAY_WINDOW = 60;
const DENSITY_OVERLAY_MAX = 3;
const TARGET_RATE_MIN = 1.0;
const TARGET_RATE_MAX = 1.9;
const BARE_GAP_MAX = 50;
const FIRST_BEAT_IDLE_MAX = 8;
const ENDCARD_SLUG_PREFIXES = ['brand/', 'link-in-description/'];
```

(Plan 116 changes `FIRST_BEAT_IDLE_MAX` into an object; if 116 has landed, carry its shape through.)

### `steps/020-cue-pass-llm/cue-pass-prompt.md` — the prose copies

Lines 58–71 hold the density rules. The contradiction is line 70–71:

```
- Cold-open beat allowed in the first 15s; end-card allowed in the last 20s
  (these two zones stay sparse — W6 does not police them).
```

Line 127–131 restates the caps; line 157–159 restates the first-beat rule. `RULEBOOK.md` restates all of it again at lines 40–41, 61–66, 109, 127, 157, 167, 358.

### `lib/check-rulebook.mjs` — what the gate does today

Reads the rulebook, asserts nine `## ` sections exist, asserts the prompt contains `{{CATALOG}}`, `{{TRANSCRIPT}}` and the string `raw JSON`, then parses the worked example and checks its card slugs exist. **No numeric comparison anywhere.**

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full suite (merge gate) | `cd pipelines/video/visuals-flow && node --test` | exit 0, `# fail 0` |
| Rulebook gate | `cd pipelines/video/visuals-flow && node lib/check-rulebook.mjs` | `rulebook ok` |
| Regenerate the prompt block | `cd pipelines/video/visuals-flow && node lib/build-prompt.mjs` | `prompt constraints up to date` |
| Lint a video | `cd pipelines/video/visuals-flow && node lib/lint-cues.mjs test-02` | unchanged from baseline |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/cue-constants.mjs` (new)
- `pipelines/video/visuals-flow/lib/build-prompt.mjs` (new)
- `pipelines/video/visuals-flow/lib/lint-cues.mjs` (import constants; add `like-subscribe/`)
- `pipelines/video/visuals-flow/lib/check-rulebook.mjs` (drift gate)
- `pipelines/video/visuals-flow/lib/check-rulebook.test.mjs` (new)
- `pipelines/video/visuals-flow/steps/020-cue-pass-llm/cue-pass-prompt.md`
- `pipelines/video/visuals-flow/steps/020-cue-pass-llm/RULEBOOK.md`
- `pipelines/video/visuals-flow/HANDOFF.md`

**Out of scope**:
- **Changing any threshold value.** This plan relocates numbers and fixes two prose contradictions. Retuning density is the 060 fold's job, and doing it here would hide a behaviour change inside a refactor.
- `lib/lint-shots.mjs` and the shot-pass prompt — same disease, separate plan.
- Any `cues.json` or `videos/**`.

## Git workflow

- Branch: `advisor/118-lint-constants-single-source`
- Commit per step. Message style: `refactor(visuals-flow): single-source cue constraints`. No AI footers. Do NOT push.

## Steps

### Step 1: Extract the constants

Create `lib/cue-constants.mjs`. Every entry carries the value **and** the model-facing sentence that will be rendered into the prompt — keeping them adjacent is what stops them drifting apart.

```js
// Single source of truth for cue-pass constraints.
// lib/lint-cues.mjs enforces these; lib/build-prompt.mjs renders them into
// steps/020-cue-pass-llm/cue-pass-prompt.md; lib/check-rulebook.mjs fails if
// the rendered block and these values disagree. Never restate a number in
// prose — add it here and regenerate.
export const CUE_CONSTANTS = {
  CAP_FULLFRAME:          { value: 3,    rule: 'Any non-structural fullframe card may be used at most 3 times per video (lint E3). Structural cards (catalog `structural: true`) are exempt.' },
  CAP_STAT_HIT:           { value: 3,    rule: 'overlay/stat-hit: at most 3 per video (lint E2).' },
  SPACING_STAT_HIT:       { value: 90,   rule: 'Consecutive overlay/stat-hit cues must start at least 90s apart (lint E2).' },
  ZONE_END:               { value: 20,   rule: 'No cue may END in the last 20s of the video except the end-card slugs listed below (lint E4 — a HARD ERROR, not a preference).' },
  GAP_FULLFRAME_MIN:      { value: 35,   rule: 'Consecutive fullframe cues must start at least 35s apart, measured START to START across narration time (lint W1).' },
  GAP_FULLFRAME_MAX:      { value: 60,   rule: 'Consecutive fullframe cues must start no more than 60s apart, measured START to START across narration time (lint W1).' },
  DENSITY_OVERLAY_MAX:    { value: 3,    rule: 'At most 3 overlay cues may START within any 60s window (lint W2).' },
  DENSITY_OVERLAY_WINDOW: { value: 60,   rule: null }, // referenced by the rule above
  TARGET_RATE_MIN:        { value: 1.0,  rule: 'Total cue count must be at least 1.0 per minute of video (lint W3).' },
  TARGET_RATE_MAX:        { value: 1.9,  rule: 'Total cue count must be at most 1.9 per minute of video (lint W3). For a 20-minute video that is 20-38 cues in total — budget before you place.' },
  BARE_GAP_MAX:           { value: 50,   rule: 'No interior narration stretch may run longer than 50s with no graphic of any kind (lint W6).' },
};

export const ENDCARD_SLUG_PREFIXES = ['brand/', 'link-in-description/', 'like-subscribe/'];
```

Note the third prefix — see Step 3.

Update `lib/lint-cues.mjs` to import from here and delete its local copies. Values must be identical, so lint output does not move.

**Verify**: `cd pipelines/video/visuals-flow && node lib/lint-cues.mjs test-02 > /tmp/after.txt 2>&1; git stash && node lib/lint-cues.mjs test-02 > /tmp/before.txt 2>&1; git stash pop; diff /tmp/before.txt /tmp/after.txt && echo IDENTICAL` -> `IDENTICAL`

### Step 2: Generate the prompt's constraints block

Add markers to `cue-pass-prompt.md`, replacing the hand-written numeric rules in the Density section:

```
<!-- BEGIN GENERATED CONSTRAINTS — edit lib/cue-constants.mjs, then run node lib/build-prompt.mjs -->
<!-- END GENERATED CONSTRAINTS -->
```

Create `lib/build-prompt.mjs`:
- reads `CUE_CONSTANTS`, renders every entry with a non-null `rule` as a `- ` bullet, plus a final bullet listing `ENDCARD_SLUG_PREFIXES`,
- replaces the text between the markers in `cue-pass-prompt.md`,
- `--check` mode: re-render and exit 1 with a diff if the file's block differs.

The rendered block must open with a line making its status explicit:

```
These are HARD constraints checked by lib/lint-cues.mjs after you produce cues.json.
A violation is a defect, not a stylistic choice. Budget against them BEFORE placing cues.
```

**Verify**: `cd pipelines/video/visuals-flow && node lib/build-prompt.mjs && node lib/build-prompt.mjs --check` -> `prompt constraints up to date`, exit 0

### Step 3: Fix the end-zone contradiction and the unplaceable card

Two coupled edits:

1. In `cue-pass-prompt.md`, delete the misleading sentence *"end-card allowed in the last 20s"*. The generated block now states the true rule (no cue may END in the last 20s except the listed prefixes). Keep the cold-open sentence — the first 15s genuinely is only a W6 exemption.
2. Add `'like-subscribe/'` to `ENDCARD_SLUG_PREFIXES` (already written into Step 1). Rationale to record in the commit message: `like-subscribe/like-subscribe` is an outro CTA whose only correct placement is the final seconds; excluding it from the end-zone allowlist made a shipped catalog card impossible to use legally.

Mirror both into `RULEBOOK.md`.

**Verify**: `cd pipelines/video/visuals-flow && grep -c "end-card allowed in the last" steps/020-cue-pass-llm/cue-pass-prompt.md` -> `0`

### Step 4: Make the rulebook gate fail on drift

Extend `lib/check-rulebook.mjs` with, in order:
- `build-prompt.mjs --check` equivalent: regenerate the block and `fail()` if it differs from the file, printing both versions.
- Assert the prompt contains no stray restatement of a governed number outside the generated block. Implement as: for each constant with a non-null `rule`, scan the prompt **outside** the markers for the literal value adjacent to a unit (`/\b35s\b/`, `/\b60s\b/`, `/\b50s\b/`, `/\b90s\b/`, `/\b20s\b/`, `/at most 3\b/`) and fail with the offending line. This is what stops a future editor re-introducing a hand-written copy.
- Assert `RULEBOOK.md` carries a pointer line to `lib/cue-constants.mjs` so the fold knows where numbers live.

**Verify**: `cd pipelines/video/visuals-flow && node lib/check-rulebook.mjs` -> `rulebook ok`

### Step 5: Drift test

Create `lib/check-rulebook.test.mjs`:
1. Baseline: `check-rulebook` passes on the repo as committed.
2. Drift: copy prompt + constants to a temp dir, mutate `GAP_FULLFRAME_MAX` to `999`, run the check against the temp copy, assert it **fails** with a message naming the constant.
3. Stray-number: inject the line `Fire a fullframe every 35s.` outside the markers, assert failure.

Test 2 is the whole point of the plan and must not be skipped as "hard to fixture" — build the temp dir with `fs.mkdtempSync`.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/check-rulebook.test.mjs` -> exit 0

### Step 6: Document

- `HANDOFF.md`: add a "Tuning cue density" line — change `lib/cue-constants.mjs`, run `node lib/build-prompt.mjs`, commit both; never hand-edit the generated block.
- `steps/060-feedback-fold-opus/README.md`: in the "quantitative selection rule" bullet, point at `lib/cue-constants.mjs` instead of `lib/lint-cues.mjs`.

**Verify**: `grep -c "cue-constants" pipelines/video/visuals-flow/HANDOFF.md pipelines/video/visuals-flow/steps/060-feedback-fold-opus/README.md` -> both at least `1`

## Test plan

New `lib/check-rulebook.test.mjs` covering baseline, drift and stray-number cases. The Step 1 stash-diff is a one-off manual equivalence check recorded in the commit message, not an automated test.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && node --test` exits 0 with `# fail 0`
- [ ] `node lib/check-rulebook.mjs` prints `rulebook ok`
- [ ] `node lib/build-prompt.mjs --check` exits 0
- [ ] `lib/lint-cues.mjs` declares no numeric threshold of its own
- [ ] Lint output for `test-01` and `test-02` is byte-identical to the pre-change baseline
- [ ] The prompt states the W3 count band and the true end-zone rule
- [ ] `ENDCARD_SLUG_PREFIXES` includes `like-subscribe/`
- [ ] Mutating a constant makes `check-rulebook.mjs` fail (test 2)

## STOP conditions

- **The suite is red before you start.**
- **Lint output for `test-01`/`test-02` changes at Step 1.** This step is a pure move; any diff means a value was transcribed wrongly. Stop and report.
- **A threshold looks wrong to you.** Do not retune it here. Note it and continue; retuning is a 060 fold decision with owner input.
- **The stray-number scan fires on legitimate prose** (e.g. a card's own `max_beats`). Report the false positive and narrow the regex to the governed units only — do not delete the check.

## Maintenance notes

- The one-way rule: numbers live in `lib/cue-constants.mjs`, prose is generated. A reviewer seeing a bare number in the prompt outside the markers should treat it as a bug.
- `rule` strings are model-facing copy. Their wording is worth the same care as the rest of the prompt — that is why this plan is routed to `sonnet` rather than the `agy` default.
- Plan 116's `BEAT_LEAD_IN` and plan 117's segment thresholds belong here once both land; fold them in during the next touch rather than starting a fourth home.
- The stray-number scan is the load-bearing part of the drift gate. Regenerating alone is not enough, because prose copies elsewhere in the file are what actually misled the model.
