---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui: true
deploy:
needs: [land after 090 — same encode-loop surface in lib/assemble.mjs]
---

# Plan 091: Ken Burns drift on screen segments (step 090 assemble)

## Summary

- **Problem statement**: Reference-video screen recordings are never static — there is always a slow zoom drift. Our screen segments are locked off, which reads flat by comparison.
- **Goals**: every screen segment ≥4s gets a slow zoom drift (alternating in/out per screen segment, max 5%), implemented as a per-frame `crop` expression + `scale` in the segment encode; `--drift on|off`, default `on`.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — fully inlined; verifier inspects (render+inspect gate).
- **Done criteria** (terse): `check.sh` exit 0; integration proves first/last frames of a drifting screen segment differ in zoom while avatar/graphic segments are unchanged; `--drift off` regression.
- **Stop conditions** (terse): interaction with 090's caption overlays breaks (captions must NOT drift); changes outside in-scope files.
- **Test / verification for success**: unit test on the drift-VF builder + integration frame comparison; visual inspection.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat cd858ab..HEAD -- pipelines/video/visuals-flow/lib/assemble.mjs pipelines/video/visuals-flow/lib/assemble.test.mjs pipelines/video/visuals-flow/steps/090-assemble-run/README.md` — plans 089+090 changes WILL appear (they land first); anything else is drift.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 090 landed
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `cd858ab`, 2026-07-19

## Why this matters

Frame study of the owner's reference (youtu.be/7Ker2Vxs2yM, 2026-07-19) shows constant subtle motion on screen-recording stretches — a slow push-in or pull-out — which keeps long UI shots alive. We composite screen segments through ffmpeg already; a time-ramped center crop is nearly free and deterministic. Zoom is capped low (5%) because screen recordings carry small UI text that heavier zooms would soften.

## Current state (verified at cd858ab; re-verify against post-089/090 file, `pipelines/video/visuals-flow/`)

- `lib/assemble.mjs`: each segment builds `punchVF` starting from `VF = scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=…,fps=30,format=yuv420p`; avatar sub-segments append a static punch (`,scale=trunc(iw*${seg.punch}/2)*2:-2,crop=${w}:${h}`). Screen segments use plain `VF` today. After 090, caption overlays composite AFTER the base chain — drift must be applied to the BASE (before overlays) so captions stay put; that ordering already holds if drift is appended to `punchVF`.
- Screen segments may carry `startTrim`/`endTrim` (whip halves) — drift duration must use the ENCODED duration (`dur`), which the loop already computes.
- `crop` evaluates its `w`/`h`/`x`/`y` expressions per frame (`t` available); `scale` back to `${w}:${h}` yields the zoom. Same mechanism as 089's whip zoom ramp — verified working there.
- Flag/validation conventions: `--transitions`/`--beats`/`--captions` in `parseArgs`.

## Design (decided — do not re-litigate)

- Constants: `DRIFT_MAX = 0.05` (5% at full push), `DRIFT_MIN_SEG = 4` (seconds), `DRIFT_PERIOD = 30` (seconds to reach full push; shorter segments reach proportionally less).
- Exported pure helper (unit-testable):
  ```js
  // Ken Burns drift for one screen segment: slow center zoom, direction
  // alternating by screen ordinal (in, out, in, ...). Returns a filter
  // suffix string, or '' when the segment is too short.
  export function driftVF(screenOrdinal, dur, w, h, {
    max = DRIFT_MAX, minSeg = DRIFT_MIN_SEG, period = DRIFT_PERIOD } = {}) {
    if (dur < minSeg) return '';
    const depth = +(max * Math.min(dur / period, 1)).toFixed(4);
    const p = screenOrdinal % 2 === 0
      ? `${depth}*min(t/${dur.toFixed(3)},1)`          // push in
      : `${depth}*max(1-t/${dur.toFixed(3)},0)`;       // pull out
    return `,crop=w='iw-iw*${p}':h='ih-ih*${p}',scale=${w}:${h},setsar=1`;
  }
  ```
- Wiring: in the encode loop, for `seg.kind === 'screen'` and `drift === 'on'`, append `driftVF(screenOrdinal, dur, w, h)` to `punchVF` (screenOrdinal = count of screen segments seen so far). Applies in both the `-vf` and `-filter_complex` branches (it is part of the base chain either way). Graphic and avatar segments unchanged.
- `--drift on|off` default `on`, validated like `--captions`. `assembly.md` header notes drift when on.
- Whip interaction: a screen segment that ends in a whip already blurs/zooms in the trans-out half — drift's ≤5% ramp underneath is compatible (the reference does exactly this).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test gate (boss merge gate) | `bash scripts/check.sh` (from `pipelines/video/visuals-flow/`) | exit 0, `visuals-flow check OK` |
| Single file | `node --test lib/assemble.test.mjs` | all pass |
| Draft render (verifier only) | `bash steps/090-assemble-run/run.sh test-01 --draft` | final-draft.mp4 |

## Scope

**In scope**: `pipelines/video/visuals-flow/lib/assemble.mjs`, `lib/assemble.test.mjs`, `steps/090-assemble-run/README.md` (one sentence in the transitions/beats paragraph area).

**Out of scope**: avatar/graphic segments (punch-in already covers avatar motion), captions positioning (090's — must remain static), overlays, audio, all other modules.

## Git workflow

- Branch: `boss/091-assemble-ken-burns-drift`
- Commit per step, conventional messages, no AI footers. Do NOT push.

## Steps

### Step 1: driftVF + unit tests

Add constants + `driftVF` (exact code above). Unit tests: short segment → `''`; even ordinal contains `min(t/`, odd contains `max(1-t/`; depth scales with `dur/period` and caps at `max`.

**Verify**: `node --test lib/assemble.test.mjs` → all pass.

### Step 2: wire + flag + README + integration

Wire per Design; add `--drift`. Integration additions: for a ≥4s screen segment with drift on, extract first and last frames of that segment's window from the final output and assert they differ (reuse 090's frame-crop luma-diff technique on an edge region — a centered zoom changes edge content); with `--drift off`, assert the same two frames match the no-drift baseline behavior (segment count unchanged, probes unchanged).

**Verify**: `bash scripts/check.sh` → exit 0, `visuals-flow check OK`.

## Test plan

Step 1 unit tests + Step 2 integration comparisons, all offline lavfi.

## Done criteria

- [ ] `bash scripts/check.sh` exits 0.
- [ ] Integration: drift visible (edge-region frame diff) on a long screen segment; avatar/graphic frames unchanged; `--drift off` regression holds; duration/resolution/audio probes unchanged.
- [ ] `plans/README.md` row 091 updated to DONE.

## STOP conditions

- Captions visibly move with the zoom (ordering bug — drift applied after overlays): fix ordering once; if still moving, stop and report.
- Any probe regression after 5 fix attempts.

## Maintenance notes

- `DRIFT_MAX`/`DRIFT_PERIOD` are the taste knobs; if UI text softens on real recordings, drop `DRIFT_MAX` to 0.03.
- If a future corner-bubble plan lands, the bubble overlays AFTER the base chain like captions — same "don't drift the furniture" rule applies.
