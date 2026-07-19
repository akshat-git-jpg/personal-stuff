---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 093: Effects layer — pluggable modules, per-video effects manifest, EFFECTS.md rulebook

## Summary

- **Problem statement**: All assembly effects (whips, flash+punch beats, drift, captions) are hardcoded inside `lib/assemble.mjs` (796 lines and growing with every effect). Adding an effect means editing the shared encode loop (three plans had to serialize over this one file in a single day); no per-instance control exists (flags are all-or-nothing); no doc owns the effects knowledge. The owner will keep adding effects and needs a fixed groove.
- **Goals**:
  1. `lib/effects/` registry — one module per effect (`whip.mjs`, `beats.mjs`, `drift.mjs`, `captions.mjs`) behind one interface; `assemble.mjs` becomes a host that never changes when an effect is added.
  2. `videos/<slug>/effects.json` manifest — every planned instance (id, type, time, params, `enabled`) written by `node lib/effects-plan.mjs <slug>`, committed, owner-editable; assemble re-plans deterministically and merges overrides by id.
  3. `EFFECTS.md` — rule surface #7 (per-effect: what/when/skip rules/knobs/reference provenance + "adding a new effect" recipe), registered in HANDOFF.md's "Where the rules live".
- **Executor proposed**: agy (Gemini 3.1 Pro High) — behavior-preserving refactor with a 127-test net + fully inlined interface; the LESSONS sweet spot.
- **Done criteria** (terse): `check.sh` exit 0; structural-identity regression (planned segments/transitions/beats on test-01 data identical pre/post refactor); disabling one instance via manifest changes exactly that boundary; EFFECTS.md exists and HANDOFF row added.
- **Stop conditions** (terse): any pixel-affecting behavior change; encode-loop semantics change beyond dispatching to modules; schema changes to cues/shots.
- **Test / verification for success**: existing suite unchanged + structural-identity fixture test + manifest override tests.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9f5fd51..HEAD -- pipelines/video/visuals-flow`

## Status

- **Priority**: P1 (owner-requested scalability; do BEFORE the next effect lands)
- **Effort**: M-L
- **Risk**: MED
- **Depends on**: none (089–092 all landed)
- **Category**: tech-debt
- **Difficulty**: standard
- **Planned at**: commit `9f5fd51`, 2026-07-19

## Why this matters

The owner's working mode is: watch a reference video → "add this effect" → iterate on taste. Five effects in, every addition rewrites the same encode loop in `assemble.mjs`, instance-level control doesn't exist (the owner cannot kill ONE flash), and the knowledge lives in five plan files instead of a rulebook. This plan converts effects from code surgery into data + one-module-per-effect, so effect #6 onward is: study reference → write one module + one EFFECTS.md row → instances appear in the manifest → owner reviews → render. The 060 feedback-fold then maintains EFFECTS.md exactly like the cue/shot rulebooks.

## Current state (verified at 9f5fd51, `pipelines/video/visuals-flow/`)

`lib/assemble.mjs` (796 lines) exports: `planSegments`, `planSegmentOverlays`, `absorbSlivers` (+`SLIVER_*`), `planTransitions` (+`TRANSITION_DUR`, `WHIP_SIGMAS`, `WHIP_ZOOM`), `planAvatarBeats`/`splitAvatarSegments` (+`BEAT_*`, `FLASH_*`, `PUNCH_SCALE`), `driftVF` (+`DRIFT_*`), `assemblyMd`, `encoderArgs`, `detectEncoder`, `runAssembly`, `CANVAS`, `ASSEMBLE_MEDIA_ROOT`. `runAssembly`'s flow: planSegments → absorbSlivers → splitAvatarSegments (beats) → planTransitions → planCaptions/caption-render.py (from `lib/captions.mjs`) → per-segment encode loop where: screen segments append `driftVF(...)` to their VF; flash/punch/caption/overlay contributions are built inline into a `-filter_complex` chain; whip transitions encode two extra half-segments after a `tOut` segment. Flags: `--transitions whip|none --beats on|off --captions on|off --drift on|off`. `lib/captions.mjs` (65 lines) has `planCaptions` + `CAP_*` constants; `lib/caption-render.py` renders PNG strips (this machine's ffmpeg has no drawtext — do not change that mechanism). Tests: `scripts/check.sh` runs 127 tests incl. per-planner unit tests and lavfi integration tests in `lib/assemble.test.mjs` + `lib/captions.test.mjs`.

Rule surfaces (HANDOFF.md "Where the rules live", rows 1–6) cover cue/shot judgment, DESIGN.md, catalog, lint constants, TESTS.md — no effects row.

## Design (decided — do not re-litigate)

### Extension points (the host calls exactly these; nothing else is pluggable)

1. **Base-track normalization** — `absorbSlivers` stays IN the host (it reshapes segmentation, it is not an effect).
2. **Instance planning** — each module plans its instances from a shared read-only context.
3. **Boundary segments** — a module may emit extra encoded segments at a boundary (whip's two blur halves).
4. **Per-segment contributions** — a module may contribute to a segment's encode: a `-vf` suffix (drift, punch), and/or filter_complex fragments with extra inputs (flash, captions).

### Module interface (inline — place as `lib/effects/` files; the host consumes exactly this shape)

```js
// lib/effects/whip.mjs (same shape for beats.mjs, drift.mjs, captions.mjs)
export const TYPE = 'whip';
export const CONSTANTS = { TRANSITION_DUR: 0.2, WHIP_SIGMAS: [10, 24], WHIP_ZOOM: 0.12 };

// ctx: { segments, overlays, words, resolved, total, w, h, VF }
// -> instances: [{ id, type: TYPE, at|segId, enabled: true, ...params }]
export function plan(ctx) { /* moved planTransitions logic */ }

// Called once per enabled instance whose `at` is a segment boundary.
// -> { extraSegments: [{ fileTag, sliceArgs, chain, dur }] } or null
export function boundarySegments(instance, ctx) { /* whip halves */ }

// Called once per segment with this module's enabled instances touching it.
// -> { vfSuffix?, inputs?: [...ffmpeg input args], chainFragments?: [(lastV, state) => ({ chain, nextV })] }
export function contribute(seg, instances, ctx) { /* drift/flash/captions */ }
```

`lib/effects/registry.mjs` exports `EFFECT_MODULES = [whip, beats, drift, captions]`. Modules NOT implementing a hook omit it. The host iterates the registry at each extension point — order fixed: overlays (host) → beats punch/flash → captions → (drift is vfSuffix on the base). Beat SPLITTING (`splitAvatarSegments`) moves into `beats.mjs`' `plan()` returning split instructions the host applies — the split changes segmentation, so the host applies it between absorb and transition planning, via a dedicated optional hook `transformSegments(segments, instances, ctx)` implemented ONLY by beats.

### Manifest

- `node lib/effects-plan.mjs <slug>` → `videos/<slug>/effects.json`:
  ```json
  { "video": "<slug>", "instances": [
      { "id": "whip-057.5", "type": "whip", "at": 57.5, "direction": "right", "enabled": true },
      { "id": "beat-138.9", "type": "beat", "at": 138.9, "punch": 1.08, "enabled": true },
      { "id": "drift-screen-02", "type": "drift", "segId": "screen-02", "direction": "in", "enabled": true },
      { "id": "captions", "type": "captions", "enabled": true, "fontPx": 44, "yFrac": 0.87 }
  ] }
  ```
  Instance ids are stable: `<type>-<at rounded to 0.1s>` or `<type>-<segId>`; captions is one global instance.
- **Merge rule (no staleness machinery)**: assemble ALWAYS re-plans deterministically, then merges the manifest by id: `enabled:false` disables that instance; recognized param overrides replace defaults; manifest entries whose id no longer matches are ignored with a console warning; new instances not in the manifest run with defaults. `effects-plan.mjs` regeneration preserves existing overrides by id. Missing effects.json = pure defaults (back-compat). `--effects off` CLI flag disables the whole layer (replaces nothing — the four existing flags stay working and map to disabling that module's instances).
- effects.json is committed (add to PIPELINE.md's `videos/<slug>/` layout list).

### EFFECTS.md (create at flow root; skeleton to fill — one section per effect)

```markdown
# EFFECTS.md — assembly effects rulebook (rule surface #7)

How step 090 decorates the base track. Instances are planned deterministically,
written to videos/<slug>/effects.json by `node lib/effects-plan.mjs <slug>`,
owner-editable per instance (enabled/params), merged by id at assemble time.

| Effect | What | Fires when | Skip rules | Knobs (module CONSTANTS) | Reference |
|---|---|---|---|---|---|
| whip | 0.2s blur-cut (gblur ramp out/in) | every screen↔avatar boundary | neighbor <1s, overlay straddle, video edges | TRANSITION_DUR, WHIP_SIGMAS, WHIP_ZOOM | youtu.be/7Ker2Vxs2yM 8:40 |
| beat (flash+punch) | orange screen-blend flash to white peak + alternating 1.0/1.08 punch | every ~20s inside avatar spans, snapped to word gaps/overlay cues | span <28s, <8s from edges | BEAT_*, FLASH_*, PUNCH_SCALE | same video 8:47 |
| drift | ≤5% Ken Burns push/pull (scale eval=frame) | screen segments ≥4s, alternating | <4s segments | DRIFT_MAX/MIN_SEG/PERIOD | whole reference |
| captions | Pillow PNG caption strips, bottom-center | screen segments only | — (ffmpeg has no drawtext — Pillow route) | CAP_* in captions.mjs | whole reference |

## Adding a new effect
1. Study the reference frame-by-frame (ffmpeg tile sheets) — mechanism, duration, blend space.
2. New `lib/effects/<name>.mjs` implementing plan() + the hook(s) it needs; constants at top.
3. Register in lib/effects/registry.mjs; add unit tests per existing module tests.
4. Add a row above + provenance; bump this file via the 060 fold thereafter.
5. Instances appear in effects.json on next `effects-plan` — owner reviews, renders.
```

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test gate (boss merge gate) | `bash scripts/check.sh` (from `pipelines/video/visuals-flow/`) | exit 0, `visuals-flow check OK` |
| Structural identity probe | (Step 1's inline node script) | `IDENTICAL` |
| Manifest smoke | `node lib/effects-plan.mjs test-01 && node -e "console.log(JSON.parse(require('fs').readFileSync('videos/test-01/effects.json','utf8')).instances.length)"` | ≥ 20 |

## Scope

**In scope**: `pipelines/video/visuals-flow/lib/assemble.mjs`, new `lib/effects/*.mjs`, new `lib/effects-plan.mjs`, `lib/captions.mjs` (only if moving constants), test files for all of the above, `EFFECTS.md` (new), `HANDOFF.md` (one rule-surface row), `PIPELINE.md` (layout row for effects.json), repo-root `decisions.md` (one dated line: effects layer architecture), `plans/README.md` row.

**Out of scope**: `lib/caption-render.py` (mechanism unchanged), `absorbSlivers`/`planSegments`/overlay compositing semantics, lint/resolve/board/render modules, any NEW effect, any board UI for the effects lane (future plan), `videos/test-01/**` except the newly generated `effects.json`.

## Git workflow

- Branch: `boss/093-effects-layer`
- Commit per step, conventional messages, no AI footers. Do NOT push.

## Steps

### Step 1: extract modules behind the registry (behavior-preserving)

Create `lib/effects/{registry,whip,beats,drift,captions}.mjs` per the interface; move the corresponding planners/constants/chain-builders out of `assemble.mjs`; rewrite `runAssembly`'s loop to consume the registry at the four extension points. Keep re-exports in `assemble.mjs` for every currently-exported symbol (tests and lint-shots import `planSegments`/`planTransitions` etc. from it — preserve those import paths; internal moves get re-exported). BEFORE the refactor, capture the baseline; AFTER, compare:

```bash
node --input-type=module -e "
const { planSegments, absorbSlivers, splitAvatarSegments, planTransitions } = await import('./lib/assemble.mjs');
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync('videos/test-01/resolved.json','utf8')).resolved;
const s = JSON.parse(fs.readFileSync('videos/test-01/shots.resolved.json','utf8')).spans.map(x=>({...x,kind:'avatar-full'}));
const words = JSON.parse(fs.readFileSync('videos/test-01/transcript.json','utf8'));
let segs = absorbSlivers(planSegments({resolved:r, avatarJobs:s, total:1927.588}));
segs = splitAvatarSegments(segs, words);
const trans = planTransitions(segs, []);
console.log(JSON.stringify({segs, trans}).length, require('node:crypto').createHash('sha1').update(JSON.stringify({segs,trans})).digest('hex'));
"
```
Store the pre-refactor hash in the run log; post-refactor output must print the SAME hash → `IDENTICAL`.

**Verify**: `bash scripts/check.sh` → exit 0 (all 127 existing tests, unmodified); identity probe hash unchanged.

### Step 2: effects-plan CLI + manifest merge

`lib/effects-plan.mjs <slug-or-path>` (follow `transcribe-groq.mjs` CLI conventions + `workdir.mjs`): builds ctx, calls every module's `plan()`, writes `effects.json` preserving overrides by id from an existing file. In `runAssembly`: load manifest if present, apply merge rule, honor `--effects off`. Tests (new `lib/effects.test.mjs`, added to check.sh): (a) plan→write→regen preserves an `enabled:false`; (b) a disabled whip instance removes exactly that boundary's extra segments (structural assert on the plan, no render needed); (c) a `fontPx` override reaches the captions contribution; (d) unknown-id manifest entry warns and is ignored; (e) missing effects.json = defaults.

**Verify**: `node --test lib/effects.test.mjs` → all pass; manifest smoke command → ≥20 instances.

### Step 3: docs

Create `EFFECTS.md` from the inlined skeleton (fill knob values from the module constants). HANDOFF.md: add row 7 to "Where the rules live" pointing at EFFECTS.md + `lib/effects/`. PIPELINE.md: add `effects.json` to the `videos/<slug>/` layout (committed). decisions.md: append `- 2026-07-19 — visuals-flow effects layer: effects are pluggable lib/effects/ modules + per-video effects.json manifest (owner-editable per instance) + EFFECTS.md rulebook; assemble.mjs is a host. Adding an effect never edits the encode loop (plan 093).`

**Verify**: `bash scripts/check.sh` → exit 0; `grep -c "EFFECTS.md" HANDOFF.md` → ≥1.

## Test plan

Existing 127 tests must pass UNMODIFIED in Step 1 (they are the behavior net); Step 2 adds the manifest suite; the identity probe pins structural equivalence on real test-01 data.

## Done criteria

- [ ] `bash scripts/check.sh` exits 0 with the new effects suite included.
- [ ] Identity probe hash identical pre/post refactor (recorded in run log).
- [ ] `effects.json` generated for test-01 (≥20 instances) and committed.
- [ ] Manifest override tests pass (disable-one-whip, param override, preserve-on-regen).
- [ ] EFFECTS.md + HANDOFF row + PIPELINE.md row + decisions.md line present.
- [ ] `plans/README.md` row 093 updated to DONE.

## STOP conditions

- Any existing test needs modification in Step 1 — that is a behavior change; stop and report which.
- The identity probe hash differs post-refactor — stop, do not "fix" the hash by re-baselining.
- The interface can't express an existing effect without a new extension point beyond the four listed — stop and report the mismatch.

## Maintenance notes

- Future effects: follow EFFECTS.md's recipe — one module + one row + tests; the host and this plan's interface are the contract. Board effects-lane is a separate future plan (instances are already data, so the lane is pure UI).
- The four legacy CLI flags stay as aliases; new granular control is the manifest. Deprecate flags only when the board lane exists.
- 060 fold: owner feedback about an effect's look updates the module's CONSTANTS + EFFECTS.md row together (same edit-both rule as prompt+RULEBOOK).
