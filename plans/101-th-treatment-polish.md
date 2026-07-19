---
executor: agy
model:
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui:
deploy:
needs: [095, 100]
---

# Plan 101: TH treatment polish — cut-in/wipe-out asymmetry + static short spans (spec D3)

## Summary

- **Problem statement**: The reference grammar enters the host on a hard cut and leaves him on a wipe, and keeps short host bridges static; our whip fires symmetrically on screen↔avatar and our beats effect punches into every avatar span ≥ the interval. Spec D3 (owner-approved, explicitly vetoable after seeing it assembled): adopt the asymmetry and stop punching short spans.
- **Goals**: whip drops the `screen>avatar` pair (hard cut into the host); beats skips avatar segments shorter than 45s; EFFECTS.md rows updated.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — mechanical/standard, constants + one predicate.
- **Done criteria** (terse): check.sh green; routing/threshold unit tests pass; test-01 effects.json regenerates accordingly.
- **Stop conditions** (terse): scope is two modules + docs; anything else, stop.
- **Test / verification for success**: unit tests on plan() outputs; effects.json regen diff on test-01.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b406fe9..HEAD -- pipelines/video/visuals-flow/lib/effects/whip.mjs pipelines/video/visuals-flow/lib/effects/beats.mjs pipelines/video/visuals-flow/EFFECTS.md pipelines/video/visuals-flow/videos/test-01/effects.json`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 095 (whip.mjs pair logic lands there first — this plan edits the merged form), 100 (soft: regen diff reads cleaner after bubble instance exists)
- **Category**: feature
- **Difficulty**: mechanical
- **Planned at**: commit `b406fe9`, 2026-07-19

## Why this matters

Measured across all three reference videos: returns to the host are always
plain hard cuts, and host bridges of 10–30s are static — energy comes from
cutting away, not from zooming the host. Adopting both makes our assembled TH
moments read like the reference instead of fighting it.

## Current state

- `lib/effects/whip.mjs` — after plan 095 lands, `plan(ctx)` routes:
  `screen>avatar` / `avatar>screen` → `style:'blur'`; `*>graphic` →
  `style:'flash'`. This plan removes `screen>avatar` from the allowed pairs.
- `lib/effects/beats.mjs` — `plan(ctx)` iterates `seg.kind === 'avatar'`
  segments and lays flash+punch beats every `BEAT_INTERVAL: 20` seconds
  starting at `seg.start + BEAT_INTERVAL`, edges guarded by
  `BEAT_MIN_EDGE: 8`. A 45s span currently gets beats at +20s/+40s→(hi guard).
- `lib/whip.test.mjs` — exists after 095 (routing fixtures to extend).
- `EFFECTS.md` — whip and beats rows to update.
- `videos/test-01/effects.json` — regenerate via `node lib/effects-plan.mjs test-01`; manual overrides survive by id.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Flow gate | `bash pipelines/video/visuals-flow/scripts/check.sh` | exit 0 |
| Regen manifest | `cd pipelines/video/visuals-flow && node lib/effects-plan.mjs test-01` | exit 0 |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/effects/whip.mjs`, `lib/effects/beats.mjs`
- `pipelines/video/visuals-flow/lib/whip.test.mjs` (+ beats tests wherever beats' existing tests live — locate with `/usr/bin/grep -rln "BEAT_INTERVAL" lib/*.test.mjs`)
- `pipelines/video/visuals-flow/EFFECTS.md`
- `pipelines/video/visuals-flow/videos/test-01/effects.json` (regenerated)

**Out of scope**: everything else (assemble encode path, cards, rulebooks, lint).

## Git workflow

- Branch: `advisor/101-th-treatment-polish`
- Commit per step: `feat(visuals-flow): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: whip asymmetry

In `whip.mjs` `plan()`: remove `screen>avatar` from the whip pairs
(`isWhip = pair === 'avatar>screen'`). Flash pairs unchanged. Update
`lib/whip.test.mjs`: the screen→avatar fixture now expects NO instance; add a
comment-free assertion for avatar→screen still emitting `style:'blur'`.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/whip.test.mjs` -> exit 0.

### Step 2: beats minimum span

In `beats.mjs`: add `BEAT_MIN_SPAN: 45` to CONSTANTS; in `plan()`, right
after the `seg.kind !== 'avatar'` guard add
`if (seg.end - seg.start < CONSTANTS.BEAT_MIN_SPAN) continue;`.
Tests: a 30s avatar span → zero beat instances; a 60s span → beats present
(extend the existing beats test file found via the grep in Scope).

**Verify**: `bash pipelines/video/visuals-flow/scripts/check.sh` -> exit 0.

### Step 3: docs + regen

1. `EFFECTS.md`: whip row now says "avatar→screen and →graphic only; cuts
   INTO the host are hard by design (reference asymmetry)"; beats row gains
   `BEAT_MIN_SPAN` knob. Provenance: spec D3.
2. `node lib/effects-plan.mjs test-01` — regenerate; confirm screen>avatar
   whip instances disappeared and beats on short spans disappeared, manual
   fields on surviving ids preserved (compare with `git diff` on the file —
   removed instances are expected, changed surviving ones are not).

**Verify**: `git diff --stat pipelines/video/visuals-flow/videos/test-01/effects.json` shows the file changed; `/usr/bin/grep -c "screen>avatar" pipelines/video/visuals-flow/lib/effects/whip.mjs` -> `0`.

## Test plan

Routing unit tests (whip pairs, beats span threshold) + regen diff review on
test-01 + full check.sh. Owner sees the result at the next test-01 `--draft`
watch — spec marks D3 vetoable there; a veto reverts via this plan's two
commits.

## Done criteria

- [ ] check.sh exit 0
- [ ] whip: no `screen>avatar` instances; avatar>screen + flash unchanged (tests prove)
- [ ] beats: spans <45s get zero beats (tests prove)
- [ ] EFFECTS.md rows updated; effects.json regenerated with overrides preserved

## STOP conditions

- 095 not yet merged when this plan starts (whip.mjs lacks the `style` field) — stop and report; do not re-implement 095.
- Regen changes fields on SURVIVING instances (override-preservation regression) — stop with the diff.

## Maintenance notes

- If the owner vetoes D3 after the draft watch, revert = drop the two feature commits; constants make a partial keep easy (e.g. keep BEAT_MIN_SPAN, restore the whip pair).
- Spec: `docs/specs/2026-07-19-mode-structure-density-design.md` (D3).
