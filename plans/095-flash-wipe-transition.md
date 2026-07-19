---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 095: flash-wipe transition — light-leak wipe on cuts INTO graphics

## Summary

- **Problem statement**: The assembly has one transition look (whip blur-cut) and it only fires on screen↔avatar boundaries. The owner's reference channel (Youri van Hofwegen — see `pipelines/video/visuals-flow/references/vPqSgj8Ta3Y.md`) hides every cut INTO new content under a ~0.3s light-leak flash wipe; cuts into fullframe graphics in our videos are currently bare hard cuts.
- **Goals**:
  - Add a `flash` style to the whip effect module: a brightness-bloom wipe in our brand orange (not the reference's green).
  - Auto-plan flash instances at `screen>graphic` and `avatar>graphic` boundaries; `graphic>*` stays a hard cut (matches the reference grammar: wipe in, hard-cut out).
  - Keep existing screen↔avatar whips exactly as they are (`style: "blur"`, default).
- **Executor proposed**: agy (Gemini 3.1 Pro High) — standard, fully inlined.
- **Done criteria** (terse): check.sh green; new whip tests pass; test-01 effects.json regenerates with `flash` instances at graphic boundaries; extracted boundary frames show the brightness ramp.
- **Stop conditions** (terse): don't touch render.mjs or the card library; stop if test-01 fixtures can't regenerate.
- **Test / verification for success**: unit tests on `plan()` pair routing + an ffmpeg frame-extraction check asserting mean luma rises at the wipe peak.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a249173..HEAD -- pipelines/video/visuals-flow/lib/effects/whip.mjs pipelines/video/visuals-flow/lib/assemble.mjs pipelines/video/visuals-flow/lib/effects-plan.mjs pipelines/video/visuals-flow/EFFECTS.md`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `a249173`, 2026-07-19

## Why this matters

Frame analysis of 3 reference videos (references/*.md, committed) shows the
single highest-leverage effect we lack: a directional light-leak flash that
covers cuts into new content. It is the reference channel's signature and fires
every 15–40s. Recolored to our brand orange it gives our assembled videos the
same "expensive edit" energy without touching cards or cues.

## Current state

- `lib/effects/whip.mjs` — the transition module. `plan(ctx)` walks
  `ctx.segments` pairs and emits instances only for `screen>avatar` /
  `avatar>screen`; `boundarySegments(instance, ctx)` returns two 0.1s
  `extraSegments` (out-slice of A, in-slice of B) with gblur+crop filter
  chains. `CONSTANTS = { TRANSITION_DUR: 0.2, WHIP_SIGMAS: [10, 24], WHIP_ZOOM: 0.12 }`.
- `lib/assemble.mjs` — segment kinds are `screen` / `avatar` / `graphic`
  (graphic src resolved at line ~418 via
  `resolved.find(c => c.id === seg.id)` + `path.join(renderDir, planRender(cue).outFile)`).
  Whip instances are matched to boundaries at lines ~398-402 (`tOut`/`tIn`
  trim half the transition from each side), and `whipMod.boundarySegments` is
  called at line ~525 with `{ ...ctx, screenOffset, ENC }`. `ctx` (line ~315)
  already carries `resolved`; it does NOT carry `renderDir`/`planRender`.
- `lib/effects-plan.mjs` — regenerates `videos/<slug>/effects.json` from the
  modules' `plan()` hooks, preserving manual overrides by id.
- `lib/assemble.test.mjs`, `lib/reference-moments.test.mjs` — exemplar test
  style (node:test, fixtures in-file). Run via `scripts/check.sh`.
- `EFFECTS.md` — the effects rulebook; every module has a row (what fires
  when, skip rules, knobs). Edit it together with module CONSTANTS.
- Reference mechanism being cloned (from `references/vPqSgj8Ta3Y.md`): bloom
  blob sweeps in ~5 frames, cut under peak, sweeps out ~3 frames; the
  Jan-2026 video used a full white-out variant — intensity is a knob.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Flow gate | `bash pipelines/video/visuals-flow/scripts/check.sh` | exit 0, `visuals-flow check OK` |
| Regenerate effects manifest | `cd pipelines/video/visuals-flow && node lib/effects-plan.mjs test-01` | exit 0, writes `videos/test-01/effects.json` |
| Draft assemble (optional, slow ~5min) | `cd pipelines/video/visuals-flow && bash steps/090-assemble-run/run.sh test-01 --draft` | exit 0, `final-draft.mp4` in kb-scratch |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/effects/whip.mjs`
- `pipelines/video/visuals-flow/lib/assemble.mjs` (boundary ctx + graphic slice support only)
- `pipelines/video/visuals-flow/lib/whip.test.mjs` (new)
- `pipelines/video/visuals-flow/scripts/check.sh` (add the new test file to the node --test list)
- `pipelines/video/visuals-flow/EFFECTS.md` (flash row)
- `pipelines/video/visuals-flow/videos/test-01/effects.json` (regenerated)

**Out of scope**:
- `render.mjs`, card-library, cue/shot rulebooks — the wipe is assembly-only.
- The corner avatar bubble and canvas styles (owner brainstorm pending).
- Changing the existing blur-whip look or its screen↔avatar routing.

## Git workflow

- Branch: `advisor/095-flash-wipe-transition`
- Commit per step: `feat(visuals-flow): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: add the style knob and graphic pairs to whip.plan

In `lib/effects/whip.mjs`:

1. Extend CONSTANTS:

```js
export const CONSTANTS = {
  TRANSITION_DUR: 0.2,
  WHIP_SIGMAS: [10, 24],
  WHIP_ZOOM: 0.12,
  FLASH_COLOR: { r: 1.25, g: 1.08, b: 0.85 },  // warm orange push at peak
  FLASH_GAIN: 0.85                              // peak added brightness 0..1
};
```

2. In `plan(ctx)`, replace the pair filter with:

```js
const pair = `${a.kind}>${b.kind}`;
const isWhip = pair === 'screen>avatar' || pair === 'avatar>screen';
const isFlash = pair === 'screen>graphic' || pair === 'avatar>graphic';
if (!isWhip && !isFlash) continue;
```

and add `style: isFlash ? 'flash' : 'blur'` to the emitted instance object.
Keep the existing min-length (1.0s) and overlay-collision guards for both
styles. Keep `type: 'whip'` and the `whip-<at>` id scheme so effect flags,
CLI (`--transitions`), and effects.json overrides keep working unchanged.

**Verify**: `cd pipelines/video/visuals-flow && node -e "const w=require('./lib/effects/whip.mjs')" 2>/dev/null || node --input-type=module -e "import('./lib/effects/whip.mjs').then(w=>{const out=w.plan({segments:[{kind:'screen',id:'s1',start:0,end:10},{kind:'graphic',id:'g1',start:10,end:16},{kind:'screen',id:'s2',start:16,end:30}],overlays:[]});console.log(JSON.stringify(out))})"` -> exactly one instance, `"style":"flash"`, `"at":10` (no instance at 16 — graphic>screen is a hard cut).

### Step 2: flash filter chains + graphic slices in boundarySegments

In `boundarySegments(instance, ctx)`:

1. Graphic slice support. After the existing screen/avatar branches for
   `sliceA`/`sliceB`, add a `graphic` branch (needed only on the B side given
   Step 1's pairs, but write both sides symmetrically for future styles):

```js
} else { // kind === 'graphic'
  const cue = ctx.resolved.find(c => c.id === toSeg.id);
  const gFile = ctx.graphicFile(cue);
  const sourceStart = Math.max(0, b - toSeg.start);
  sliceB = ['-ss', String(sourceStart), '-to', String(sourceStart + half), '-i', gFile];
}
```

2. Style dispatch: when `instance.style === 'flash'`, use these chains instead
   of the gblur/crop pair (t runs 0→0.1 inside each half; A ramps up to the
   peak, B ramps down from it):

```js
const { FLASH_GAIN: G, FLASH_COLOR: C } = CONSTANTS;
const up = `min(t/0.1,1)`, down = `max(1-t/0.1,0)`;
const chainOutFlash =
  `[0:v]${VF},tpad=stop_mode=clone:stop_duration=1,` +
  `gblur=sigma='40*${up}':sigmaV='12*${up}',` +
  `colorchannelmixer=rr=${C.r}:gg=${C.g}:bb=${C.b}:enable='gte(t,0.03)',` +
  `eq=brightness='${G}*${up}',scale=${w}:${h},setsar=1[v]`;
const chainInFlash =
  `[0:v]${VF},tpad=stop_mode=clone:stop_duration=1,` +
  `gblur=sigma='40*${down}':sigmaV='12*${down}',` +
  `colorchannelmixer=rr=${C.r}:gg=${C.g}:bb=${C.b}:enable='lt(t,0.07)',` +
  `eq=brightness='${G}*${down}',scale=${w}:${h},setsar=1[v]`;
```

IMPORTANT (folded lesson, TESTS.md 2026-07-19): brightness/color math must
happen in RGB-safe filters exactly as written above — do NOT substitute a
yuv-space blend (that caused the pink-flash bug in plan 087).

3. In `lib/assemble.mjs`: extend the `boundarySegments` call ctx (line ~525)
   with a `graphicFile` resolver closure:

```js
const bSegsRes = whipMod.boundarySegments(tOut, {
  ...ctx, screenOffset, ENC,
  graphicFile: (cue) => path.join(renderDir, planRender(cue).outFile)
});
```

Also confirm `tOut`/`tIn` matching (lines ~398-402) needs no change — flash
instances share `type: 'whip'` so the existing `whipInstances` filter picks
them up and the half-transition trims apply to graphic segments too.

**Verify**: `bash pipelines/video/visuals-flow/scripts/check.sh` -> exit 0 (existing suite still green).

### Step 3: unit tests for routing + chain shape

Create `lib/whip.test.mjs` (node:test, same style as `lib/reference-moments.test.mjs`) covering:

1. `plan()` emits `style:'blur'` for screen↔avatar, `style:'flash'` for
   `*>graphic`, nothing for `graphic>*` (fixture from Step 1's verify).
2. `plan()` still skips boundaries with an overlapping overlay and <1s segments.
3. `boundarySegments()` with a flash instance and a stub ctx
   (`resolved:[{id:'g1'}]`, `graphicFile:()=>'/tmp/g1.mp4'`, screen source)
   returns 2 extraSegments whose chains contain `eq=brightness=` and
   `colorchannelmixer` and do NOT contain `crop=` (fixture must be able to
   detect the effect — folded lesson: a chain-shape assertion beats "render
   succeeded").

Add the file to the `node --test` list in `scripts/check.sh` (single line,
keep the existing single-command form; never use a directory arg — node 22
rejects it, LESSONS.md 2026-07-09).

**Verify**: `bash pipelines/video/visuals-flow/scripts/check.sh` -> exit 0, new tests listed as passing.

### Step 4: rendered-pixel proof + manifest + docs

1. Synthetic render proof (writes INSIDE the repo tmp only): generate a 2s
   red clip and a 2s blue clip with ffmpeg `color=` sources, run one
   `chainOutFlash` extraSegment encode by hand (copy the ffmpeg args the way
   assemble builds them), then
   `ffprobe -f lavfi -i "movie=<out.ts>,signalstats" -show_entries frame_tags=lavfi.signalstats.YAVG`:
   the LAST frame's YAVG must exceed the FIRST frame's by ≥ 60 (brightness
   ramp actually present in pixels). Delete the scratch files afterwards.
2. `cd pipelines/video/visuals-flow && node lib/effects-plan.mjs test-01` —
   regenerate; confirm new `whip-*` instances with `"style":"flash"` appear at
   each fullframe-graphic boundary and all pre-existing manual fields survived.
3. `EFFECTS.md`: add the flash row under the whip module: fires on
   `screen>graphic` / `avatar>graphic`, skip rules (same as blur), knobs
   (`FLASH_GAIN`, `FLASH_COLOR`, per-instance `style`), reference provenance
   (`references/vPqSgj8Ta3Y.md` moment 1:27.2).

**Verify**: `cd pipelines/video/visuals-flow && node -e "const m=require('./videos/test-01/effects.json');console.log(m.instances.filter(i=>i.style==='flash').length)"` -> a number ≥ 1 (test-01 has fullframe cues) — use `--input-type=module` + fs.readFileSync if require of json fails.

## Test plan

Unit: routing pairs, guard preservation, chain shape (Step 3). Pixel: YAVG
ramp on a synthetic encode (Step 4). Integration: check.sh; effects.json
regeneration on test-01. The full draft assemble is OPTIONAL (slow); the boss
verify pass may run it and extract 3 frames around one flash boundary
(`ffmpeg -ss <t-0.1> -t 0.3 -i final-draft.mp4 frames-%02d.png`) and LOOK at
them — inspection must extract frames, never trust exit codes (TESTS.md
folded lesson).

## Done criteria

- [ ] `bash pipelines/video/visuals-flow/scripts/check.sh` exit 0 with `lib/whip.test.mjs` included and passing
- [ ] `plan()` fixture: flash at `*>graphic` only; blur routing unchanged
- [ ] Synthetic encode YAVG(last) − YAVG(first) ≥ 60
- [ ] `videos/test-01/effects.json` regenerated, contains `"style":"flash"` instances, manual overrides preserved
- [ ] `EFFECTS.md` flash row present (knobs + provenance)

## STOP conditions

- `node lib/effects-plan.mjs test-01` errors or drops existing manual overrides — stop, report the diff.
- Any need to modify `render.mjs`, card HTML, or cue/shot prompts to make this work — the design is wrong, stop.
- The pixel proof requires writing outside the repo (permission dialogs kill agy runs — LESSONS.md 2026-07-06): keep every scratch file inside `pipelines/video/visuals-flow/` and delete it; if impossible, stop.

## Maintenance notes

- Owner look-feedback lands in `EFFECTS.md` + `CONSTANTS` together (rule surface 7).
- If a future plan generalizes `boundarySegments` to multiple modules, the hard-wired `whipMod` call at assemble ~525 is the seam.
- Reference evidence: `references/vPqSgj8Ta3Y.md` (green wipe), `references/-vwHldNaGPI.md` (white-out variant → FLASH_GAIN is the intensity knob).
