---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 103: bubble rotating gradient ring (queued owner feedback)

## Summary

- **Problem statement**: The corner-bubble ring is a flat solid orange. Frame-zoom of the reference (`references/vPqSgj8Ta3Y.md` channel; HANDOFF item 1b, owner feedback 2026-07-19) shows a two-tone gradient ring whose bright arc rotates slowly around the circle.
- **Goals**: make the ring a two-tone conic gradient (base orange → warm highlight) whose bright arc rotates with a fixed period, phase-continuous across segments; everything stays inside `bubble.mjs` + its EFFECTS.md row.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — owner-specified.
- **Done criteria** (terse): check.sh green; chain-shape tests updated; two-frame pixel proof shows the bright arc at opposite sides for opposite phases.
- **Stop conditions** (terse): only `bubble.mjs`, its tests, EFFECTS.md, HANDOFF annotation; if ffmpeg's expression eval rejects the geq (syntax error in probe render), stop after 2 fix attempts.
- **Test / verification for success**: unit chain assertions + rendered-pixel arc-position proof.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 029d6e6..HEAD -- pipelines/video/visuals-flow/lib/effects/bubble.mjs pipelines/video/visuals-flow/lib/bubble.test.mjs pipelines/video/visuals-flow/EFFECTS.md pipelines/video/visuals-flow/HANDOFF.md`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (no-op until corner clips exist; ring is a tiny DxD sub-image)
- **Depends on**: none (plan 100 landed)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `029d6e6`, 2026-07-19

## Why this matters

The bubble is the host's only presence during ~60% of runtime once corner
footage exists; the reference's rotating ring is what makes it read "live"
instead of a static sticker. Owner queued this before the first real bubble
render so it ships right the first time.

## Current state

`lib/effects/bubble.mjs` (landed by plan 100, commit range up to `029d6e6`):

- `CONSTANTS = { BUBBLE_D_1080: 150, BUBBLE_INSET_1080: 40, RING_PX_1080: 3, RING_COLOR: '#FB923C', GLOW_SIGMA: 6 }`
- `bubbleGeometry(w, h)` returns `{ D, R, RING, INSET, rr, gg, bb, OX, OY, GLOW }` (ring color already split into `rr, gg, bb` ints via `hexToRgb`).
- In `contribute`'s chainFragment, the ring is built by exactly this line
  (the ONLY line this plan's filter change touches):

```js
chain += `color=c=0x00000000:s=${D}x${D},format=rgba,geq=r='${rr}':g='${gg}':b='${bb}':a='if(between(hypot(X-${R},Y-${R}),${R}-${RING}-1,${R}+1),255,0)',gblur=sigma=${GLOW}:steps=2[${ring}];`;
```

- geq re-evaluates per frame and exposes `T` (seconds since the filter
  source started = segment-local time); the ffmpeg expression evaluator
  provides `PI`, `cos`, `sin`, `hypot`, `max`, `pow`.
- Segment-local `T` restarts per segment; `contribute` receives `seg` and
  `ctx.startTrim`, so absolute-time phase continuity is available as
  `seg.start + (ctx.startTrim || 0)`.
- Tests: `lib/bubble.test.mjs` (chain-shape + four-point pixel proof from
  plan 100) — extend, don't rewrite.
- EFFECTS.md bubble row lists knobs; HANDOFF.md open item **1b** contains the
  queued-feedback paragraph this plan resolves.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Flow gate | `bash pipelines/video/visuals-flow/scripts/check.sh` | exit 0 |
| Bubble tests | `cd pipelines/video/visuals-flow && node --test lib/bubble.test.mjs` | exit 0 |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/effects/bubble.mjs`
- `pipelines/video/visuals-flow/lib/bubble.test.mjs`
- `pipelines/video/visuals-flow/EFFECTS.md` (bubble row: new knobs)
- `pipelines/video/visuals-flow/HANDOFF.md` (annotate item 1b's feedback paragraph with "(fixed by plan 103)")

**Out of scope**: every other effect module; assemble.mjs; bubble geometry, inset, glow, visibility rules, enter/exit behavior (all stay exactly as landed).

## Git workflow

- Branch: `advisor/103-bubble-rotating-ring`
- Commit per step: `feat(visuals-flow): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: rotating conic gradient ring

1. Add to CONSTANTS:

```js
RING_COLOR_HI: '#FFE3C2',   // bright-arc color (warm near-white)
RING_SPIN_PERIOD: 4,        // seconds per full revolution
RING_SPIN_SHARP: 2          // arc tightness; higher = narrower bright arc
```

2. In `bubbleGeometry`, also compute and return the highlight RGB:
   `const [hr, hg, hb] = hexToRgb(CONSTANTS.RING_COLOR_HI);` → add `hr, hg, hb`
   to the returned object.

3. In `contribute`, before the slice loop, compute the phase constant:

```js
const PHASE = +(seg.start + (ctx.startTrim || 0)).toFixed(3);
const P = CONSTANTS.RING_SPIN_PERIOD;
const K = CONSTANTS.RING_SPIN_SHARP;
```

4. Replace the ring line with a conic-gradient version. The gradient weight is
   the normalized dot product of the pixel's direction from center with a unit
   vector rotating at angle θ = 2π(T+PHASE)/P — no atan2 needed. Build the
   shared sub-expressions in JS to keep the geq strings readable:

```js
const th = `(2*PI*(T+${PHASE})/${P})`;
const wgt = `pow(0.5*(1+((X-${R})*cos(${th})+(Y-${R})*sin(${th}))/max(hypot(X-${R},Y-${R}),1)),${K})`;
const mix = (base, hi) => `'${base}+(${hi}-${base})*${wgt}'`;
chain += `color=c=0x00000000:s=${D}x${D},format=rgba,` +
  `geq=r=${mix(rr, hr)}:g=${mix(gg, hg)}:b=${mix(bb, hb)}:` +
  `a='if(between(hypot(X-${R},Y-${R}),${R}-${RING}-1,${R}+1),255,0)',` +
  `gblur=sigma=${GLOW}:steps=2[${ring}];`;
```

Nothing else in the chain changes (alpha annulus, glow, overlay order,
enable windows identical).

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/bubble.test.mjs` — existing chain tests will FAIL on the changed ring line at this point; that's expected, Step 2 updates them. Confirm the module still imports: `node --input-type=module -e "import('./lib/effects/bubble.mjs').then(m=>console.log(m.CONSTANTS.RING_SPIN_PERIOD))"` → `4`.

### Step 2: tests

In `lib/bubble.test.mjs`:

1. Update the existing chain-shape assertions to expect the new ring line:
   contains `cos(`, `sin(`, `pow(`, the phase term `T+<seg.start+startTrim>`,
   and BOTH color components (a base value from RING_COLOR and one from
   RING_COLOR_HI, e.g. `251` and `255` for red). The alpha annulus and
   `gblur=sigma=` assertions stay unchanged.
2. Phase-continuity case: two screen segments (seg.start 10 and 60, same
   fixture ctx) produce ring expressions with DIFFERENT phase constants
   (`T+10` vs `T+60`).
3. Arc-position pixel proof (all files inside the repo, delete after).
   Render two single frames of the ring-only chain against a black backdrop
   using lavfi (D=120, R=60, RING=4, GLOW=0 for crispness):
   - frame A: PHASE=0, evaluated at T=0 → θ=0 → bright arc at the RIGHT
     (+X direction).
   - frame B: PHASE = P/2 (2.0), T=0 → θ=π → bright arc at the LEFT.
   Command shape (one per frame; substitute the geq built exactly as Step 1
   with the given constants):

```
ffmpeg -y -f lavfi -i color=c=black:s=120x120:d=0.1 -f lavfi -i color=c=0x00000000:s=120x120:d=0.1 \
  -filter_complex "[1:v]format=rgba,geq=...[ring];[0:v][ring]overlay=0:0" -frames:v 1 ringA.png
```

   Assert with a small PIL check: brightness (r+g+b) at pixel (117, 60)
   [right-mid of the annulus] vs (3, 60) [left-mid]: frame A right > left by
   ≥ 60; frame B left > right by ≥ 60. Delete the PNGs.

**Verify**: `bash pipelines/video/visuals-flow/scripts/check.sh` → exit 0.

### Step 3: docs

1. `EFFECTS.md` bubble row: append the spin knobs
   (`RING_COLOR_HI`, `RING_SPIN_PERIOD`, `RING_SPIN_SHARP`) and one clause:
   "ring is a two-tone conic gradient whose bright arc rotates
   (period `RING_SPIN_PERIOD`s), phase-continuous across segments".
2. `HANDOFF.md` item 1b: append "(fixed by plan 103)" at the end of the
   queued-feedback sentence about the rotating ring. Touch nothing else in
   that file.

**Verify**: `/usr/bin/grep -c "RING_SPIN_PERIOD" pipelines/video/visuals-flow/EFFECTS.md` → ≥1; `/usr/bin/grep -c "fixed by plan 103" pipelines/video/visuals-flow/HANDOFF.md` → 1.

## Test plan

Chain-shape unit tests (gradient terms + per-segment phase), the two-frame
arc-position pixel proof (detects actual rotation direction/position on
pixels — a fixture that CAN detect the effect, per the folded verifier
lesson), full check.sh.

## Done criteria

- [ ] check.sh exit 0
- [ ] Chain tests assert gradient + phase terms; phase differs per segment fixture
- [ ] Pixel proof: bright arc right for PHASE=0, left for PHASE=P/2 (≥60 brightness delta), scratch PNGs deleted
- [ ] EFFECTS.md knobs documented; HANDOFF 1b annotated
- [ ] No changes outside the four in-scope files

## STOP conditions

- ffmpeg errors on the geq expression (probe with the Step 2 lavfi render before wiring tests) and 2 fix attempts don't clear it — stop with the exact ffmpeg stderr.
- Any temptation to alter bubble geometry, visibility rules, or other modules — out of scope, stop.

## Maintenance notes

- Owner look-tuning happens on `RING_SPIN_PERIOD` (slower = calmer) and `RING_SPIN_SHARP` (narrower arc) — EFFECTS.md row + CONSTANTS edited together (rule surface 7).
- First real look-check happens when video #2's HeyGen run produces corner clips (HANDOFF 1b).
