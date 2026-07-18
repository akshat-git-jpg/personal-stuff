---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui: true
deploy:
needs: [land before 090/091 — all three rewrite the runAssembly encode loop]
---

# Plan 089: Whip v2 (blur-cut) + Flash v2 (luminous sweep) — rework both 090-step effects

## Summary

- **Problem statement**: The landed whip (xfade slide + tmix) and flash (solid 85% orange slab) read as cheap. Frame-by-frame study of the owner's reference video (2026-07-19) shows the real grammar: the whip is a ~6-frame **blur-cut** (directional blur ramps up on the outgoing shot, hard cut, blur decays on the incoming shot — nothing slides), and the flash is a **luminous screen-blend gradient** that peaks near-white with the cut hidden under the peak, followed by a fading residue band.
- **Goals**:
  - Whip v2: TRANSITION_DUR 0.4→0.2; replace the xfade+tmix transition segment with two 0.1s half-segments — blur-ramp-out from source A, blur-decay-in from source B — using timeline-gated `gblur` + a per-frame crop zoom ramp.
  - Flash v2: replace the solid overlay with chained screen-mode `blend` steps of a diagonal orange→white gradient (3-frame ramp to near-white on the outgoing tail, 3-frame full-frame decay + 3-frame band residue on the incoming head). Punch-in alternation stays.
  - Content-timed beats: `planAvatarBeats` prefers snapping a beat to an overlay-cue start within the window before falling back to a sentence gap.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — fully inlined; verifier renders test-01 `--draft` and inspects (render+inspect gate).
- **Done criteria** (terse): `check.sh` exit 0; no `xfade`/`tmix` left in assemble.mjs; trans half-segments probe to 0.1s each; total duration unchanged; `--transitions none` / `--beats off` regressions hold.
- **Stop conditions** (terse): `gblur`/`blend`/`gradients` missing from `ffmpeg -filters` (verified present 2026-07-19); changes needed outside the two in-scope files.
- **Test / verification for success**: updated unit + integration tests in `lib/assemble.test.mjs`; visual inspection by verifier.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat cd858ab..HEAD -- pipelines/video/visuals-flow/lib/assemble.mjs pipelines/video/visuals-flow/lib/assemble.test.mjs`

## Status

- **Priority**: P1 (owner: current effects "look very bad")
- **Effort**: M
- **Risk**: MED
- **Depends on**: 084/085/088 (landed)
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `cd858ab`, 2026-07-19

## Why this matters

The owner compared test-01's draft against the reference (youtu.be/7Ker2Vxs2yM) and rejected both effects. Frame-exact analysis at 30fps found the mechanisms differ structurally, not by tuning: (1) reference whip ≈ 6 frames total, blur-intensity ramp with a hard cut in the middle, no translation — ours is a 12-frame rigid slide with tmix ghosting (reads as double-exposure stutter); (2) reference flash is additive light (screen blend — image glows through, highlights blow to white) with a directional gradient and a residue band — ours is opaque paint. All fixes are in `lib/assemble.mjs`'s constants and filter graphs; segment architecture, gates, and audio are untouched.

## Current state (excerpts verified at cd858ab, `pipelines/video/visuals-flow/`)

`lib/assemble.mjs` (543 lines):
- Constants (lines 75–78): `BEAT_INTERVAL = 20, BEAT_MIN_EDGE = 8, BEAT_SNAP_WINDOW = 3, BEAT_MIN_GAP = 0.25;` / `FLASH_DUR = 0.24, FLASH_COLOR = '0xfb923c', FLASH_ALPHA = 0.85, PUNCH_SCALE = 1.08;` / `TRANSITION_DUR = 0.4;`
- `planTransitions(segments, overlays, {duration})` (line 84) — emits `{at, direction, fromIdx, toIdx}`; skip rules (short neighbor, overlay straddle). KEEP AS-IS except the default duration change.
- `planAvatarBeats(seg, words, {...})` (line 102) — sentence-gap snapping. Gains the `cueTimes` preference (Step 3).
- Flash encode (lines 339–348): two `color=c=${FLASH_COLOR}@${FLASH_ALPHA}...fade...alpha=1` overlays (`f_in` on `flashIn` heads, `f_out` on `flashOut` tails). REPLACED by Step 2.
- Transition encode (lines 371–406): builds `sliceA`/`sliceB` (screen slices seek `[b−half, b]`/`[b, b+half]` with `screenOffset`; avatar slices seek clip-local), then:
  ```js
  const chainTrans =
    `[0:v]${VF},tpad=stop_mode=clone:stop_duration=1[a];` +
    `[1:v]${VF},tpad=start_mode=clone:start_duration=${half}[b];` +
    `[a][b]xfade=transition=slide${tOut.direction}:duration=${TRANSITION_DUR}:offset=0[x];` +
    `[x]tmix=frames=3[v]`;
  ```
  REPLACED by Step 1. The neighbor-trim logic (lines 287–294: `startTrim`/`endTrim` = `half`) is correct and stays — `half` becomes 0.1.
- `assemble.test.mjs` — planner unit tests + lavfi integration tests; the integration currently asserts trans `.ts` duration 0.4±0.05 (update to two files × 0.1s).
- ffmpeg 8.1.1 (`/opt/homebrew/bin/ffmpeg`): `gblur` and `blend` have timeline support (`TS` flags), `gradients` source exists — verified 2026-07-19. NO drawtext/libass (irrelevant here).

## Design (decided — do not re-litigate)

New constants block (replaces FLASH_DUR/FLASH_ALPHA; keep FLASH_COLOR, PUNCH_SCALE, beat constants):

```js
export const TRANSITION_DUR = 0.2;             // 6 frames total @30fps
export const WHIP_SIGMAS = [10, 24];           // cumulative gblur stages per half
export const WHIP_ZOOM = 0.12;                 // crop fraction at peak (≈1.09x)
export const FLASH_COLOR = '0xfb923c';
export const FLASH_OUT_OPACITIES = [0.45, 0.75, 1.0];  // 3-frame ramp on outgoing tail
export const FLASH_IN_OPACITIES  = [0.8, 0.5, 0.25];   // 3-frame full-frame decay
export const FLASH_BAND_OPACITIES = [0.35, 0.2, 0.1];  // 3-frame residue band after
export const PUNCH_SCALE = 1.08;
```

**Whip v2** — per transition at boundary `b`, emit TWO consecutive `.ts` files (same `ENC`, `-f mpegts`), replacing the single xfade file; `half = 0.1`:

- `trans-out` (source = existing `sliceA` slice `[b−0.1, b]`), `-t 0.1`:
  ```
  [0:v]${VF},tpad=stop_mode=clone:stop_duration=1,
  gblur=sigma=10:sigmaV=1:enable='gte(t,0.032)',
  gblur=sigma=24:sigmaV=1:enable='gte(t,0.065)',
  crop=w='iw-iw*${WHIP_ZOOM}*min(t/0.1,1)':h='ih-ih*${WHIP_ZOOM}*min(t/0.1,1)',
  scale=${w}:${h},setsar=1[v]
  ```
  (frame 0 sharp → frame 1 blurred → frame 2 heavily blurred + zoomed ~9%.)
- `trans-in` (source = existing `sliceB` slice `[b, b+0.1]`), `-t 0.1` — mirrored:
  ```
  [0:v]${VF},tpad=stop_mode=clone:stop_duration=1,
  gblur=sigma=24:sigmaV=1:enable='lt(t,0.035)',
  gblur=sigma=10:sigmaV=1:enable='lt(t,0.068)',
  crop=w='iw-iw*${WHIP_ZOOM}*max(1-t/0.1,0)':h='ih-ih*${WHIP_ZOOM}*max(1-t/0.1,0)',
  scale=${w}:${h},setsar=1[v]
  ```
- Concat order: A-segment, trans-out, trans-in, B-segment. `direction` no longer affects rendering (blur is symmetric) — keep the field for the EDL table.

**Flash v2** — inside the sub-segment encode chain (replacing the `f_in`/`f_out` color overlays). Gradient source, split per use:

```
gradients=s=${w}x${h}:c0=${FLASH_COLOR}:c1=0xffffff:x0=0:y0=${h}:x1=${w}:y1=0:speed=0.00001[g];
[g]split=3[g1][g2][g3];
```

- `flashOut` tail (last 3 frames, `dur` = sub-segment encoded duration): chain three screen blends, each gated to switch on one frame earlier stays on through the tail:
  ```
  [base][g1]blend=all_mode=screen:all_opacity=0.45:enable='gte(t,${dur-0.100})'[x1];
  [x1][g2]blend=all_mode=screen:all_opacity=0.75:enable='gte(t,${dur-0.066})'[x2];
  [x2][g3]blend=all_mode=screen:all_opacity=1.0:enable='gte(t,${dur-0.033})'[x3]
  ```
  (cumulative screen blends → near-white peak on the final frame; the concat cut lands under the peak.)
- `flashIn` head (first 6 frames): three full-frame decays then three band decays. Band = the gradient cropped to a horizontal stripe and re-padded so blend sizes match:
  ```
  [g4..g6] = 3 more splits of [g];
  [gb]crop=${w}:${Math.round(h*0.34)}:0:${Math.round(h*0.33)},pad=${w}:${h}:0:${Math.round(h*0.33)}:black@0.0? 
  ```
  NOTE: `pad` cannot produce transparent fill for `blend`; instead build the band by zeroing the rest via `drawbox`-free math: use `crop` + `overlay` is also unavailable for screen mode. DECIDED implementation: for the band frames reuse full-frame blends at the low `FLASH_BAND_OPACITIES` — visually equivalent at ≤0.35 opacity and keeps the graph simple:
  ```
  [base][g4]blend=all_mode=screen:all_opacity=0.8:enable='lt(t,0.033)'[y1];
  [y1][g5]blend=all_mode=screen:all_opacity=0.5:enable='between(t,0.033,0.066)'[y2];
  [y2][g6]blend=all_mode=screen:all_opacity=0.25:enable='between(t,0.066,0.100)'[y3];
  [y3][g7]blend=all_mode=screen:all_opacity=0.35:enable='between(t,0.100,0.133)'[y4];
  [y4][g8]blend=all_mode=screen:all_opacity=0.2:enable='between(t,0.133,0.166)'[y5];
  [y5][g9]blend=all_mode=screen:all_opacity=0.1:enable='between(t,0.166,0.200)'[y6]
  ```
  (split [g] into as many copies as consumed; opacities from the constants arrays — build this chain in a loop, not by hand.)
- Blend requires same-size, same-format inputs: keep `format=yuv420p` from `VF` on the base and add `format=yuv420p` after `gradients`/`split`.

**Content-timed beats** — `planAvatarBeats(seg, words, { ..., cueTimes = [] })`: for each interval target, FIRST look for a `cueTimes` entry within `±window` inside `[lo, hi]` and snap to it; only when none exists fall back to the sentence-gap search. `runAssembly` passes `cueTimes = resolved.filter(c => c.placement === 'overlay').map(c => c.start)` through `splitAvatarSegments` (thread the option through its signature).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test gate (boss merge gate) | `bash scripts/check.sh` (from `pipelines/video/visuals-flow/`) | exit 0, `visuals-flow check OK` |
| Filters present | `ffmpeg -hide_banner -filters \| grep -cE "gblur\|gradients\|^ TS blend"` | ≥3 lines matched (non-zero) |
| Single file | `node --test lib/assemble.test.mjs` | all pass |
| Draft render (verifier only) | `bash steps/090-assemble-run/run.sh test-01 --draft` | final-draft.mp4 |

## Scope

**In scope**: `pipelines/video/visuals-flow/lib/assemble.mjs`, `pipelines/video/visuals-flow/lib/assemble.test.mjs`.

**Out of scope**: `planSegments`/`planSegmentOverlays`/`planTransitions` skip rules (only `TRANSITION_DUR` default changes), the audio mux (still VISUAL ONLY — no SFX), all other lib modules, step READMEs (numbers unchanged from the reader's perspective), `videos/test-01/**`.

## Git workflow

- Branch: `boss/089-assemble-whip-flash-v2`
- Commit per step, conventional messages, no AI footers. Do NOT push.

## Steps

### Step 1: whip v2

Change `TRANSITION_DUR` to 0.2, add `WHIP_SIGMAS`/`WHIP_ZOOM`, and replace the transition-encode block (current lines 371–406) with the two half-segment encodes per Design. Update integration assertions: TWO `trans` `.ts` files per boundary, each ffprobe duration 0.1 ± 0.04; total output duration unchanged.

**Verify**: `node --test lib/assemble.test.mjs` → all pass; no `xfade`/`tmix` remains: `grep -cE "xfade|tmix" lib/assemble.mjs` → 0.

### Step 2: flash v2

Replace the constants and the `flashIn`/`flashOut` chain segments per Design (loop-built from the opacity arrays). Remove `FLASH_DUR`/`FLASH_ALPHA`. Integration: extend the beats fixture assertions — sub-segment durations unchanged, final probes unchanged.

**Verify**: `node --test lib/assemble.test.mjs` → all pass; `grep -c "all_mode=screen" lib/assemble.mjs` → ≥1.

### Step 3: content-timed beats

Add `cueTimes` preference to `planAvatarBeats` + thread through `splitAvatarSegments`/`runAssembly`. Unit tests: (a) a cue at target+1s wins over a gap at target+0.5s… no — DECIDED: cue wins whenever one is in-window regardless of distance (test exactly that); (b) no in-window cue → gap fallback unchanged; (c) cue outside `[lo,hi]` ignored.

**Verify**: `bash scripts/check.sh` → exit 0, `visuals-flow check OK`.

## Test plan

Updated planner unit tests + integration probes per steps; all in `lib/assemble.test.mjs` following its existing lavfi conventions.

## Done criteria

- [ ] `bash scripts/check.sh` exits 0.
- [ ] `grep -cE "xfade|tmix" lib/assemble.mjs` → 0.
- [ ] Integration: 2 trans files per boundary at 0.1s ± 0.04 each; duration/resolution/audio probes unchanged; `--transitions none` and `--beats off` regressions still pass.
- [ ] `plans/README.md` row 089 updated to DONE.

## STOP conditions

- `gblur`, `blend` (timeline), or `gradients` absent from this machine's ffmpeg — stop and report `ffmpeg -version`.
- The chained-blend graph fails on `videotoolbox` encodes but passes on x264 (pixel-format mismatch) — try adding `format=yuv420p` before the encoder once; if still failing, stop and report.
- Anything needing edits outside the two in-scope files.

## Maintenance notes

- Verifier MUST scrub the draft at a whip (e.g. ~0:57) and a flash (inside s01/s02) and compare against the reference grammar described in "Why this matters" — agy never self-certifies visuals.
- All look-tuning lives in the constants block (sigmas, zoom, opacity arrays, colors); taste iterations after the owner watches are constants-only.
- If the owner later wants the whip to lean directionally, add a small time-ramped horizontal `crop` x-offset in the half-segment chains — the `direction` field is already plumbed.
