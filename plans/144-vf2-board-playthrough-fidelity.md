---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
ui: true
deploy:
needs: []
---

# Plan 144: v2 board play-through fidelity — captions/FX sim, real SFX preview, gap behavior, extendExposure save bug

## Summary

- **Problem statement**: the storyboard tab's play-through misrepresents the video (owner judged v2 "same as v1" partly off these artifacts): gaps snap to a bare text panel, cards freeze at their timeline end while audio runs, the caption/FX simulator exists only on the legacy `/list` page, the plan-140 SFX WebAudio preview is an inert checkbox, the master player ignores the plan-139 mix, and `handleSave` rewrites resolved.json WITHOUT `extendExposure` — silently dropping the orange-screen fix on every board save (a real data bug, not just preview).
- **Goals**: (1) fix the handleSave/extendExposure bug; (2) port the caption+FX simulator into the storyboard play-through; (3) wire the SFX preview for real (WebAudio, honoring the existing toggle); (4) gap behavior: keep a screen-footage placeholder + countdown chip instead of the text-panel snap; (5) master player prefers `master.wav` when present; (6) an `accepted` toggle on audit chips (writes `accepted: true` into audit.json — pairs with plan 142's gate).
- **Executor proposed**: agy (Gemini 3.1 Pro High) — ui:true; screenshots required; verifier looks.
- **Done criteria**: check.sh green; save-path unit test proves durations survive; endpoints serve; screenshots show captions+FX during play-through and a gap placeholder.
- **Stop conditions**: simulator port requires restructuring board.mjs's page dispatch; determinism issues.
- **Test / verification for success**: pure-function unit tests for the save path + gap model; serve smokes; verifier screenshots.
- **Open points for plan readiness**: none.

> **Executor instructions**: **Read `lib/board.mjs` fully before coding** — all line references below are against the plan-140 state at commit `cbb1cbb`; verify each anchor with grep before editing. Follow this plan step by step; run every verification. If a STOP condition occurs, stop and report. Do NOT edit `plans/README.md`. `videos/test-01/` may exist untracked (live run) — never stage/edit/delete anything under `videos/`.
>
> **Drift check (run first)**: `git diff --stat cbb1cbb..HEAD -- pipelines/video/visuals-flow-2/lib/board.mjs pipelines/video/visuals-flow-2/lib/resolve.mjs`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (139/140 landed; coexists with 142 — different files except PIPELINE.md prose)
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `cbb1cbb`, 2026-07-24

## Why this matters

The board is the owner's judging surface; when it can't show captions, effects, sound, or true exposure, v2 output is judged as bare v1 cards — which is exactly what happened on test-01's first run (2026-07-24). And the save bug quietly regresses the pipeline's headline fix (background exposure) the moment the owner edits anything on the board.

## Current state (all in `pipelines/video/visuals-flow-2/`; line anchors from the 2026-07-24 board review — re-verify with grep)

- **Save bug**: `handleSave` recomputes cues via `resolveCues(...)` and rewrites `resolved.json` (board.mjs ~1357, ~1471-1474) but never calls `extendExposure`; `resolve.mjs` applies it only in its own `main()` (~318). `extendExposure(resolved, {base, total})` is exported (resolve.mjs ~276-292); `base` comes from `loadVideoManifest(workdir)` (lib/video-manifest.mjs), `total` = last transcript word end + 1.0.
- **Play-through**: one continuous `<audio id="master" src="/vo.mp3">` (board.mjs ~1033) + a `timeupdate` handler picking the active block from `BLOCK_TIMES` (~1155-1174): gap blocks (kind `gap`, built at ~606-620, ~685) become active and `reveal()` swaps the TEXT panel in, parking the card iframe; for cue tiles it posts `{t: t - start}` into the iframe — clock model is consistent (slices cut at cue.start for cue.duration, `ensureSlices` ~156-187; `beats[].at` relative to cue.start).
- **FX/caption simulator** exists ONLY on the `/list` page: `#fxStage` markup ~843-851 + animation loop ~873-930 (context tinting, `fx-flash`/`fx-whipblur`/`fx-punch`, live caption text, bubble). The storyboard tab renders effects as static lane chips only (~981-986, ~1056).
- **SFX preview**: `<input type="checkbox" id="sfxToggle" checked>` (~1036) is wired to NOTHING; sound-lane markers at ~1057-1062. `sound.json` instances: `{id, at, sample, semi, gainDb, enabled}` (plan 139); samples at `assets/sfx/<sample>.wav`.
- **Audit chips** render per cue (~631-637). `audit.json` items: `{id, verdict, fix}` (+ optional `accepted` after plan 142).
- Mix artifacts (plan 139, when present): `<kb-workdir>/master.wav`; kb workdir root `~/kb-scratch/video/visuals-flow-2/<slug>/`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |
| Serve | `node lib/board.mjs test-01` (or any fixture workdir) | URL printed |
| SFX route smoke | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4322/sfx/pop.wav` | `200` |

## Scope

**In scope** (all in `pipelines/video/visuals-flow-2/`):
- `lib/board.mjs`, `lib/board.test.mjs`
- `steps/040-storyboard-review-owner/README.md`, `PIPELINE.md` (behavior notes)
- `scripts/check.sh` only if a new test file is added (prefer extending board.test.mjs)

**Out of scope**: `lib/resolve.mjs` (already exports what's needed), lint/prompt surfaces (plan 142), card-library (143), sound planning (139), v1, `videos/**`.

## Git workflow

- Branch: `advisor/144-vf2-board-playthrough-fidelity`. Commit per step. Do NOT push.

## Steps

### Step 1: fix the save bug (data first)

In `handleSave`, after `resolveCues` succeeds, apply the same post-pass `resolve.mjs main()` does: `extendExposure(resolved, { base: loadVideoManifest(workdir).base, total: words[words.length-1].end + 1.0 })` before writing resolved.json (import both; reuse the words already loaded in the save path). Extract the shared "resolve + extend" composition into an exported helper in board.mjs OR call the two functions inline — but add a unit test either way.

Test (board.test.mjs): a save-path fixture (two fullframes 8s apart, base none) → written durations are the EXTENDED ones (first reaches the second's start).

**Verify**: `node --test lib/board.test.mjs` → pass.

### Step 2: gap behavior in play-through

In the `timeupdate` block-selection: when the active block is a gap, do NOT `reveal()` the text panel. Instead show a dedicated play-through placeholder in the preview panel: a dim `#0a0805` frame with the label `screen recording` + a countdown chip `next graphic in <n>s` (computed from the next cue tile's `data-start`) + the gap's transcript snippet in small dim text. Clicking a gap block in the LIST/lanes still opens its text panel as today (that behavior is for reading/feedback, unchanged).

Test: exported pure `playthroughView(BLOCK_TIMES-like array, t)` → `{kind:'cue'|'gap', id, nextStart?}` covering boundaries.

**Verify**: `node --test lib/board.test.mjs` → pass; manual: during play-through a gap shows the placeholder, not the text panel.

### Step 3: captions + FX in the play-through

Port the `/list` simulator (~843-930) into the storyboard tab's preview panel as an overlay layer on top of the card iframe/gap placeholder, driven by the SAME master `timeupdate` clock: live caption text (from the captions effect's plan — same source `/list` uses), flash/punch/whip pulses at their effects.json instance times, context tinting. Keep it clearly a simulation (the existing "timing preview, not final pixels" framing from the effects-lane design, decisions.md 2026-07-20 — label it `sim` in a corner chip). Reuse the `/list` code by extracting the shared simulator into one function both pages embed — do not fork a second copy.

**Verify**: manual play-through shows captions rolling word-by-word and an fx pulse at a whip instance; `/list` page unchanged.

### Step 4: real SFX preview + master.wav

- New routes: `GET /sfx/<sample>.wav` (serves `assets/sfx/`, 404 on traversal — sanitize the name to `[a-z0-9_-]+`), and `GET /master-audio` → serves `<kb-workdir>/master.wav` when present else 404.
- Wire `#sfxToggle`: on play-through, prime an `AudioContext`, `fetch`+`decodeAudioData` each distinct enabled sample from `sound.json` once, and schedule/trigger a `BufferSource` when the master clock crosses each instance's `at` (apply `gainDb` via a GainNode; `semi` may be ignored in preview — note that in the UI title). Toggle off = no triggers.
- Master player source: use `/master-audio` when it returns 200 (probe once at page init), else `/vo.mp3`; when master.wav is used, suppress the WebAudio SFX triggers by default (the mix already contains them) — the toggle then re-enables raw-VO+WebAudio mode.

**Verify**: SFX route smoke → 200; with a sound.json fixture, play-through audibly ticks (manual); toggle silences them.

### Step 5: audit `accepted` toggle

Each audit chip on a cue block gets an `accept` button (visible only for `labelled` verdicts): POST `/audit-accept {id, accepted}` → toggles `accepted: true|removed` on that item in `audit.json`. This is the owner-side pair of plan 142's gate. Board never edits verdicts/fixes.

Test: exported `toggleAuditAccepted(audit, id, accepted)` pure function.

**Verify**: `node --test lib/board.test.mjs` → pass.

### Step 6: docs + gate + screenshots

Update `steps/040-storyboard-review-owner/README.md` (play-through = simulation layer; SFX preview semantics; accept button; master.wav preference) and PIPELINE.md's 040 row. Screenshots for the PR: (a) play-through mid-cue with captions + sim chip visible, (b) gap placeholder with countdown, (c) an audit chip with the accept button.

**Verify**: `bash scripts/check.sh` → exit 0.

## Test plan

Pure-function tests for the save path, gap model, and audit toggle; route smokes for /sfx and /master-audio; the visual layer is verified by screenshots + the verifier's own serve-and-look pass (ui:true).

## Done criteria

- [ ] check.sh green
- [ ] Save-path test proves extended durations survive a board save
- [ ] Play-through: captions/FX sim visible, gaps show placeholder + countdown, SFX audible with toggle honored (manual + screenshots)
- [ ] `/sfx/<sample>.wav` 200 with sanitization (path-traversal attempt → 404)
- [ ] `/master-audio` served when the mix exists, master player prefers it
- [ ] Audit accept button writes `accepted: true` to audit.json

## STOP conditions

- The simulator extraction forces changes to `/list` behavior beyond moving code — report.
- WebAudio scheduling drifts >150ms from the master clock in practice — ship the toggle defaulted OFF and report, don't chase sub-frame sync in a preview.
- Any edit under `videos/` or outside the Scope list.

## Maintenance notes

- The sim layer is deliberately approximate; the Final Cut tab remains the true-pixels surface.
- If plan 142 lands first, audit.json already documents `accepted` — no coordination needed (this plan only toggles the field).
- Keep `/sfx` name-sanitization when the kit grows.
