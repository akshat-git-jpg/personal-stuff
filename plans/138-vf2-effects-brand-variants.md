---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
ui: true
deploy:
needs: [after 137-vf2-enacted-cards]
---

# Plan 138: v2 effects vocabulary + brand tokens + variant rotation + motif lane

## Summary

- **Problem statement**: v1 ships only 5 assembly effects (whip, beats, captions, drift, bubble) — too thin a palette for "always something going on" without bespoke; palette/fonts are hardcoded per card (no per-channel re-skin); repeated template use looks copy-pasted; the through-line motif has no rendering surface (spec deltas F + G + C's motif/captions mechanisms).
- **Goals**: (1) register-switch transition style driven by concept.json; (2) `brand.json` tokens injected into staged card HTML at render time; (3) variant rotation in the resolver + back-to-back lint; (4) optional per-video persistent motif overlay lane; (5) captions confirmed as a default-on lane.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — owner directive; visual output passes the render+inspect gate.
- **Done criteria**: check.sh green with new/extended tests; brand injection proven by a staged-HTML assertion; rotation proven by fixture.
- **Stop conditions**: card-library edits needed beyond reading; ffmpeg transition smoke fails.
- **Test / verification for success**: `node --test` fixtures; lavfi smoke for the new transition.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. Do NOT
> edit `plans/README.md`; report status in your run summary.
>
> **Drift check (run first)**: `git diff --stat 3bbaa6c..HEAD -- pipelines/video/visuals-flow-2`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 134, 135 (video.json manifest), 136 (concept.json), 137 (cards expose `variant`/`register` variables)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `3bbaa6c`, 2026-07-24

## Why this matters

Richness must come from deterministic machinery, not per-video LLM spend (owner constraint). Loop Studio derives every scene's look from one `brand.json` and keeps its motif alive as ONE persistent keyframed element; template systems additionally need anti-samey rotation, which bespoke never worries about. Everything here is zero tokens per video.

## Current state (paths in `pipelines/video/visuals-flow-2/`)

- Effects are pluggable modules: `lib/effects/registry.mjs`:
  ```js
  import * as whip from './whip.mjs'; import * as beats from './beats.mjs';
  import * as drift from './drift.mjs'; import * as captions from './captions.mjs';
  import * as bubble from './bubble.mjs';
  export const EFFECT_MODULES = [whip, beats, captions, drift, bubble];
  ```
  Module shape (see `lib/effects/drift.mjs`, 38 lines — the exemplar): `TYPE`, `CONSTANTS`, `plan(ctx) -> instances[{id,type,...,enabled:true}]`, optional `contribute(seg, instances, ctx) -> {vfSuffix,...}` / `transformSegments`. `lib/effects-plan.mjs` composes defaults into `videos/<slug>/effects.json` `{video, approved, instances[]}` preserving per-instance `enabled` overrides; any default change resets `approved` (canonical-JSON comparison). `ctx` = `{segments, overlays, words, resolved, total, w, h, VF}`.
- Transitions: `lib/effects/whip.mjs` (blur/flash wipe) with `CONSTANTS.TRANSITION_DUR`, planned at segment boundaries.
- Render staging: `lib/render.mjs` copies a card dir to a temp stage, rewrites `data-duration`, writes `vars.json` (logos inlined via `lib/logos-inline.mjs` — the in-repo exemplar for HTML injection at stage time). FX clips render via `lib/render-fx.mjs` (transparent ProRes for the FCPXML FX lane).
- Cards read palette via `:root` CSS vars (card-library DESIGN.md contract): `--bg-from`, `--bg-to`, `--text`, `--text-dim`, `--accent` (+ positive/negative/gold literals).
- Variant/register card variables exist since plan 137 (`variant: "a"|"b"`, `register: "dark"|"light"`).
- concept.json (plan 136): `registers: [{from_anchor, to_anchor, register}]`; resolved spans are computable via `findPhrase` (lint-concept already resolves them).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Gate | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |
| Transition smoke | `ffmpeg -f lavfi -i testsrc=d=2:s=320x180:r=30 -vf "fade=t=out:st=0.8:d=0.2:c=black,fade=t=in:st=1.0:d=0.2" -f null - 2>&1 \| tail -1` | exit 0 |

## Scope

**In scope** (all in `pipelines/video/visuals-flow-2/`):
- `lib/effects/whip.mjs` (register style), `lib/effects/motif.mjs` (new), `lib/effects/registry.mjs`
- `brand.json` (new, folder root), `lib/brand-inline.mjs` (new) + test, `lib/render.mjs`, `lib/render-fx.mjs`
- `lib/resolve.mjs` (variant rotation) + test, `lib/cue-constants.mjs`, `lib/lint-cues.mjs`, `lib/lint.test.mjs`
- `lib/effects-plan.mjs` (motif + register-transition planning inputs), `EFFECTS.md`, `scripts/check.sh`, `PIPELINE.md`

**Out of scope**: card-library (cards already read `:root` vars — injection happens in staged copies only); board UI (140); sound (139); v1.

## Git workflow

- Branch: `advisor/138-vf2-effects-brand-variants`. Commit per step. Do NOT push.

## Steps

### Step 1: brand.json + stage-time injection

`brand.json` at the v2 folder root, defaults mirroring DESIGN.md exactly:

```json
{
  "name": "default",
  "tokens": {
    "--bg-from": "#3a1f08", "--bg-to": "#0a0805",
    "--text": "#ffffff", "--text-dim": "rgba(255,239,219,0.6)",
    "--accent": "#fb923c"
  },
  "caption": { "keywordColor": "#fb923c" }
}
```

`lib/brand-inline.mjs`: `injectBrand(html, brand) -> html` — inserts `<style id="brand-tokens">:root{...tokens...}</style>` immediately before `</head>` (after any existing styles, so it wins the cascade); export `loadBrand(root, videoManifest)` — reads `brand.json`, and if `videoManifest.brand` names a different brand, looks for `brands/<name>.json` beside it (error if missing). Wire into `lib/render.mjs` and `lib/render-fx.mjs` staging (call alongside the existing logos-inline step). Captions keyword color: pass `brand.caption.keywordColor` into `lib/captions.mjs`'s keyword-highlight color (find the current hardcoded orange there and thread it as a parameter with this default).

Tests (`lib/brand-inline.test.mjs`, register in check.sh): injection lands before `</head>` and after existing `<style>`; tokens rendered verbatim; unknown named brand errors.

**Verify**: `node --test lib/brand-inline.test.mjs` → pass; `grep -n "brand-inline" lib/render.mjs lib/render-fx.mjs` → wired in both.

### Step 2: variant rotation + lint

`lib/resolve.mjs#resolveCues`: track per-card use count; when the catalog entry has `variants` (non-empty array) and the cue doesn't set `variables.variant` explicitly, assign `variables.variant = variants[useCount % variants.length]` (useCount = how many prior cues used this card). Explicit values are respected and still advance the count.

`lib/cue-constants.mjs` + `lib/lint-cues.mjs`: **W9** — two CONSECUTIVE cues (by start time, any placement) with the same `card` AND same resolved `variant` warn "rotate the variant or vary the device". Constant `VARIANT_REPEAT_WINDOW: 1` with rule prose; regenerate prompt via `node lib/build-prompt.mjs`.

Tests: rotation a→b→a across three uses; explicit variant respected; W9 fires on back-to-back same-card-same-variant, quiet when variants differ.

**Verify**: `node --test lib/resolve.test.mjs lib/lint.test.mjs && node lib/check-rulebook.mjs` → pass.

### Step 3: register-switch transition

`lib/effects/whip.mjs`: add `style: 'register'` transitions — `plan` gains access to `ctx.conceptSpans` (array `{start, end, register}`; `lib/effects-plan.mjs` computes it by resolving concept.json anchors with `findPhrase` against `ctx.words`, empty when concept.json absent). At each boundary between a dark and a light span, plan one `{type:'whip', style:'register', at:<boundary>, direction: dark→light ? 'lift' : 'drop'}` instance. `contribute` renders it as a 0.4s dip: fade-out 0.2s to black (`drop`) or to white at 12% over warm `#3a1f08` (`lift` — implement as fade to black both directions if the white-lift needs a second filter pass; the DIRECTION difference may land as TODO constant, the dip itself must work). Keep existing whip planning untouched.

Test (`lib/whip.test.mjs` extend): register transitions planned exactly at span boundaries; none when concept absent.

**Verify**: `node --test lib/whip.test.mjs` → pass; lavfi transition smoke from the table → exit 0.

### Step 4: motif overlay lane (optional per video)

Contract (document in `EFFECTS.md` + `PIPELINE.md`): if `videos/<slug>/motif/index.html` exists (a small transparent Hyperframes composition authored when the concept pass is escalated to bespoke — usually NOT present), it renders once at full video duration to `renders/motif.mov` (transparent, via the render-fx pipeline) and composites as a top overlay lane for the whole video; FCPXML export puts it on its own lane named `motif`.

`lib/effects/motif.mjs`: `plan(ctx)` → one instance `{id:'motif', type:'motif', start:0, end:ctx.total, enabled:true}` when the composition dir exists (thread `ctx.workdir` into effects-plan's ctx), else none. `contribute` overlays `renders/motif.mov` across every segment (mirror how overlay movs composite in `lib/assemble.mjs#planSegmentOverlays` — motif joins the overlays list in assemble's input building rather than filter hacking, if that is simpler; pick the path that reuses `planSegmentOverlays`). Register the module LAST in registry.mjs after bubble (draw order: motif above captions is wrong — order it BEFORE captions so captions stay top; adjust the registry comment accordingly).

Tests: instance planned only when dir exists; overlay window covers [0, total].

**Verify**: `node --test lib/effects.test.mjs` (extend it) → pass.

### Step 5: captions = default-on lane (confirm + document)

Confirm `lib/effects/captions.mjs#plan` emits enabled-by-default instances covering narration; if it requires opt-in anywhere (check `lib/effects-plan.mjs` and EFFECTS.md), flip the default to ON with per-video kill remaining via `effects.json` `enabled:false`. Document in EFFECTS.md: "captions are a default-on lane (spec delta C); disable per video in effects.json".

**Verify**: `node --test lib/effects.test.mjs` → pass; `grep -n "default-on" EFFECTS.md` → present.

### Step 6: register + gate

check.sh gains `lib/brand-inline.test.mjs`. EFFECTS.md documents the new modules/styles.

**Verify**: `bash scripts/check.sh` → exit 0.

## Test plan

Pure planning tests per module (drift.mjs pattern), staged-HTML string assertions for brand injection, lavfi smoke only for filter syntax. No renders in tests.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` → exit 0
- [ ] `grep -n "brand-tokens" lib/brand-inline.mjs` → present; wired into render + render-fx
- [ ] `grep -n "W9" lib/lint-cues.mjs` → present; `node lib/check-rulebook.mjs` → exit 0
- [ ] `grep -n "register" lib/effects/whip.mjs` → style implemented; `ls lib/effects/motif.mjs` → exists
- [ ] EFFECTS.md documents register transitions, motif lane, captions default-on, brand.json

## STOP conditions

- Brand injection cannot win the cascade without editing card HTML (would break the "cards untouched" contract) — report with the failing card.
- concept-span resolution requires changing lint-concept's public shape.
- Any card-library or v1 edit.

## Maintenance notes

- Per-channel brands = drop `brands/<name>.json` + set `video.json` `brand` — no code.
- The motif lane is the seam for the full persistent-motif treatment; today it's per-video opt-in bespoke.
- Board (140) must preview brand tokens the same way (reuse `lib/brand-inline.mjs` on its card iframes).
