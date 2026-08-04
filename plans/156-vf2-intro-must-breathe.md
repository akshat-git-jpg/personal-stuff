---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui: false
deploy:
needs: [plan 155 introduces MAX_FULLFRAME_ONSCREEN which W13 reads — land 155 first]
---

# Plan 156: The intro must breathe — host-visibility and frozen-frame lints

## Summary

- **Problem statement**: test-03's first 53 seconds are three back-to-back fullframe cards; the presenter's face does not appear until 0:54. Measured frame-to-frame delta sits at 0.01 (a still image) for 20 consecutive seconds during `c02`, which carries `beats: []` across a 24.3s hold. Nothing in the rulebook or lint prevents either.
- **Goals**:
  - `W12 opening-host-coverage` — fail-loud when the opening is wall-to-wall graphics and the viewer never sees the presenter.
  - `W13 frozen-fullframe` — fail-loud when a fullframe card holds the screen past `MAX_FULLFRAME_ONSCREEN` with no beats to change the frame.
  - A rulebook entry so the cue pass stops producing these, not just a lint that catches them afterwards.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — fully inlined lint logic + unit tests.
- **Done criteria** (terse): `bash scripts/check.sh` exits 0; both lints fire on test-03's current cues with the exact strings below.
- **Stop conditions** (terse): either lint fires as an ERROR rather than a warning; `check-rulebook` fails after the prompt rebuild.
- **Test / verification for success**: unit tests in `lib/lint-cues.test.mjs` plus running the real linter against `videos/test-03`.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 64a151b..HEAD -- pipelines/video/visuals-flow/lib/lint-cues.mjs pipelines/video/visuals-flow/lib/cue-constants.mjs pipelines/video/visuals-flow/lib/cue-rules.mjs`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plan 155 (adds `MAX_FULLFRAME_ONSCREEN`)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `64a151b`, 2026-07-28

## Why this matters

The intro is the part of a tutorial that decides whether anyone watches the rest, and right now it is the weakest-directed stretch in the video. The owner's ask was to make the intro "literally the best". The measurement says the problem is not the card designs — it is that nothing changes on screen and the human never appears.

Measured on `~/kb-scratch/video/visuals-flow/test-03/versions/v3.mp4`, mean frame-to-frame delta per second over the opening:

| Window | Card | Mean delta | Reality |
|---|---|---|---|
| 10–14s | `title/title-versus` | 0.01 | frozen |
| 19–38s | `enacted/promise-split` | 0.01 | frozen for 20 consecutive seconds |
| 54s | host appears | 2.58 | first real motion in the video |

Only three visual events occur in the first 53 seconds. The presenter is speaking throughout — the cards are covering him.

These are gates, not hints, for the reason recorded in `plans/runs/LESSONS.md` (2026-07-24): *"making an LLM audit advisory (chips on a board) means it gets ignored — port doctrine as GATES, not signals."*

## Current state

**`pipelines/video/visuals-flow/lib/lint-cues.mjs`** — the cue linter. Signature (line 30):

```js
export function lintCues({ cuesFile, resolved, words, catalog, segmentsData, manifest, conceptData }) {
  const errors = [];
  const warnings = [];
```

Warnings are plain strings pushed onto `warnings`, prefixed with their code. Existing codes in use: `W1 fullframe-cadence`, `W2 overlay-density`, `W3 total-count`, `W4 reveal-wordcount`, `W5 first-beat-idle`, `W6 bare-stretch`, `W7 bare-stretch`/`no-segment-map`, `W8 motif`, `W9 variant-rotation`, `W10 enacted-first`, `W11 section-footage`. **`W12` and `W13` are free.**

An existing warning, verbatim, as the shape to imitate (line 216):

```js
        warnings.push(`W11 section-footage: ${cur.id} (${cur.card}) is followed by only ${footage.toFixed(1)}s of footage before ${fulls[i + 1].id} (min ${MIN}s) — a section opener should hand over to the tool on screen, not cut straight to another graphic`);
```

`resolved` entries carry `{ id, card, start, duration, placement }`. The per-cue authored fields (including `beats`) live in `cuesFile.cues`; the linter already builds a lookup — read how `byId` is constructed near line 62 and reuse it rather than building a second map.

**`pipelines/video/visuals-flow/lib/cue-constants.mjs`** — `{ value, rule }` entries. Existing relevant values: `BEAT_GAP_MAX` 15, `GAP_FULLFRAME_MIN` 12, `NARRATION_BARE_GAP_MAX` 20, `ZONE_END` 20. Plan 155 adds `MAX_FULLFRAME_ONSCREEN` 12.

**`pipelines/video/visuals-flow/lib/cue-rules.mjs`** — routing rules as `{ rule, why }`. `lib/build-prompt.mjs` renders `r.rule` (not the key) into `steps/020-cue-pass-llm/cue-pass-prompt.md` between generated markers; `lib/check-rulebook.mjs` fails if the prompt is stale. There is already an `R_COLD_OPEN_ZONE` entry reading *"Cold-open beat allowed in the first 15s (this zone stays sparse — W6 does not police it)"* — the new rule complements it and must not contradict it.

**The two real offenders in `videos/test-03`** (current `resolved.json` + `cues.json`):

| id | card | start | duration | beats |
|---|---|---|---|---|
| c01 | `title/title-versus` | 0.60 | 14.70 | `[]` |
| c02 | `enacted/promise-split` | 15.30 | 24.30 | `[]` |

Both exceed 12s with no beats. c01 also covers the whole opening, leaving 0.6s of visible presenter before it.

**Convention to imitate**: `lib/lint-cues.test.mjs` — `node:test` + `node:assert/strict`, each test builds a minimal `resolved` array plus a matching `cuesFile` and asserts on `warnings.some(w => w.startsWith('W..'))`. Match it exactly.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, `visuals-flow check OK` |
| Lint tests only | `cd pipelines/video/visuals-flow && node --test lib/lint-cues.test.mjs` | all pass |
| Lint test-03 | `cd pipelines/video/visuals-flow && node lib/lint-cues.mjs test-03` | warnings printed, exit 0 |
| Rebuild prompt | `cd pipelines/video/visuals-flow && node lib/build-prompt.mjs` | `prompt constraints up to date` |
| Rulebook gate | `cd pipelines/video/visuals-flow && node lib/check-rulebook.mjs` | `rulebook ok` |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/cue-constants.mjs`
- `pipelines/video/visuals-flow/lib/lint-cues.mjs`
- `pipelines/video/visuals-flow/lib/cue-rules.mjs`
- `pipelines/video/visuals-flow/lib/lint-cues.test.mjs`
- `pipelines/video/visuals-flow/steps/020-cue-pass-llm/cue-pass-prompt.md` (regenerated only, never hand-edited)

**Out of scope**:
- `lib/resolve.mjs` — plan 155 owns exposure. This plan only *observes* durations.
- `videos/test-03/cues.json` — do NOT re-author test-03's cues to silence the new warnings. The warnings firing on test-03 is this plan's proof that the lint works; re-cueing is a separate operating step the owner runs.
- `title/title-versus` and `enacted/promise-split` card HTML — the cards are fine; the cueing is the defect.
- Making either check an ERROR. Both are warnings. An error would block every existing video until re-cued.

## Git workflow

- Branch: `advisor/156-vf2-intro-must-breathe`
- Commit: `feat(visuals-flow): W12 opening-host-coverage + W13 frozen-fullframe lints` — no AI footers. Do NOT push.

## Steps

### Step 1: Add the two constants

In `lib/cue-constants.mjs`, add (match the existing `{ value, rule }` shape):

```js
  HOST_VISIBLE_BY: {
    value: 15,
    rule: 'The presenter must be visible within the first 15s. A tutorial that opens on wall-to-wall graphics has no one on screen to trust.',
  },
  OPENING_HOST_MIN: {
    value: 3,
    rule: 'At least 3s of the opening window must be free of fullframe cards, so the presenter actually lands rather than flashing between cards.',
  },
```

**Verify**: `cd pipelines/video/visuals-flow && node -e "import('./lib/cue-constants.mjs').then(m=>console.log(m.CUE_CONSTANTS.HOST_VISIBLE_BY.value, m.CUE_CONSTANTS.OPENING_HOST_MIN.value))"` -> `15 3`

### Step 2: Add W12 opening-host-coverage

In `lib/lint-cues.mjs`, after the `W11 section-footage` block, add:

```js
  // W12 opening-host-coverage (owner 2026-07-28). test-03 opened on 53s of
  // back-to-back fullframe cards — the presenter first appeared at 0:54, and
  // measured frame delta sat at 0.01 (a still image) for 20 of those seconds.
  // The host is speaking the whole time; the cards are covering him. Require
  // the opening window to leave room for the person to actually appear.
  {
    const BY = CUE_CONSTANTS.HOST_VISIBLE_BY.value;
    const MIN_FREE = CUE_CONSTANTS.OPENING_HOST_MIN.value;
    const covered = [];
    for (const r of sortedResolved) {
      if (r.placement !== 'fullframe') continue;
      const s = Math.max(0, r.start);
      const e = Math.min(BY, r.start + r.duration);
      if (e > s) covered.push([s, e]);
    }
    covered.sort((a, b) => a[0] - b[0]);
    let free = 0;
    let cursor = 0;
    for (const [s, e] of covered) {
      if (s > cursor) free += s - cursor;
      cursor = Math.max(cursor, e);
    }
    if (cursor < BY) free += BY - cursor;
    if (free < MIN_FREE) {
      warnings.push(`W12 opening-host-coverage: only ${free.toFixed(1)}s of the first ${BY}s is free of fullframe cards (min ${MIN_FREE}s) — the presenter never lands before the graphics take over`);
    }
  }
```

**Verify**: `cd pipelines/video/visuals-flow && node lib/lint-cues.mjs test-03 2>&1 | grep -c "W12 opening-host-coverage"` -> `1`

### Step 3: Add W13 frozen-fullframe

Immediately after the W12 block, add:

```js
  // W13 frozen-fullframe (owner 2026-07-28). A beatless fullframe card is a
  // still image: nothing is scheduled to change. test-03's c02 held 24.3s
  // with beats: [] and measured 0.01 mean frame delta for 20 straight
  // seconds. Past MAX_FULLFRAME_ONSCREEN a card needs beats, or it needs to
  // be split, or the frame belongs back on the footage.
  {
    const MAX = CUE_CONSTANTS.MAX_FULLFRAME_ONSCREEN.value;
    for (const r of sortedResolved) {
      if (r.placement !== 'fullframe') continue;
      if (r.duration <= MAX) continue;
      const authored = byId[r.id];
      const beatCount = authored && Array.isArray(authored.beats) ? authored.beats.length : 0;
      if (beatCount === 0) {
        warnings.push(`W13 frozen-fullframe: ${r.id} (${r.card}) holds the screen ${r.duration.toFixed(1)}s with no beats (max ${MAX}s without one) — nothing changes on screen; add beats, split the cue, or hand the frame back to footage`);
      }
    }
  }
```

If the linter's existing lookup is not named `byId`, use whatever it is called — read lines ~60–70 first. Do not build a second map.

**Verify**: `cd pipelines/video/visuals-flow && node lib/lint-cues.mjs test-03 2>&1 | grep "W13 frozen-fullframe"` -> two lines, naming `c01` and `c02`

### Step 4: Add the rulebook entry

In `lib/cue-rules.mjs`, add after `R_NO_IDLE`:

```js
  R_OPENING: {
    rule: 'The opening must breathe (mandatory): the presenter must be visible within the first 15s — do NOT cover the opening with back-to-back fullframe cards, and never let a fullframe card hold the screen past 12s with no beats. A card with no beats is a still image: if the point needs 20s of screen time it needs beats or two cues, not one long hold. When the VO is doing the work and there is nothing to enact, place NO card and leave the presenter on screen. Enforced as lint warnings W12 (opening-host-coverage) and W13 (frozen-fullframe).',
    why: 'owner 2026-07-28, test-03: the first 53s were three back-to-back fullframe cards and the host first appeared at 0:54; measured mean frame-to-frame delta was 0.01 (a still image) for 20 consecutive seconds inside c02, which carried beats: [] across a 24.3s hold. The intro is the part of a tutorial that decides whether anyone watches the rest, and it was the least directed stretch in the video',
  },
```

Then regenerate the prompt.

**Verify**: `cd pipelines/video/visuals-flow && node lib/build-prompt.mjs && node lib/check-rulebook.mjs && grep -c "The opening must breathe" steps/020-cue-pass-llm/cue-pass-prompt.md` -> `rulebook ok` then `1`

(Note: the generated prompt contains the rule TEXT, not the key `R_OPENING`. Grep for the text, never the id.)

### Step 5: Add unit tests

Append to `lib/lint-cues.test.mjs`, matching the file's existing helper style for building `resolved` / `cuesFile`:

```js
test('W12 fires when fullframe cards cover the whole opening', () => {
  const resolved = [
    { id: 'c01', card: 'title/x', start: 0.6, duration: 14.7, placement: 'fullframe' },
  ];
  const cuesFile = { cues: [{ id: 'c01', card: 'title/x', beats: [] }] };
  const { warnings } = lintCues(mkArgs({ resolved, cuesFile }));
  assert.ok(warnings.some((w) => w.startsWith('W12 opening-host-coverage')));
});

test('W12 stays silent when the opening leaves room for the host', () => {
  const resolved = [
    { id: 'c01', card: 'title/x', start: 8.0, duration: 4.0, placement: 'fullframe' },
  ];
  const cuesFile = { cues: [{ id: 'c01', card: 'title/x', beats: [] }] };
  const { warnings } = lintCues(mkArgs({ resolved, cuesFile }));
  assert.ok(!warnings.some((w) => w.startsWith('W12 opening-host-coverage')));
});

test('W13 fires on a long fullframe with no beats', () => {
  const resolved = [
    { id: 'c02', card: 'enacted/promise-split', start: 15.3, duration: 24.3, placement: 'fullframe' },
  ];
  const cuesFile = { cues: [{ id: 'c02', card: 'enacted/promise-split', beats: [] }] };
  const { warnings } = lintCues(mkArgs({ resolved, cuesFile }));
  assert.ok(warnings.some((w) => w.startsWith('W13 frozen-fullframe') && w.includes('c02')));
});

test('W13 stays silent when a long fullframe carries beats', () => {
  const resolved = [
    { id: 'c02', card: 'enacted/promise-split', start: 15.3, duration: 24.3, placement: 'fullframe' },
  ];
  const cuesFile = { cues: [{ id: 'c02', card: 'enacted/promise-split', beats: [{ at: 5 }, { at: 12 }, { at: 19 }] }] };
  const { warnings } = lintCues(mkArgs({ resolved, cuesFile }));
  assert.ok(!warnings.some((w) => w.startsWith('W13 frozen-fullframe')));
});
```

`mkArgs` stands for whatever the existing tests use to assemble `lintCues`'s argument object — **read the file and reuse its real helper or literal shape**; if there is no helper, inline the same full argument object the neighbouring tests build (including `words`, `catalog`, `segmentsData`, `manifest`, `conceptData`). Do not change `lintCues`'s signature to make testing easier.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/lint-cues.test.mjs 2>&1 | tail -5` -> `# fail 0`

### Step 6: Confirm both lints fire on the real video and nothing became an error

```bash
cd pipelines/video/visuals-flow && node lib/lint-cues.mjs test-03; echo "exit=$?"
```

**Verify**: exit `0` (warnings only), output contains one `W12 opening-host-coverage` line and two `W13 frozen-fullframe` lines naming `c01` and `c02`.

### Step 7: Full gate

**Verify**: `cd pipelines/video/visuals-flow && bash scripts/check.sh` -> exit 0, ends `visuals-flow check OK`

## Test plan

Four unit tests (Step 5) — each lint gets both a fires-when-it-should and a stays-silent-when-it-should case. The negative cases matter more than the positives here: a lint that fires on everything gets ignored within a week, which is exactly how W1/W7 became background noise in this repo.

Plus Step 6's run against the real test-03 cues, which is the case the owner actually reported.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0
- [ ] `node --test lib/lint-cues.test.mjs` reports `# fail 0`
- [ ] `node lib/lint-cues.mjs test-03` exits 0 and prints exactly one `W12` line
- [ ] the same run prints exactly two `W13` lines, naming `c01` and `c02`
- [ ] `node lib/check-rulebook.mjs` prints `rulebook ok`
- [ ] `git diff --stat` shows `videos/test-03/cues.json` UNCHANGED

## STOP conditions

- Either new check lands in `errors` instead of `warnings` — that would block every existing video. Fix to a warning and continue; if it cannot be a warning, stop and report.
- `MAX_FULLFRAME_ONSCREEN` is not defined in `cue-constants.mjs` — plan 155 has not landed. STOP and report; do not define the constant here, or the two plans will disagree about its value.
- W13 fires on more than the two named cues in test-03, or W12 fires more than once. That means the window arithmetic is wrong. Report the actual lines.
- Any existing lint test fails. Report the name; do not weaken an existing assertion.

## Maintenance notes

- W13 deliberately keys on `beats.length === 0` rather than on measured pixel motion — the linter runs before anything is rendered. It is a proxy: a card with beats *can* still be visually dull. If dull-but-beated cards become a complaint, the next step is a render-time motion probe (mean frame delta, the measurement used to diagnose this), not a stricter beat count.
- `HOST_VISIBLE_BY` (15s) intentionally matches the existing `R_COLD_OPEN_ZONE` 15s window so the two rules describe the same opening. If one moves, move both.
- Reviewers should check that W12's interval-merge handles overlapping fullframes; cues should never overlap (E-level rule elsewhere), but the merge must not double-count if they do.
