---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
ui: true
deploy:
needs: []
---

# Plan 147: per-span avatar `mode` end to end (`full` | `panel`), and make panel actually composite

## Summary

- **Problem statement**: The owner's review model (decisions.md 2026-07-25) requires picking an avatar *variation per span* on the storyboard, but no per-span `mode` field exists. The only avatar presentation that renders is full-screen replacement. `head_layout: "panel"` is a **dead path**: `lib/resolve-shots.mjs:52` computes `resolvedKind = 'avatar-panel'`, but `lib/avatar-render.mjs:41` stamps every span job `kind: 'avatar-full'`, and `lib/assemble.mjs:66,818` only ever select `avatar-full` — so a panel span silently renders as a full-screen takeover.
- **Goals**: (1) a per-span `mode: "full" | "panel"` field carried end to end — schema, resolver, lint, avatar job kind, assemble compositing, FCPXML, board label; (2) panel spans actually composite as an inset rounded-rect PIP instead of replacing the base; (3) the video-level `head_layout` panel branch is removed so there is exactly one way to say "panel".
- **Executor proposed**: agy (Gemini 3.1 Pro High); `ui: true` — the verifier extracts a composited frame and LOOKS.
- **Done criteria** (terse — full list below): v2 gate green; `mode` present in all six surfaces; a panel fixture composites to a real inset PIP verified by pixel sampling, not by file existence.
- **Stop conditions** (terse — full list below): a panel span overlapping a fullframe cue has no correct answer; any edit under `videos/`; any v1 edit.
- **Test / verification for success**: pure-geometry unit tests + an ffmpeg composite smoke + a pixel-sampled frame assertion that proves the base is still visible behind the PIP.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If anything in "STOP conditions" occurs, stop and report. Do NOT edit `plans/README.md`. `videos/**` may contain untracked live-review data — never stage, edit, or delete anything under `videos/`.
>
> **Drift check (run first)**: `git diff --stat 39100b9..HEAD -- pipelines/video/visuals-flow-2`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `39100b9`, 2026-07-25

## Why this matters

The owner reviews the plan on the storyboard and only then pays for renders. Choosing *how* the host appears (full takeover vs an inset panel over live demo) is a plan-class decision, so it has to be selectable per span and visible before render. Today it is neither.

Worse, the current state is actively misleading: the code reads as though panel mode exists. Plan 145 was written against that assumption and named "the panel branch in `lib/assemble.mjs`" as its exemplar to copy — an exemplar that does not exist. Any plan built on top of this baseline inherits the same false premise, so the dead path must be replaced with a real one before stage mode (plan 148) can build on it.

This is the fourth instance of one failure mode found on 2026-07-25: a value is computed on one surface and never consumed on the next (`conceptSpans` planned then dropped by assemble; the 035 audit gate reading `resolved.cues` instead of `resolved.resolved`; `register` linted but never merged into card variables — see `plans/runs/LESSONS.md` 2026-07-24). Hence the done criteria below verify the **full path data→pixels**, never per-surface.

## Current state

Facts below were read directly from the files at commit `39100b9`.

- **`lib/resolve-shots.mjs:35`** — the only accepted span kind:
  ```js
  if (span.kind !== 'avatar-full') { errors.push(`${span.id}: unknown kind "${span.kind}" — only "avatar-full" exists today`); continue; }
  ```
- **`lib/resolve-shots.mjs:52`** — the dead panel branch (its output is consumed by nothing):
  ```js
  const resolvedKind = (span.kind === 'avatar-full' && manifest.head_layout === 'panel') ? 'avatar-panel' : span.kind;
  ```
- **`lib/avatar-render.mjs:41`** — every span job is hardcoded `avatar-full`, discarding `resolvedKind`:
  ```js
  const spanJobs = (shotsResolved.spans || []).map((s) => ({ id: s.id, kind: 'avatar-full', start: s.start, end: s.end }));
  ```
- **`lib/assemble.mjs:66`** (inside `planSegments`) and **`lib/assemble.mjs:818`** — both filter to `avatar-full` only, so any other kind is dropped silently:
  ```js
  for (const j of avatarJobs.filter((j) => j.kind === 'avatar-full')) {
  avatarJobs = avatarJobsFile.jobs.filter(j => j.kind === 'avatar-full');
  ```
- **`lib/shot-constants.mjs`** — contains NO `PANEL_*` constants (grep for `PANEL` returns nothing). Plan 145 claimed these existed; they do not.
- **`lib/assemble.mjs`** and **`lib/export-timeline.mjs`** — `grep -c panel` returns `0` in both. There is no panel compositing and no panel FCPXML transform anywhere.
- **Existing overlay compositing exemplar** (`lib/assemble.mjs`, the graphics-overlay chain — copy this wiring shape): each overlay input is trimmed, time-shifted, scaled, then `overlay=`d onto the running base with an `enable=` window:
  ```js
  const keyFilter = o.chroma ? `,colorkey=${o.chroma}:0.30:0.10` : '';
  chain += `[${globalInputIdx}:v]trim=start=${o.trimStart},setpts=PTS-STARTPTS+${adjustedAt}/TB,scale=${w}:${h}${keyFilter}[${oj}];`;
  chain += `[${lastV}][${oj}]overlay=eof_action=pass:enable='between(t,${adjustedAt},${adjustedUntil})'[${nextV}];`;
  ```
- **Canvas**: `export const CANVAS = { w: 1920, h: 1080, fps: 30 };` in `lib/assemble.mjs`.
- **Board**: `lib/board.mjs:773` renders the storyboard shot header with the literal string `avatar-full`; `:860` does the same for the minimap tooltip. Both must show the span's real mode.
- **Test convention**: `node --test` with `node:assert/strict`; test files sit beside their module as `<name>.test.mjs`. `scripts/check.sh` is the aggregate gate.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| v2 gate (merge gate) | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |
| Focused tests | `cd pipelines/video/visuals-flow-2 && node --test lib/resolve-shots.test.mjs lib/lint-shots.test.mjs lib/assemble.test.mjs lib/export-timeline.test.mjs` | all pass |
| Composite smoke (rounded-rect alpha) | `ffmpeg -f lavfi -i color=c=red:s=1920x1080:d=2 -f lavfi -i color=c=blue:s=538x302:d=2 -filter_complex "[1]format=yuva444p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(lt(hypot(max(abs(X-W/2)-(W/2-24),0),max(abs(Y-H/2)-(H/2-24),0)),24.5),255,0)'[a];[0][a]overlay=x=1350:y=746" -frames:v 1 -y /tmp/panel-smoke.png` | exit 0, file written |

## Scope

**In scope** (`pipelines/video/visuals-flow-2/`):
`PIPELINE.md`, `lib/shot-constants.mjs`, `lib/resolve-shots.mjs`, `lib/lint-shots.mjs`, `lib/avatar-render.mjs`, `lib/assemble.mjs`, `lib/export-timeline.mjs`, `lib/board.mjs`, `steps/070-shot-pass-llm/shot-pass-prompt.md`, `steps/070-shot-pass-llm/RULEBOOK.md`, and the matching `*.test.mjs` files.

**Out of scope** (looks related — do not touch):
- `mode: "stage"` and the `head_zone` contract — that is plan 148, which depends on this one. Do not add a `stage` enum value here.
- **Side view.** `side-avatar` in `pipelines/video/heygen/registry.json` has no HeyGen `avatar_id`; it is the fal-lipsync flow (`pipelines/video/heygen/fal-lipsync/`). It is a different render BACKEND, not a compositing mode, so it does not belong in this enum. It needs its own plan once fal-lipsync is wired into step 080.
- The corner-bubble baseline (already works via corner chunks + the bubble effect module). Leave it alone.
- v1 (`pipelines/video/visuals-flow/`), and anything under `videos/`.

## Git workflow

- Branch: `boss/147-vf2-avatar-per-span-modes`. Commit per step. Do NOT push.

## Steps

### Step 1: constants

Add to `lib/shot-constants.mjs`, matching the existing entry shape (`{ value, rule }`):

```js
PANEL_WIDTH_FRAC:  { value: 0.28, rule: 'A panel-mode avatar occupies 28% of canvas width, inset bottom-right, preserving the source clip aspect ratio.' },
PANEL_INSET_PX:    { value: 32,   rule: 'A panel-mode avatar sits 32px from the right and bottom canvas edges.' },
PANEL_RADIUS_PX:   { value: 24,   rule: 'A panel-mode avatar is masked to a rounded rectangle of radius 24px.' },
```

**Verify**: `node -e "import('./lib/shot-constants.mjs').then(m=>console.log(m.SHOT_CONSTANTS.PANEL_WIDTH_FRAC.value))"` prints `0.28`. (If the module's export name differs, use the name already in the file — read it first.)

### Step 2: schema + resolver

- `PIPELINE.md`: document the span field `mode: "full" | "panel"`, default `"full"` when absent (back-compatible — every existing `shots.json` keeps working untouched).
- `lib/resolve-shots.mjs`: validate `span.mode` against `['full','panel']`, defaulting to `'full'`; carry it onto the resolved span as `mode`. **Delete the `head_layout` panel branch at line 52** and its `manifest` panel handling — after this change there is exactly one way to say panel, and it is per-span. Keep emitting `kind: 'avatar-full'` on resolved spans (kind stays "this is an avatar span"; `mode` says how it is presented).
- An unknown mode is an error naming the span and the allowed values.

**Verify**: `node --test lib/resolve-shots.test.mjs` passes with new cases: absent mode → `'full'`; `mode:"panel"` → carried through; `mode:"bogus"` → error mentioning `bogus`.

### Step 3: lint

In `lib/lint-shots.mjs`:
- **Panel spans are exempt from the full-screen budget** (`AVATAR_FULL_CAP` and the ~240s target) — a panel does not take the screen, so it must not consume the full-screen allowance. Only `mode === 'full'` spans count toward those.
- **New error**: a `panel` span must NOT overlap a fullframe graphics cue. A PIP on top of a full-frame card is two graphics stacked, which is the same defect lint E9 already forbids for overlays. Panel spans belong over screen/demo footage. Pass `resolved.json` into the linter the same way the existing checks receive their context.
- Keep the existing minimum-duration rule applying to both modes.

**Verify**: `node --test lib/lint-shots.test.mjs` passes with new cases: a 200s panel span does not trip the 300s full cap; a panel span overlapping a fullframe cue errors; a panel span over a screen segment is clean.

### Step 4: avatar job kind (close the dead path)

`lib/avatar-render.mjs:41` — stop hardcoding. Derive the job kind from the resolved span's mode:

```js
const spanJobs = (shotsResolved.spans || []).map((s) => ({
  id: s.id,
  kind: s.mode === 'panel' ? 'avatar-panel' : 'avatar-full',
  start: s.start,
  end: s.end,
}));
```

**Verify**: `node --test lib/avatar-render.test.mjs` passes with a new case: a resolved span with `mode:"panel"` produces a job with `kind:'avatar-panel'`; absent mode produces `avatar-full`.

### Step 5: assemble compositing (the load-bearing step)

Two changes in `lib/assemble.mjs`:

**(a) Base selection must stay full-only.** Lines 66 and 818 already filter `avatar-full`; that is now CORRECT and must not change — a panel must not replace the base. Add a comment at line 66 saying so, or the next reader will "fix" it.

**(b) Panel spans join the overlay path.** Author this exact pure geometry planner (export it so it is unit-testable without ffmpeg):

```js
// Panel geometry: an inset rounded-rect PIP, bottom-right, preserving the
// source clip's aspect. Dimensions are forced EVEN because yuv420p encoding
// rejects odd width/height.
export function planPanelGeometry({ canvas, constants, srcAspect = 16 / 9 }) {
  const { w: W, h: H } = canvas;
  const inset = constants.PANEL_INSET_PX.value;
  const pw = Math.round((W * constants.PANEL_WIDTH_FRAC.value) / 2) * 2;
  const ph = Math.round(pw / srcAspect / 2) * 2;
  return { w: pw, h: ph, x: W - pw - inset, y: H - ph - inset, radius: constants.PANEL_RADIUS_PX.value };
}
```

Then build the filter for each panel span, appended to the same chain the graphics overlays use (see the exemplar in "Current state"):

```js
const g = planPanelGeometry({ canvas: CANVAS, constants: SHOT_CONSTANTS });
const r = g.radius;
chain += `[${idx}:v]trim=start=${trimStart},setpts=PTS-STARTPTS+${at}/TB,scale=${g.w}:${g.h},format=yuva444p,` +
  `geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':` +
  `a='if(lt(hypot(max(abs(X-W/2)-(W/2-${r}),0),max(abs(Y-H/2)-(H/2-${r}),0)),${r + 0.5}),255,0)'[${tag}];`;
chain += `[${lastV}][${tag}]overlay=x=${g.x}:y=${g.y}:eof_action=pass:enable='between(t,${at},${until})'[${nextV}];`;
```

The `geq` alpha expression is a rounded-rect mask: inside the inset rectangle alpha is 255, outside the corner radius it is 0. `W`/`H` inside `geq` refer to the *scaled panel*, not the canvas.

**Verify**:
1. `node --test lib/assemble.test.mjs` passes with a new unit test on `planPanelGeometry`: at 1920×1080 with 16:9 source it returns `{w:538, h:302, x:1350, y:746, radius:24}` (compute and assert exact integers; both dimensions even).
2. The composite smoke command from the table exits 0 and writes `/tmp/panel-smoke.png`.

### Step 6: FCPXML export

`lib/export-timeline.mjs`: a panel span rides the avatar lane as a clip carrying `<adjust-transform>` whose scale and position match `planPanelGeometry` (import it — do not recompute the numbers by hand, or the two drift). Lane item name `panel:<span-id>`; full spans keep their current naming.

**Verify**: `node --test lib/export-timeline.test.mjs` passes with a new fixture: a panel span emits an `adjust-transform` whose numbers derive from the same planner.

### Step 7: board mode labels

`lib/board.mjs:773` and `:860` print the literal `avatar-full`. Replace with the span's actual mode so the owner can SEE which variation each span uses at Gate 1 — that visibility is the entire reason this plan exists. Render as `full` / `panel` (e.g. `🧍 s02 · panel · 00:54 → 01:22`).

**Verify**: `node --test lib/board.test.mjs` passes; add an assertion that a rendered storyboard containing a panel span includes the string `panel` in that span's header.

### Step 8: shot-pass guidance

`steps/070-shot-pass-llm/shot-pass-prompt.md` + `RULEBOOK.md` — one short paragraph on choosing a mode:
- **full** — the host IS the content for this stretch (intro, verdict, a claim with nothing to show).
- **panel** — the host reacts or narrates *while live footage keeps playing*; use over demo/screen stretches, never over a fullframe card (lint blocks it).
Note that `mode` defaults to `full` when omitted.

Regenerate the shot prompt if it is generated: `node lib/build-shot-prompt.mjs`, then confirm `node lib/check-shot-rulebook.mjs` reports OK.

**Verify**: `node lib/check-shot-rulebook.mjs` exits 0.

### Step 9: full gate + visual proof

**Verify**:
1. `bash scripts/check.sh` exit 0.
2. `grep -n "mode" lib/resolve-shots.mjs lib/lint-shots.mjs lib/avatar-render.mjs lib/assemble.mjs lib/export-timeline.mjs lib/board.mjs` → a real reference in **all six**.
3. Produce the frame described in Done criteria and attach it to the PR (`ui: true`).

## Test plan

New tests beside their modules, following the existing `node --test` + `node:assert/strict` convention:
- `lib/resolve-shots.test.mjs` — mode default / carry-through / invalid-value.
- `lib/lint-shots.test.mjs` — panel budget exemption; panel-over-fullframe error; panel-over-screen clean.
- `lib/avatar-render.test.mjs` — job kind derives from mode.
- `lib/assemble.test.mjs` — `planPanelGeometry` exact integers, both even.
- `lib/export-timeline.test.mjs` — panel transform derives from the shared planner.
- `lib/board.test.mjs` — storyboard header shows the mode.

## Done criteria

- [ ] `bash scripts/check.sh` exits 0
- [ ] `grep -n "mode" lib/resolve-shots.mjs lib/lint-shots.mjs lib/avatar-render.mjs lib/assemble.mjs lib/export-timeline.mjs lib/board.mjs` shows a real reference in all six files
- [ ] `grep -n "head_layout" lib/resolve-shots.mjs` returns **nothing** (the dead branch is gone)
- [ ] `planPanelGeometry({canvas:{w:1920,h:1080}, constants:SHOT_CONSTANTS})` returns `{w:538,h:302,x:1350,y:746,radius:24}`
- [ ] **Pixel proof, not existence proof.** Build a 3-second fixture: a solid-red 1920×1080 base and a solid-blue panel clip, composite through the real assemble filter chain, extract one frame, and assert by sampling that (a) pixel `(100,100)` is RED — the base is still visible, so the panel did NOT replace it, and (b) pixel `(1620,900)` is BLUE — the panel is present, bottom-right. Both assertions must be in a committed test, not run by hand.
- [ ] PR carries that extracted frame as an image (`ui: true`)

## STOP conditions

- **A panel span overlaps a fullframe cue in existing data.** Step 3 makes that a lint error, and `videos/**` is out of scope, so you cannot fix the data. Report the span ids and stop rather than weakening the lint to make a gate pass.
- **The `geq` rounded-rect mask does not survive the pipeline's pixel format** (e.g. alpha lost when the chain re-enters `yuv420p`). Report the failing filter string and the observed output; do NOT silently fall back to a square panel — the rounded corner is the visual signature.
- Any edit under `videos/**`, or to v1 (`pipelines/video/visuals-flow/`).

## Maintenance notes

- Plan 148 (stage mode) builds directly on this: it adds `"stage"` to the same enum and reuses `planPanelGeometry`'s shape with zone-driven geometry instead of a fixed inset. Keep the geometry planner exported and pure.
- The reviewer should scrutinise **step 5(a)**: the `avatar-full` filter at `lib/assemble.mjs:66` looks like a bug and is not. A future "cleanup" that widens it to all avatar kinds will make every panel a full-screen takeover again — which is exactly the bug this plan removes.
- `mode` defaults to `full`, so existing `shots.json` files need no migration.
