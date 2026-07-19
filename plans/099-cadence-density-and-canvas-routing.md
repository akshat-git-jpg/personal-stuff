---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 099: cadence density + canvas routing (spec D1)

## Summary

- **Problem statement**: Density rules are calibrated conservative and partly per-video-count; the owner approved adopting the reference channel's measured density (spec: `docs/specs/2026-07-19-mode-structure-density-design.md`, D1) with per-minute cadences so one grammar scales across 9-min and 32-min videos.
- **Goals**: retune `lint-cues.mjs` constants to the reference calibration; convert the total-cue band to a per-minute rate; replace start/end exclusion zones with cold-open/end-card allowances; add the canvas-beat routing rule to the 020 pair; rewrite the EDITOR-STYLE-GUIDE density section.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — standard, fully inlined.
- **Done criteria** (terse): check.sh green with updated lint tests; prompt/RULEBOOK pair in sync; style guide rewritten.
- **Stop conditions** (terse): test-01's committed cues.json must not gain lint ERRORS (warnings fine); stop if it does.
- **Test / verification for success**: lint unit tests over synthetic cue sets at both video lengths + test-01 regression.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b406fe9..HEAD -- pipelines/video/visuals-flow/lib/lint-cues.mjs pipelines/video/visuals-flow/lib/lint.test.mjs pipelines/video/visuals-flow/steps/020-cue-pass-llm pipelines/video/visuals-flow/EDITOR-STYLE-GUIDE.md`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (095–098 in flight touch different files; the 097/098 routing lines merge cleanly with this plan's density section — rebase normally)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `b406fe9`, 2026-07-19

## Why this matters

Owner-approved design (spec D1): the reference channel's grammar fires a
graphic beat every 45–90s and stacks overlays ~3/min in review stretches; our
current rules forbid that density, so cue passes can never produce the look
the owner wants cloned. Cadence-based numbers make the same grammar serve
every video length.

## Current state

- `lib/lint-cues.mjs` — header constants (single source for numbers):
  `CAP_STAT_HIT = 3`, `SPACING_STAT_HIT = 90`, `CAP_FULLFRAME = 3`,
  `ZONE_START = 15`, `ZONE_END = 20`, `GAP_FULLFRAME_MAX = 180`,
  `GAP_FULLFRAME_MIN = 45`, `DENSITY_OVERLAY_WINDOW = 60`,
  `DENSITY_OVERLAY_MAX = 2`, `TARGET_TOTAL_MIN = 18`, `TARGET_TOTAL_MAX = 28`.
  Zones are enforced as ERRORS; density/cadence/count as WARNINGS
  (HANDOFF "030 resolve + lint"). `T` (video length, seconds) is computed
  from the last word's `end`.
- `lib/lint.test.mjs` — existing lint tests; run via `scripts/check.sh`.
- `steps/020-cue-pass-llm/RULEBOOK.md` + `cue-pass-prompt.md` — the paired
  judgment surface (edit BOTH together; `lib/check-rulebook.mjs` in check.sh
  guards drift between them). Contains the density prose and the
  "Choosing a card" routing section (plans 097/098 append routing lines
  there — merge, don't clobber).
- `EDITOR-STYLE-GUIDE.md` — human style guide; final section "When a moment
  earns a graphic (and when it doesn't)" states: default NO graphic, one
  full-screen graphic every 1–2 min, overlays at most one per minute, nothing
  in the first 15 or last 20 seconds.
- `videos/test-01/cues.json` — 18 cues over a 32:07 video, approved; must
  stay error-free under the new lint.
- Spec (owner-approved numbers): fullframe cadence 45–90s; overlay burst ≤3
  per rolling 60s; cold-open allowed in first 15s; end-card allowed in last
  20s; canvas routing rule verbatim in the spec's D1 section.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Flow gate | `bash pipelines/video/visuals-flow/scripts/check.sh` | exit 0, `visuals-flow check OK` |
| Lint tests only | `cd pipelines/video/visuals-flow && node --test lib/lint.test.mjs` | exit 0 |
| test-01 regression | `cd pipelines/video/visuals-flow && node lib/lint-cues.mjs test-01` | exit 0 (errors empty; warnings allowed) |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/lint-cues.mjs`
- `pipelines/video/visuals-flow/lib/lint.test.mjs`
- `pipelines/video/visuals-flow/steps/020-cue-pass-llm/RULEBOOK.md` and `cue-pass-prompt.md`
- `pipelines/video/visuals-flow/EDITOR-STYLE-GUIDE.md`

**Out of scope**:
- `lint-shots.mjs` / 070 surfaces (spec: shot budget untouched)
- Effects modules, cards, catalog
- `videos/test-01/cues.json` (regression fixture — never edit it to make lint pass)

## Git workflow

- Branch: `advisor/099-cadence-density-and-canvas-routing`
- Commit per step: `feat(visuals-flow): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: lint constants + rate-based totals + zone allowances

In `lib/lint-cues.mjs`:

1. Constant changes:

```js
const GAP_FULLFRAME_MAX = 90;      // was 180 — reference cadence band 45–90s
const DENSITY_OVERLAY_MAX = 3;     // was 2 — reference burst cap per 60s window
const TARGET_RATE_MIN = 0.55;      // cues per minute of VO (replaces TARGET_TOTAL_MIN)
const TARGET_RATE_MAX = 1.3;       // cues per minute of VO (replaces TARGET_TOTAL_MAX)
const ENDCARD_SLUG_PREFIXES = ['brand/', 'link-in-description/'];
```

Remove `TARGET_TOTAL_MIN` / `TARGET_TOTAL_MAX`; wherever the total-count
warning uses them, compute `const targetMin = Math.round(TARGET_RATE_MIN * T / 60); const targetMax = Math.round(TARGET_RATE_MAX * T / 60);`
and keep the warning text mentioning the computed band and the rate.
(Sanity: T=1927s → band 18–42, so test-01's 18 cues stays in-band.)

2. Zone rules: delete the `ZONE_START` error entirely (cold-open allowed).
   Keep the `ZONE_END` error but skip cues whose `card` starts with any
   `ENDCARD_SLUG_PREFIXES` entry. Remove the now-unused `ZONE_START` constant.

3. `GAP_FULLFRAME_MIN = 45` stays. `CAP_STAT_HIT`/`SPACING_STAT_HIT`/`CAP_FULLFRAME` stay.

**Verify**: `cd pipelines/video/visuals-flow && node lib/lint-cues.mjs test-01` -> exit 0, zero errors.

### Step 2: lint tests

Update/extend `lib/lint.test.mjs` (read the existing test fixtures first and
extend in their style):

- fullframe gap of 120s between fullframe cues → warning fired (was allowed at 180).
- 3 overlays inside 60s → NO density warning; 4 inside 60s → warning.
- cue at t=5s with a non-endcard card → NO zone error (cold-open allowed).
- cue in the last 20s with card `brand/...` or `link-in-description/...` → no error; with any other card → error.
- total-count warning: synthetic 10-min word set (T=600) with 3 cues → "below band" warning (band 6–13); same cue count on T=180 → in-band, no warning (proves rate scaling).
- Delete/adjust any existing test asserting the old ZONE_START error or TARGET_TOTAL numbers.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/lint.test.mjs` -> exit 0.

### Step 3: 020 pair — density numbers + canvas routing rule

Edit `cue-pass-prompt.md` AND `RULEBOOK.md` together (identical intent, each
file's own voice; `check-rulebook.mjs` must stay green):

1. Density prose: replace the old cadence/count guidance with: fullframe/canvas
   beat every 45–90s of VO; overlays up to 3 per minute during review/verdict
   stretches; cold-open beat allowed in the first 15s; end-card in the last 20s.
2. Add the mode/routing rule (spec D1 verbatim intent):
   "Narration makes a claim, lists items, or states numbers and the screen
   does not show it → fullframe canvas beat (`slate/headline-chips`,
   `comparison/table-rows`, section slates). The screen already shows what is
   spoken → no graphic."
3. Keep "when in doubt, skip" but scope it explicitly to demo/walkthrough
   stretches only.
4. Preserve any routing lines plans 097/098 added to these files (merge
   around them; if they haven't merged yet, this plan's text must not occupy
   their insertion point ambiguously — append, don't rewrite the whole
   section).

**Verify**: `bash pipelines/video/visuals-flow/scripts/check.sh` -> exit 0 (`check-rulebook.mjs` green).

### Step 4: EDITOR-STYLE-GUIDE rewrite

Rewrite the final section "When a moment earns a graphic (and when it
doesn't)" to match the spec: same earn-list, new rhythm sentence (one
fullframe beat every 45–90 seconds; overlays up to three per minute in
review stretches; cold-open and end-card allowances), keep "leave bare" for
demo stretches. Keep the section length within ±8 lines of the current one
(it's a human-read guide, not a spec dump).

**Verify**: `/usr/bin/grep -c "1 to 2 minutes" pipelines/video/visuals-flow/EDITOR-STYLE-GUIDE.md` -> `0`.

## Test plan

Lint unit tests over synthetic cue sets at two video lengths (rate scaling
proof) + the test-01 zero-errors regression + rulebook-sync gate.

## Done criteria

- [ ] `bash pipelines/video/visuals-flow/scripts/check.sh` exit 0
- [ ] `node lib/lint-cues.mjs test-01` exit 0 with zero errors
- [ ] New/updated lint tests per Step 2 all pass
- [ ] Prompt + RULEBOOK carry the density numbers AND the canvas routing rule; check-rulebook green
- [ ] Style guide has no per-video counts or old zone prohibitions left

## STOP conditions

- test-01 gains lint ERRORS under the new constants — stop and report which rule; never edit cues.json.
- check-rulebook.mjs fails after 2 sync attempts — stop with its output.
- Any temptation to change lint-shots.mjs or shot-pass files — out of scope by owner decision, stop.

## Maintenance notes

- These numbers are the 060 fold's new starting point (spec decision 2); the fold tunes constants + prose together from here.
- Spec: `docs/specs/2026-07-19-mode-structure-density-design.md` (D1). Evidence: `references/vPqSgj8Ta3Y.md` rule system.
