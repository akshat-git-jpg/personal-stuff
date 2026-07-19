---
executor: claude-p
model: opus
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 100: corner avatar bubble (spec D2)

## Summary

- **Problem statement**: The 070 design assumes a corner avatar is on screen for the whole video, and the render side already produces contiguous corner chunks — but assembly never composites them, so shipped videos have no host presence outside full-screen spans. Owner approved un-deferring with the reference look (spec D2, `docs/specs/2026-07-19-mode-structure-density-design.md`).
- **Goals**: a new `bubble` effect module that composites the corner-chunk clips as a circular bubble (brand-orange ring, top-right) over screen segments only; hidden on avatar-full and graphic segments; silent; per-instance controllable via effects.json.
- **Executor proposed**: claude-p / opus (encode-path change with taste-judged output — HANDOFF model-routing rider: visual output rendered and inspected).
- **Done criteria** (terse): check.sh green incl. new bubble tests; frame extraction from a synthetic assembly shows the masked circle + ring at the right position; screen-only visibility proven.
- **Stop conditions** (terse): no corner files → module contributes nothing (never fails the assembly); mask must be alpha-clean.
- **Test / verification for success**: unit tests on chunk slicing/visibility + synthetic-clip pixel checks + extracted-frame inspection.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b406fe9..HEAD -- pipelines/video/visuals-flow/lib/effects pipelines/video/visuals-flow/lib/assemble.mjs pipelines/video/visuals-flow/EFFECTS.md pipelines/video/visuals-flow/steps/080-avatar-render-run`

## Status

- **Priority**: P1
- **Effort**: M-L
- **Risk**: MED-HIGH (encode path)
- **Depends on**: none (independent of 099; merges with 095's whip edits in different functions)
- **Category**: feature
- **Difficulty**: tricky (ffmpeg alpha compositing + per-segment source slicing)
- **Planned at**: commit `b406fe9`, 2026-07-19

## Why this matters

The reference channel affords ~70% non-talking-head runtime because the host
persists as a corner bubble — presence without surrendering the screen. Our
own shot-pass rulebook already declares this the baseline ("a human is always
on screen"); this plan makes assembly deliver it.

## Current state

- `lib/avatar-render.mjs` — `planCornerChunks(totalDuration)` emits contiguous
  jobs `{ id: 'corner-NN', start, end, kind: 'corner' }` covering the whole
  VO; `--spans-only` (the pilot default) skips them. `avatar-jobs.json` rows
  carry `kind` and, after download, `file` (absolute path in kb-scratch).
- `lib/effects/captions.mjs` — the exemplar module shape for this plan:
  `plan(ctx)` returns one instance; `contribute(seg, instances, ctx)` returns
  `{ inputs, chainFragments }` where each chainFragment is
  `(lastV, state) => ({ chain, nextV })` with `state.inputOffset` for input
  indexing; assemble merges fragments per segment (assemble.mjs ~line 429-450).
- `lib/effects/registry.mjs` — `EFFECT_MODULES = [whip, beats, captions, drift]`;
  order matters only for chain stacking (bubble should stack AFTER captions so
  the bubble draws over captions if they ever collide — append last).
- `lib/assemble.mjs` — `contribCtx = { ...ctx, dur, startTrim, endTrim, capDir, capChunks }`
  (line ~424); `ctx` carries `segments, overlays, words, resolved, avatarJobs, total, w, h, VF, screen`.
  `avatarJobs` today is loaded from avatar-jobs.json — CONFIRM whether it
  filters to span jobs; if it filters, add a separate `cornerJobs` array to ctx.
- `effects.json` flags: `effectFlags` map (assemble ~line 302) keys by
  instance type — add `bubble: bubble === 'on'` wired to a `--bubble on|off`
  CLI flag defaulting ON when corner files exist.
- Look (owner-approved): circle diameter `Math.round(h * 150/1080)`, top-right
  inset `Math.round(h * 40/1080)`, ring 3px `#FB923C` + soft glow. Visible on
  `kind === 'screen'` segments ONLY.
- Step 080 docs: `steps/080-avatar-render-run/README.md` says corner chunks
  are "for the editor" — update wording to note assembly now composites them.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Flow gate | `bash pipelines/video/visuals-flow/scripts/check.sh` | exit 0 |
| Bubble tests only | `cd pipelines/video/visuals-flow && node --test lib/bubble.test.mjs` | exit 0 |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/effects/bubble.mjs` (new)
- `pipelines/video/visuals-flow/lib/effects/registry.mjs` (append module)
- `pipelines/video/visuals-flow/lib/assemble.mjs` (ctx: corner jobs + CLI flag only)
- `pipelines/video/visuals-flow/lib/bubble.test.mjs` (new) + `scripts/check.sh` test list
- `pipelines/video/visuals-flow/EFFECTS.md` (bubble row)
- `pipelines/video/visuals-flow/steps/080-avatar-render-run/README.md` (one-paragraph wording update)

**Out of scope**:
- avatar-render.mjs job planning (already correct); HeyGen submission code; board UI; shot-pass surfaces; other effect modules.

## Git workflow

- Branch: `advisor/100-corner-avatar-bubble`
- Commit per step: `feat(visuals-flow): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: bubble.mjs module

Create `lib/effects/bubble.mjs`:

```js
export const TYPE = 'bubble';
export const CONSTANTS = {
  BUBBLE_D_1080: 150, BUBBLE_INSET_1080: 40,
  RING_PX_1080: 3, RING_COLOR: '#FB923C', GLOW_SIGMA: 6
};

export function plan(ctx) {
  return [{ id: 'bubble', type: TYPE, enabled: true }];
}

export function contribute(seg, instances, ctx) {
  if (seg.kind !== 'screen') return null;
  if (!instances[0]) return null;
  const corners = (ctx.cornerJobs || []).filter(j => j.file && j.start < seg.end && j.end > seg.start);
  if (corners.length === 0) return null;
  // ... inputs: one per overlapping corner chunk, sliced to the overlap:
  //   ['-ss', String(Math.max(0, seg.start + (startTrim) - j.start)), '-t', String(overlapDur), '-i', j.file]
  // ... chainFragments: per input — scale to D, crop centered square, circular
  //     alpha via geq, ring+glow drawn, then overlay at (W-inset-D, inset)
  //     enabled between the overlap's in-segment times.
}
```

The circular composite per chunk (exact filter text to emit; `D` = diameter,
`R = D/2`, `RING` = ring width in px, all precomputed integers):

```
[IDX:v]scale=D:D:force_original_aspect_ratio=increase,crop=D:D,format=rgba,
geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(X-R,Y-R),R-1),255,0)'[bub];
color=c=0x00000000:s=DxD,format=rgba,
geq=r='251':g='146':b='60':a='if(between(hypot(X-R,Y-R),R-RING-1,R+1),255,0)',
gblur=sigma=GLOW_SIGMA:steps=2[ring];
[bub][ring]overlay=0:0[bubr];
[lastV][bubr]overlay=W-INSET-D:INSET:enable='between(t,AT,UNTIL)'[nextV]
```

Notes the executor must honor: `format=rgba` before every geq (alpha math in
RGB space — the pink-flash lesson forbids yuv shortcuts); one bubble chain per
overlapping corner chunk (chunks are contiguous, so at most 2 per segment
boundary); `AT/UNTIL` are the chunk's overlap window in SEGMENT-local time
(`chunkStart - seg.start - startTrim`, clamped ≥0, same arithmetic as
captions.mjs lines 32-39).

**Verify**: module imports clean — `cd pipelines/video/visuals-flow && node --input-type=module -e "import('./lib/effects/bubble.mjs').then(m=>console.log(m.TYPE))"` -> `bubble`.

### Step 2: wire into registry, ctx, and CLI

1. `registry.mjs`: append `bubble` LAST in `EFFECT_MODULES`.
2. `assemble.mjs`: read avatar-jobs.json corner rows into
   `cornerJobs = jobs.filter(j => j.kind === 'corner' && j.file)` and add to
   `ctx`; add `bubble` to `effectFlags` wired to a `--bubble on|off` CLI arg
   (default `on`); when `cornerJobs` is empty the module already no-ops.
3. `effects-plan.mjs` needs no change (it iterates EFFECT_MODULES generically)
   — CONFIRM by running it on test-01 and seeing a `bubble` instance appear.

**Verify**: `cd pipelines/video/visuals-flow && node lib/effects-plan.mjs test-01 && node --input-type=module -e "import('node:fs').then(fs=>console.log(JSON.parse(fs.readFileSync('videos/test-01/effects.json','utf8')).instances.some(i=>i.type==='bubble')))"` -> `true` (test-01 has no corner FILES, so contribute no-ops at assemble time — instance existence is still expected).

### Step 3: tests + synthetic pixel proof

`lib/bubble.test.mjs`:

1. `plan()` emits one instance.
2. `contribute()` returns null for non-screen segments, null when cornerJobs
   empty, and inputs/fragments with correct slice arithmetic for a fixture
   (screen seg 10–20s, corner chunk 0–15s + 15–30s → 2 inputs, boundary at
   segment-local t=5).
3. Pixel proof (all files inside the repo, deleted after): build a 2s
   1280x720 green `color=` clip as "screen" and a 2s white clip as "corner",
   run ONE contribute-emitted chain via ffmpeg, extract the last frame, then
   assert with a small node/python check: pixel at the bubble center
   (W-inset-D/2 …) is WHITE, pixel at frame center is GREEN, pixel on the
   ring circumference is within tolerance of (251,146,60), and pixel at the
   bubble's bounding-box corner (outside the circle, inside the box) is
   GREEN (alpha mask really circular — the assertion that catches a square
   overlay).
4. Add `lib/bubble.test.mjs` to the check.sh test list.

**Verify**: `bash pipelines/video/visuals-flow/scripts/check.sh` -> exit 0.

### Step 4: docs + inspection

1. `EFFECTS.md`: bubble row — fires on screen segments when corner clips
   exist; hidden on avatar/graphic segments by construction; knobs
   (`BUBBLE_D_1080`, `RING_COLOR`, `--bubble off`, per-instance `enabled`);
   provenance `references/PvnJavua0YY.md` mode-structure section + spec D2.
2. `steps/080-avatar-render-run/README.md`: corner chunks are now composited
   by step 090 (editor wording updated accordingly).
3. Extract the Step-3 proof frame as a PNG, LOOK at it (circle crisp? ring
   visible? glow subtle?), attach it to the PR.

**Verify**: PR carries the frame; EFFECTS.md row present.

## Test plan

Unit tests (visibility rules, slice arithmetic), synthetic pixel proof with
four positional assertions (center-of-bubble, frame-center, ring color,
outside-circle corner), full check.sh, attached frame inspection. Real
end-to-end waits for the first video rendered WITHOUT `--spans-only` (owner
runs HeyGen — not this plan).

## Done criteria

- [ ] check.sh exit 0 with bubble tests in the list
- [ ] Pixel proof passes all four positional assertions
- [ ] effects-plan on test-01 emits the bubble instance; assembly with no corner files still succeeds (no-op path)
- [ ] EFFECTS.md + 080 README updated
- [ ] Proof frame attached to the PR

## STOP conditions

- Any corner-file requirement that would make assembly FAIL when corner clips are absent — the module must no-op; stop if the design can't hold that.
- geq alpha approach produces jagged edges at 1080p in the proof frame — stop and report with the frame; do not silently switch to a different masking technique.
- Any edit to avatar-render.mjs job planning or HeyGen submission code.

## Maintenance notes

- The bubble overlays AFTER captions in the chain — if they ever collide spatially, captions yield (bubble is top-right, captions bottom-center; collision means someone moved one).
- Future: per-segment bubble hide via effects.json (`enabled:false` on the single instance kills it video-wide; finer control would need per-segment instances — don't build until asked).
- Spec: `docs/specs/2026-07-19-mode-structure-density-design.md` (D2).
