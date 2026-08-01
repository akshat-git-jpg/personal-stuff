<!-- boss frontmatter -->
---
executor: claude-p
model:
test_cmd: cd pipelines/video/visuals-flow-2 && node --test lib/render.test.mjs lib/side-mode.test.mjs && bash scripts/check.sh
ui:
deploy:
needs: ["shares lib/render.mjs and scripts/check.sh with 175, and lib/resolve.mjs with 177. No E-code and no rulebook overlap. Smallest of the five — landing it first keeps the others' rebases cheap."]
---

# Plan 176: vf2 side-mode render join

## Summary

Side-mode avatar spans render a clipped graphics card. The card is rendered at
the full 1920px canvas and then composited into a 1200px column, so the right
720px of the card is hidden behind the host. `lib/render.mjs` already contains
the code to render the card at side width, but it is gated on a cue field
(`sideMode`) that nothing in the pipeline ever writes. This plan wires that one
missing join and adds the regression tests that would have caught it.

- **Problem statement**: `lib/render.mjs` gates side-width rendering on `cue.sideMode`, a field with one reader and zero writers, so every side-mode card renders at 1920px and gets cropped to 1200px by the compositor.
- **Goals**: compute `sideMode` at render time from the resolved shot spans, render those cues at 1200px, and fail loudly on a side span that covers zero or several fullframe cues.
- **Executor proposed**: claude-p, sonnet — one join, a new helper module, and its tests.
- **Done criteria** (terse): a side cue's rendered clip is 1200x1080, proven by ffprobe.
- **Stop conditions** (terse): the fix would need cue timings to move, or side geometry to change.
- **Test / verification for success**: `lib/side-mode.test.mjs` plus an ffprobe width assertion on a real rendered clip.
- **Open points for plan readiness**: none — reviewed 2026-08-02, the dead-code join is confirmed by grep (one reader in `render.mjs:268`, no writers) and the 040-vs-060 ordering constraint that explains the gap is documented in the plan.
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `802e7078`, 2026-08-01

## Why this matters

Owner feedback on `best-ai-video-generator` final-v3 (item 4, 2026-08-01): the
host avatar first appears 2 minutes into a 32 minute video, which reads as a
surprise. The intro host span had to be deleted during the run because it was a
`side` span and the card under it rendered clipped ("The Plan" lost its last
letters). Deleting the span was the only option available mid-run, and it cost
the video its intro host moment.

So this bug does not just produce an ugly frame. It removes the operator's
ability to use side mode at all, which in turn breaks the U-curve the shot
rulebook asks for. Every future video that wants a host beside a graphic hits
the same wall.

This is the pipeline's recurring failure shape, recorded in the 130 rulebook as
"computed on one surface, never consumed on the next": a field exists, one side
writes nothing, the other side reads it and silently takes the wrong branch.

## Current state

The side-mode chain is implemented at every step except one.

| Step | File | State |
|---|---|---|
| Span declares side mode | `videos/<slug>/shots.json` `mode: "side"` | works |
| Span validated against a side-capable card | `lib/lint-shots.mjs` (catalog `side: true`) | works |
| Job tagged for the compositor | `lib/avatar-render.mjs` -> `purpose: "avatar-side"` | works |
| Host composited into right 720px | `lib/assemble.mjs` (`sideJobs`, `SIDE_AVATAR_W`) | works |
| Card rendered at 1200px not 1920px | `lib/render.mjs` line ~268 `if (cue.sideMode)` | **dead code** |

`rewriteCanvas(html, width)` in `lib/render.mjs` rewrites the card's
`data-width` to `SHOT_CONSTANTS.SIDE_GRAPHICS_W` (1200). It is only called when
`cue.sideMode` is truthy. Grep for the field across the repo:

```
$ grep -rn "sideMode" lib/ steps/
lib/render.mjs:268:      if (cue.sideMode) {
```

One reader, zero writers. `resolved.json` cues carry `id, card, placement,
start, duration, variables` and no `sideMode`.

There is an ordering constraint that explains the gap. Cues resolve at step 040
(`lib/resolve.mjs`), but shots resolve at step 060 (`lib/resolve-shots.mjs`), so
at cue-resolve time the side spans are not known yet. The render at step 090
runs after both, which makes render the correct place to compute the join.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Unit tests | `cd pipelines/video/visuals-flow-2 && node --test lib/render.test.mjs lib/side-mode.test.mjs` | exit 0 |
| Repo gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |
| Inspect a rendered clip's width | `ffprobe -v error -show_entries stream=width,height -of csv=p=0 <clip>.mp4` | `1200,1080` for a side cue |

## Scope

**In scope**:
- Compute `sideMode` for cues covered by a `mode: "side"` span, at render time.
- Render those cues at `SIDE_GRAPHICS_W` (1200) instead of 1920.
- Fail loudly when a side span covers zero or multiple fullframe cues.
- Regression tests covering the data path end to end (plan input -> clip width).

**Out of scope**:
- Changing the side layout geometry (1200/720 split stays as-is).
- Changing which cards are `side: true` in the catalog.
- The separate avatar-jobs staleness bug (a span deleted from `shots.json`
  remains in `avatar-jobs.json` and keeps compositing). Track separately.

## Git workflow

- Branch: `advisor/176-vf2-side-mode-render-join`
- Commit: `fix(vf2): render side-mode cards at side width` — no AI footers. Do NOT push.

## Steps

### Step 1: Add a side-mode resolver helper

Create `lib/side-mode.mjs` exporting:

```js
// Returns a Set of cue ids that a `side` avatar span covers.
export function sideModeCueIds(resolvedCues, shotSpans)
```

Rules:
- Only spans whose `mode === 'side'` participate.
- A cue is covered when it is `placement: 'fullframe'` and its
  `[start, start+duration]` window overlaps the span's `[start, end]`.
- If a side span covers zero fullframe cues, throw with the span id. Rendering
  it would put the host beside bare footage, which is not what side mode means.
- If a side span covers more than one fullframe cue, throw with the span id and
  the cue ids. `lint-shots` already treats this as a defect; render must not
  silently pick one.

**Verify**: `node --test lib/side-mode.test.mjs` -> exit 0

### Step 2: Wire it into the renderer

In `lib/render.mjs`, before the per-cue render loop, load
`videos/<slug>/shots.resolved.json` when it exists and compute the id set with
`sideModeCueIds`. Set `cue.sideMode = ids.has(cue.id)`.

Notes:
- `shots.resolved.json` may be absent (a video with no avatar plan). Treat a
  missing file as "no side cues" and carry on. Do not throw.
- The render cache key must include `sideMode`, or a cue that flips between
  runs will serve a stale clip at the wrong width. Check `hashRenderInputs`
  covers it; if it hashes the staged HTML then the rewritten `data-width`
  already changes the hash, and this is satisfied. Assert it in a test rather
  than assuming.

**Verify**: `node --test lib/render.test.mjs` -> exit 0

### Step 3: Regression test on the real path

Add to `lib/side-mode.test.mjs` a test that stages a side-capable card, runs the
canvas rewrite, and asserts the staged HTML declares `data-width="1200"`. Then
add a test asserting a NON-side cue still stages at 1920.

This is the data-to-pixels check the fold rulebook demands. A test that only
asserts the Set contents would have passed while the bug shipped.

**Verify**: `node --test lib/side-mode.test.mjs` -> exit 0, and both width
assertions present.

### Step 4: Prove the gate can fail

Temporarily revert the `cue.sideMode` assignment from Step 2, run the tests, and
confirm they FAIL. Restore it and confirm they pass. Record both outcomes in the
PR description.

A green gate that has never failed is not evidence, per the fold rulebook's
"a gate that has never fired" shape.

**Verify**: documented fail-then-pass in the PR body.

## Test plan

1. Unit: `sideModeCueIds` returns the covering cue for a side span, empty for a
   full span, and throws on the zero-cue and multi-cue cases.
2. Integration: staged HTML for a side cue declares `data-width="1200"`; a
   normal cue declares 1920.
3. Mutation: with Step 2 reverted the suite fails (Step 4).
4. Repo gate: `bash scripts/check.sh` exit 0.

## Done criteria

- [ ] `lib/side-mode.mjs` exists and exports `sideModeCueIds`.
- [ ] `lib/render.mjs` sets `cue.sideMode` from `shots.resolved.json`.
- [ ] A side-covered cue stages at `data-width="1200"`; others stay 1920.
- [ ] Zero-cue and multi-cue side spans throw with the span id in the message.
- [ ] Missing `shots.resolved.json` does not throw.
- [ ] Tests fail when the Step 2 assignment is reverted (mutation-proven).
- [ ] `bash scripts/check.sh` exits 0.
