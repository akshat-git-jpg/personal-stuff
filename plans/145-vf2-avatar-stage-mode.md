---
executor: agy
model:
test_cmd: cd pipelines/video/card-library && npm run check && cd ../visuals-flow-2 && bash scripts/check.sh
ui: true
deploy:
needs: []
---

# Plan 145: avatar `stage` mode — the head composited INTO a card's designed head zone

## Summary

- **Problem statement**: v2's avatar presentation modes are full, floating `panel` PIP, corner bubble, and hidden. Loop Studio's flagship treatment — the head composited INTO the designed motion-graphics scene, sharing one art-directed frame with the content — is missing (owner ask + decisions.md 2026-07-24).
- **Goals**: (1) catalog contract `head_zone` (a card-declared reserved region); (2) shots gain `mode: "stage"` (span must overlap a fullframe cue whose card declares a head_zone — linted); (3) assemble composites the avatar clip into the zone (rounded rect, keyline, zone-sized); (4) FCPXML export keeps the staged clip a movable lane item with matching transform; (5) one new `section/host-stage` card + `head_zone` retrofit on `section/tool-intro`.
- **Executor proposed**: agy (Gemini 3.1 Pro High); ui:true — verifier renders/composites and LOOKS.
- **Done criteria**: both gates green; a fixture stage-span plans/composites; rendered sample inspected.
- **Stop conditions**: geometry can't survive the duration-rewrite staging; any v1 edit.
- **Test / verification for success**: pure-planning unit tests + one lavfi composite smoke + verifier frame inspection.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step; run every verification. If a STOP condition occurs, stop and report. Do NOT edit `plans/README.md`. `videos/test-01/` may exist untracked (live review) — never stage/edit/delete anything under `videos/`.
>
> **Drift check (run first)**: `git diff --stat 49ce96d..HEAD -- pipelines/video/visuals-flow-2 pipelines/video/card-library`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (135's panel mode landed; mirrors its shape)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `49ce96d`, 2026-07-24

## Why this matters

Panel/bubble put the host ON TOP of content as a floating sticker; Loop Studio's craft signature is the host INSIDE the designed scene — a card built around a head slot, so talking-head moments look art-directed rather than composited. This is the highest-leverage remaining avatar option (owner: "include all the additional options Loop Studio had").

## Current state

- Shots schema (`pipelines/video/visuals-flow-2/PIPELINE.md`): spans `{id, kind:"avatar-full", mode: "full"|"panel", from_anchor, to_anchor, note, flagged}`; `lib/resolve-shots.mjs` validates/passes `mode`; `lib/lint-shots.mjs` exempts panel from the full-screen budget and blocks avatar-span overlaps; `lib/shot-constants.mjs` holds `PANEL_WIDTH_FRAC 0.28`, `PANEL_INSET_PX 32`, `PANEL_RADIUS_PX 24`.
- Panel compositing precedent in `lib/assemble.mjs`: panel spans skip `planSegments`' base replacement and join the overlay path — scaled, rounded-rect alpha via `geq`, overlaid bottom-right with an enable window. The rounded-rect alpha expression and the overlay wiring are the exemplar for stage mode (read the panel branch before coding).
- FCPXML: `lib/export-timeline.mjs` writes panel clips on the avatar lane with `<adjust-transform scale=... position=.../>` — reuse for stage.
- Catalog metadata precedent (`card-library/scripts/check-catalog.mjs`): optional per-card fields validated when present (`register`, `variants`, `continuity`, ...). `continuity` already reserves a documented zone — `head_zone` follows the same pattern but with explicit geometry.
- Card exemplar for a new section card: `section/tool-intro/index.html` (+ its catalog entry: index/total/logo/name/tagline/tag).
- Avatar clips: `videos/<slug>/avatar-jobs.json` job entries carry `id/start/end/file` (kb-scratch mp4s of the host).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Card gate | `cd pipelines/video/card-library && npm run check` | exit 0 |
| v2 gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |
| Composite smoke | `ffmpeg -f lavfi -i color=c=black:s=1920x1080:d=2 -f lavfi -i testsrc=s=480x480:d=2 -filter_complex "[1]format=yuva444p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(lt(hypot(max(abs(X-W/2)-(W/2-24),0),max(abs(Y-H/2)-(H/2-24),0)),24.5),255,0)'[a];[0][a]overlay=x=100:y=100" -f null - 2>&1 \| tail -1` | exit 0 |

## Scope

**In scope**:
- `card-library/`: `scripts/check-catalog.mjs` (head_zone validation), `catalog.json` (head_zone on `section/tool-intro` + the new card), `section/host-stage/` (new card), `README.md` (head_zone contract docs)
- `visuals-flow-2/`: `PIPELINE.md` (schema), `lib/resolve-shots.mjs`, `lib/lint-shots.mjs`, `lib/shot-constants.mjs`, `lib/assemble.mjs`, `lib/export-timeline.mjs` + their tests, `steps/070-shot-pass-llm/shot-pass-prompt.md` + `RULEBOOK.md`, `scripts/check.sh` if a test file is added

**Out of scope**: v1; board display of stage spans (existing avatar lane suffices); HeyGen render mechanics (stage reuses the same clips); `videos/**`.

## Git workflow

- Branch: `advisor/145-vf2-avatar-stage-mode`. Commit per step. Do NOT push.

## Steps

### Step 1: `head_zone` catalog contract

`check-catalog.mjs` accepts optional `head_zone: { x, y, w, h, radius? }` — fractions of the 1920×1080 canvas (0–1, w/h > 0, x+w ≤ 1, y+h ≤ 1; radius px int, default 24). Document in card-library README beside `continuity`: "the card leaves this region visually clear; assemble composites the host into it during `stage` avatar spans." Add to `section/tool-intro`'s entry: `"head_zone": { "x": 0.60, "y": 0.28, "w": 0.30, "h": 0.53 }` and adjust that card's layout minimally so the region is clear in BOTH variants (verify by render + frame look, not assumption).

**Verify**: `npm run check-catalog` exit 0; a deliberately-bad zone (x+w>1) fails.

### Step 2: the `section/host-stage` card

New card purpose-built as a host frame: left side = eyebrow + `title` (heading) + up to 3 `points` (array of {label} chips revealed as beats), right side = the head_zone (a keylined rounded-rect placeholder region ~`{x:0.58,y:0.20,w:0.34,h:0.60}`, subtle inner glow, empty — assemble fills it). Kind beat, fullframe, register/variant/marker/ambient per the standard contracts (copy scaffolding from an enacted card). Catalog entry carries the head_zone + intent ("host makes a point to camera while chips land") / anti_intent ("no avatar footage exists for the span").

**Verify**: `npm run lint -- section/host-stage/index.html` clean; render + extract a frame at t=3 → layout correct, zone visually empty (verifier looks).

### Step 3: shots schema + lint

- `PIPELINE.md`: `mode` enum grows to `"full" | "panel" | "stage"`; a stage span additionally documents: it must be fully inside ONE fullframe cue whose card has a `head_zone`.
- `lib/resolve-shots.mjs`: accept `stage`.
- `lib/lint-shots.mjs`: **E**: a stage span not fully covered by a single fullframe cue with a head_zone card (pass resolved.json + catalog in — mirror how panel checks receive context). Stage spans are budget-exempt like panel. Warn when a stage span outlives its cue.
- `lib/shot-constants.mjs`: `STAGE_HEAD_RADIUS_PX: 24` (+ rule prose).
- `steps/070-shot-pass-llm/shot-pass-prompt.md` + RULEBOOK: when to pick each mode — full (host IS the content), stage (host + designed points share the frame — prefer over panel when a host-stage/tool-intro cue is planned there), panel (host reacts over live demo), bubble baseline (always-on corner). One short paragraph each.

**Verify**: `node --test lib/resolve-shots.test.mjs lib/lint-shots.test.mjs` pass (add stage fixtures: valid, uncovered-error, budget-exempt).

### Step 4: assemble compositing

In `lib/assemble.mjs`, stage spans follow the panel overlay path with zone-driven geometry: for the covering cue's card, scale the avatar clip to `round(head_zone.w*W/2)*2 × round(head_zone.h*H/2)*2` (cover-crop to the zone aspect: scale up + crop center), rounded-rect alpha with `radius` (same geq exemplar), overlay at `x=head_zone.x*W, y=head_zone.y*H`, enabled for the span window. Catalog + resolved are already loaded — resolve the zone by cue lookup.

**Verify**: unit test on the exported stage-geometry planner (pure: span+cue+zone → {w,h,x,y,crop}); composite smoke from the table exits 0.

### Step 5: FCPXML export

Stage clips ride the avatar lane with `<adjust-transform>` scale/position computed from the zone (panel code is the exemplar). Lane item name `stage:<span-id>`.

**Verify**: `node --test lib/export-timeline.test.mjs` pass (stage fixture emits transform matching the zone).

### Step 6: gates + inspection

**Verify**: both test_cmd directories green. Render `section/host-stage` and attach the frame to the PR (ui:true); verifier confirms the zone stays clear and the tool-intro retrofit didn't break its layout.

## Test plan

Pure planning/geometry unit tests; catalog validation tests; lavfi composite smoke; rendered-frame inspection by the verifier (the stub-scandal rule: no existence-only checks).

## Done criteria

- [ ] Both gates green; new tests registered and passing
- [ ] `grep -n "stage" lib/resolve-shots.mjs lib/lint-shots.mjs lib/assemble.mjs lib/export-timeline.mjs` → implemented in all four
- [ ] catalog: `section/host-stage` + `section/tool-intro` carry valid `head_zone`
- [ ] PR carries rendered frames of host-stage (both variants) — zone clear, layout intact

## STOP conditions

- The duration-rewrite staging or variant-b mirror makes a fixed head_zone geometrically wrong (zone would need per-variant coordinates) — report with the numbers; do not silently drop variant-b support.
- Any edit to v1 or under `videos/`.

## Maintenance notes

- Owner picks modes on the storyboard (plan 146 shows mode labels on the avatar lane); the 060 fold tunes the prompt's mode-choice guidance.
- Future cards opt in by declaring `head_zone` — no pipeline change needed.
