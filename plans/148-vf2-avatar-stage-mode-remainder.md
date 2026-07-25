---
executor: agy
model:
test_cmd: cd pipelines/video/card-library && npm run check && cd ../visuals-flow-2 && bash scripts/check.sh
ui: true
deploy:
needs: ["147 — per-span mode enum and the assemble overlay path this builds on"]
---

# Plan 148: avatar `stage` mode — the unimplemented remainder of plan 145

## Summary

- **Problem statement**: Plan 145 (`stage` mode — the host composited INTO a card's designed head zone) was closed `boss:done` on 2026-07-24 having landed only its Step 1. The `head_zone` catalog contract exists and validates; the mode itself does not. `grep -c stage` returns 0 across `lib/resolve-shots.mjs`, `lib/lint-shots.mjs`, `lib/assemble.mjs`, and `lib/export-timeline.mjs`, and `section/host-stage/` does not exist.
- **Goals**: land plan 145's Steps 2–5 on top of plan 147's real per-span `mode` infrastructure: (1) the `section/host-stage` card; (2) `mode: "stage"` in schema/resolver/lint with a covering-cue rule; (3) assemble composites the host into the covering card's `head_zone`; (4) FCPXML keeps the staged clip a movable lane item.
- **Executor proposed**: agy (Gemini 3.1 Pro High); `ui: true` — a card plan, so the verifier MUST extract rendered frames and look (LESSONS 2026-07-24: twelve cards once shipped as title-only stubs with every gate green).
- **Done criteria** (terse — full list below): both gates green; `stage` implemented in all four libs; a stage fixture composites into the zone, proven by pixel sampling; rendered frames of `host-stage` attached.
- **Stop conditions** (terse — full list below): a fixed `head_zone` cannot serve both card variants; plan 147 not yet merged; any `videos/**` or v1 edit.
- **Test / verification for success**: pure zone-geometry unit tests + pixel-sampled composite assertion + rendered-frame inspection against an explicit rubric.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If anything in "STOP conditions" occurs, stop and report. Do NOT edit `plans/README.md`. Never stage, edit, or delete anything under `videos/**`.
>
> **Drift check (run first)**: `git diff --stat 39100b9..HEAD -- pipelines/video/visuals-flow-2 pipelines/video/card-library`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: **plan 147** (per-span `mode` enum, the exported geometry-planner pattern, and the panel overlay path in `lib/assemble.mjs`). Do not start until 147 is merged.
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `39100b9`, 2026-07-25

## Why this matters

Panel and bubble put the host ON TOP of the content as a floating sticker. The host composited INSIDE a designed scene — a card built around a head slot — is what makes a talking-head moment look art-directed instead of pasted on. It is the highest-leverage remaining avatar option and the owner asked for it directly (decisions.md 2026-07-24).

Read the history before starting, because it explains the unusual verification bar below. Plan 145 was marked `boss:done` while roughly one step of five had landed, and its own "Current state" section described a panel-mode baseline that did not exist. Gates passed throughout. This plan therefore verifies **pixels and rendered frames**, never file existence or a green gate alone.

## Current state

Verified at commit `39100b9`.

**Already landed from plan 145 (do NOT redo):**
- `card-library/scripts/check-catalog.mjs:67-80` — full `head_zone` validation: object shape, `x`/`y` in 0–1, `w`/`h` in (0,1], `x+w ≤ 1`, `y+h ≤ 1`, optional positive-int `radius`:
  ```js
  if (card.head_zone !== undefined) {
    const hz = card.head_zone;
    ...
    if (typeof hz.x === 'number' && typeof hz.w === 'number' && hz.x + hz.w > 1) err(`FAIL: ${card.slug}.head_zone x+w must be <= 1`);
  ```
- `card-library/README.md` documents the contract.
- `card-library/catalog.json` — `section/tool-intro` carries `"head_zone": { "x": 0.6, "y": 0.28, "w": 0.3, "h": 0.53 }`.

**Not landed (this plan's work):**
- `section/host-stage/` does not exist (`ls card-library/section/ | grep -i stage` → nothing).
- `grep -c stage` → `0` in `visuals-flow-2/lib/resolve-shots.mjs`, `lib/lint-shots.mjs`, `lib/assemble.mjs`, `lib/export-timeline.mjs`.

**Card conventions to imitate** — exemplar: `card-library/section/tool-intro/index.html` (a `single`/`fullframe` section card that already declares a `head_zone`). Copy its scaffolding: the `VARS` block reading `window.__hyperframes.getVariables()`, the LOCKED GSAP timeline registered on `window.__timelines`, and the `data-duration` attribute. Per `card-library/CLAUDE.md`, a card is real only once it is shaped `<type>/<card-name>/index.html`, has a `catalog.json` entry, and is committed **and pushed**.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Card gate | `cd pipelines/video/card-library && npm run check` | exit 0 |
| v2 gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |
| Card lint | `cd pipelines/video/card-library && npx hyperframes@latest lint section/host-stage` | clean (the "Studio can't drag-edit" and "Google Fonts" warnings are expected) |
| Card QA contact sheet | `cd pipelines/video/card-library && node scripts/card-qa.mjs section/host-stage` | exit 0, contact sheet written |
| Render a frame to LOOK at | `cd pipelines/video/card-library && npx hyperframes@latest render section/host-stage -o /tmp/host-stage.mp4 --fps 30 && ffmpeg -y -ss 3 -i /tmp/host-stage.mp4 -frames:v 1 /tmp/host-stage.png` | png written |

## Scope

**In scope**:
- `card-library/`: `section/host-stage/index.html` (new), `catalog.json` (the new card's entry), `gallery-order.json` (optional pin)
- `visuals-flow-2/`: `PIPELINE.md`, `lib/shot-constants.mjs`, `lib/resolve-shots.mjs`, `lib/lint-shots.mjs`, `lib/assemble.mjs`, `lib/export-timeline.mjs`, `steps/070-shot-pass-llm/shot-pass-prompt.md`, `steps/070-shot-pass-llm/RULEBOOK.md`, and matching `*.test.mjs`

**Out of scope**:
- The `head_zone` contract, its validation, and the `tool-intro` retrofit — already landed; changing them is out of scope.
- **Side view** — `side-avatar` has no HeyGen `avatar_id`; it is the fal-lipsync backend (`pipelines/video/heygen/fal-lipsync/`), a different render path rather than a compositing mode. Needs its own plan.
- Board rendering of stage spans beyond the mode label plan 147 adds.
- HeyGen render mechanics — stage reuses the same downloaded clips.
- v1, and anything under `videos/**`.

## Git workflow

- Branch: `boss/148-vf2-avatar-stage-mode-remainder`. Commit per step. Do NOT push.

## Steps

### Step 1: the `section/host-stage` card

Create `card-library/section/host-stage/index.html`, scaffolded from `section/tool-intro/index.html`.

Layout, 1920×1080: **left column** — an eyebrow, a `title` heading, and up to 3 `points` chips revealing one per beat. **Right side** — the head zone: a keylined rounded rectangle at `{ x: 0.58, y: 0.20, w: 0.34, h: 0.60 }` with a subtle inner glow, left **visually empty** (assemble fills it with the host clip at composite time; the card itself never draws a face).

Catalog entry: `kind: "beat"`, `placement: "fullframe"`, `max_beats: 3`, `max_reveal_chars: 28`, `structural: false`, plus:
```json
"head_zone": { "x": 0.58, "y": 0.20, "w": 0.34, "h": 0.60 },
"intent": "host makes a point to camera while supporting chips land beside them",
"anti_intent": "no avatar footage exists for this span, or the span is over live demo footage"
```

**Verify**:
1. `npx hyperframes@latest lint section/host-stage` clean.
2. `npm run check` exit 0 (this runs `check-catalog.mjs`, which validates the new `head_zone`).
3. Render and extract frames at t=1, t=3, t=5 and **LOOK**, scoring against this rubric — every line must pass:
   - the head-zone rectangle is empty (no placeholder face, no filler text)
   - no element overlaps the head-zone rectangle at any of the three frames
   - all 3 chips are visible and unclipped by t=5
   - the title does not overflow its column
   Attach the three frames to the PR.

### Step 2: schema, resolver, lint

Building on plan 147's `mode` enum:
- `PIPELINE.md`: `mode` grows to `"full" | "panel" | "stage"`. Document the stage rule: a stage span **must be fully contained inside ONE fullframe cue whose card declares a `head_zone`**.
- `lib/resolve-shots.mjs`: accept `"stage"`.
- `lib/shot-constants.mjs`: add `STAGE_HEAD_RADIUS_PX: { value: 24, rule: 'A stage-mode avatar is masked to a rounded rectangle of radius 24px inside the card head zone.' }`.
- `lib/lint-shots.mjs`:
  - **Error** — a stage span not fully covered by a single fullframe cue whose card has a `head_zone` (receive `resolved.json` + catalog the same way the panel check in 147 receives its context). The message must name the span and say which condition failed (no covering cue / covering card has no head_zone / span crosses two cues).
  - Stage spans are **budget-exempt** like panel — the host shares the frame rather than taking it.
  - **Warning** — a stage span that outlives its covering cue.

**Verify**: `node --test lib/resolve-shots.test.mjs lib/lint-shots.test.mjs` passes with fixtures: valid stage span inside a `head_zone` cue; stage span with no covering cue → error; stage span covered by a card lacking `head_zone` → error; long stage span does not trip the full-screen cap.

### Step 3: assemble compositing

Author this exact pure planner in `lib/assemble.mjs` (export it — same pattern as 147's `planPanelGeometry`):

```js
// Stage geometry: the host fills the covering card's declared head_zone.
// The clip is cover-cropped to the zone's aspect (scale up, crop centre) so the
// face is never letterboxed or squashed. Dimensions forced EVEN for yuv420p.
export function planStageGeometry({ zone, canvas, radiusPx, srcAspect = 16 / 9 }) {
  const { w: W, h: H } = canvas;
  const zw = Math.round((zone.w * W) / 2) * 2;
  const zh = Math.round((zone.h * H) / 2) * 2;
  const zoneAspect = zw / zh;
  // cover: scale so the SHORT side fills, then centre-crop the overflow
  const scaleW = zoneAspect > srcAspect ? zw : Math.round((zh * srcAspect) / 2) * 2;
  const scaleH = zoneAspect > srcAspect ? Math.round((zw / srcAspect) / 2) * 2 : zh;
  return {
    scaleW, scaleH,
    cropW: zw, cropH: zh,
    cropX: Math.round((scaleW - zw) / 2),
    cropY: Math.round((scaleH - zh) / 2),
    x: Math.round(zone.x * W),
    y: Math.round(zone.y * H),
    radius: zone.radius ?? radiusPx,
  };
}
```

Filter chain per stage span (append to the same overlay chain plan 147 established):

```js
const s = planStageGeometry({ zone, canvas: CANVAS, radiusPx: SHOT_CONSTANTS.STAGE_HEAD_RADIUS_PX.value });
const r = s.radius;
chain += `[${idx}:v]trim=start=${trimStart},setpts=PTS-STARTPTS+${at}/TB,` +
  `scale=${s.scaleW}:${s.scaleH},crop=${s.cropW}:${s.cropH}:${s.cropX}:${s.cropY},format=yuva444p,` +
  `geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':` +
  `a='if(lt(hypot(max(abs(X-W/2)-(W/2-${r}),0),max(abs(Y-H/2)-(H/2-${r}),0)),${r + 0.5}),255,0)'[${tag}];`;
chain += `[${lastV}][${tag}]overlay=x=${s.x}:y=${s.y}:eof_action=pass:enable='between(t,${at},${until})'[${nextV}];`;
```

Resolve `zone` by looking up the covering cue's card in the catalog — both `resolved` and the catalog are already loaded in `runAssembly`.

**Verify**:
1. `node --test lib/assemble.test.mjs` passes with a `planStageGeometry` unit test: for `zone {x:0.58,y:0.20,w:0.34,h:0.60}` at 1920×1080 with a 16:9 source, assert exact integers, both `cropW`/`cropH` even, and `cropX`/`cropY` ≥ 0.
2. Composite smoke exits 0:
   ```
   ffmpeg -f lavfi -i color=c=red:s=1920x1080:d=2 -f lavfi -i color=c=lime:s=1920x1080:d=2 -filter_complex "[1]scale=1160:652,crop=652:648:254:2,format=yuva444p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(lt(hypot(max(abs(X-W/2)-(W/2-24),0),max(abs(Y-H/2)-(H/2-24),0)),24.5),255,0)'[a];[0][a]overlay=x=1114:y=216" -frames:v 1 -y /tmp/stage-smoke.png
   ```

### Step 4: FCPXML export

`lib/export-timeline.mjs`: a stage span rides the avatar lane with `<adjust-transform>` scale/position derived from `planStageGeometry` (import it; never recompute the numbers inline). Lane item name `stage:<span-id>`. The editor must be able to nudge it, so it stays a real lane item rather than being baked in.

**Verify**: `node --test lib/export-timeline.test.mjs` passes with a stage fixture whose transform matches the planner's output.

### Step 5: shot-pass guidance

`steps/070-shot-pass-llm/shot-pass-prompt.md` + `RULEBOOK.md` — extend 147's mode paragraph with **stage**: the host and a designed point share one art-directed frame. Prefer stage over panel whenever a `host-stage` or `tool-intro` cue is already planned at that moment, because the card reserved space for the head. A stage span must sit entirely inside that one cue.

Regenerate if generated (`node lib/build-shot-prompt.mjs`), then `node lib/check-shot-rulebook.mjs` exits 0.

**Verify**: `node lib/check-shot-rulebook.mjs` exits 0.

### Step 6: gates and visual proof

**Verify**: both gates green; the pixel assertion and rendered frames below.

## Test plan

- `lib/resolve-shots.test.mjs` — stage accepted.
- `lib/lint-shots.test.mjs` — covering-cue error cases, budget exemption, outlives-cue warning.
- `lib/assemble.test.mjs` — `planStageGeometry` exact integers; the pixel-sampled composite assertion below.
- `lib/export-timeline.test.mjs` — stage transform derives from the planner.
- Rendered-frame inspection of `section/host-stage` against Step 1's rubric.

## Done criteria

- [ ] `cd pipelines/video/card-library && npm run check` exits 0
- [ ] `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` exits 0
- [ ] `grep -n "stage" lib/resolve-shots.mjs lib/lint-shots.mjs lib/assemble.mjs lib/export-timeline.mjs` shows a real reference in **all four**
- [ ] `catalog.json` — `section/host-stage` exists with a valid `head_zone`, and `check-catalog.mjs` passes it
- [ ] **Pixel proof.** A committed test composites a solid-lime host clip into `tool-intro`'s zone `{x:0.6,y:0.28,w:0.3,h:0.53}` over a solid-red base and asserts by sampling: pixel `(100,100)` is RED (card still visible — the host did not replace the frame) and the zone centre `(1440,864)` is LIME (host landed inside the declared zone). Existence checks do not satisfy this.
- [ ] PR carries rendered frames of `section/host-stage` at t=1/3/5, each passing Step 1's rubric

## STOP conditions

- **Plan 147 is not merged.** This plan's `mode` enum, overlay path, and geometry-planner pattern all come from it. Stop and report rather than re-implementing 147's work here.
- **A fixed `head_zone` cannot serve both variants of a card** (a mirrored variant would need its own coordinates). Report the numbers and stop — do not silently drop variant-b support, and do not quietly move the zone on `tool-intro`, which is already shipped and in use.
- **The cover-crop makes the face leave the frame** on a real clip (head cropped at the chin/forehead). Report with an extracted frame; do not switch to letterboxing without saying so, because that changes the card's designed look.
- Any edit under `videos/**`, or to v1.

## Maintenance notes

- A future card opts into stage simply by declaring a `head_zone` — no pipeline change needed. That is the whole point of the contract.
- The reviewer should check that `planStageGeometry` is imported by BOTH `assemble.mjs` and `export-timeline.mjs`. If either recomputes geometry inline, the rendered video and the editor timeline will disagree, and nothing in the gates would catch it.
- History worth keeping in mind: plan 145 passed its gates with one step of five implemented. When reviewing this plan's PR, check the `grep` and pixel criteria specifically — a green `test_cmd` was not sufficient evidence last time.
