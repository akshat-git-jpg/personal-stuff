---
executor: agy
model:
test_cmd: cd pipelines/video/card-library && npm run check
ui: true
deploy:
needs: []
---

# Plan 143: living cards — ambient-motion contract + variants for the overused four

## Summary

- **Problem statement**: cards finish their entrance/reveals in the first 1–3 seconds and then freeze — on test-01, keyword-statement sits static ~4 of its 5s, title-aurora-wave ~11s, tool-intro ~5 of 6s ("motion graphic stays static on screen while audio keeps playing" — owner, 2026-07-24). And the same four legacy cards repeat with identical looks (3× keyword-statement, 3× tool-intro, 4× callout, 2× tip-banner in 19 cues) because legacy cards have no variants.
- **Goals**: (1) a "never dead on screen" ambient-motion contract in DESIGN.md; (2) retrofit ambient idle motion onto the 12 enacted cards + the 10 most-used legacy cards; (3) `variants: ["a","b"]` implemented for the overused four legacy cards; (4) contract enforced by a static grep-able marker + card-QA note.
- **Executor proposed**: agy (Gemini 3.1 Pro High) — ui:true, render+inspect gate applies (verifier renders and LOOKS; the executor never self-certifies visuals).
- **Done criteria**: `npm run check` green; every touched card carries the `hf-ambient` marker; two sample renders show motion in their final second.
- **Stop conditions**: ambient motion breaks hyperframes seek-determinism on any card; any behavior change to reveals/timing.
- **Test / verification for success**: card-library gate + frame-extract comparison on sample renders (last-second frames must differ).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. Do NOT
> edit `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat cbb1cbb..HEAD -- pipelines/video/card-library`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `cbb1cbb`, 2026-07-24

## Why this matters

Loop Studio scenes are never inert: after the headline lands something keeps breathing — that continuous life is a large share of "their video looks better." v2's captions/SFX add inter-cue motion at assembly, but the card ITSELF must stay alive for its whole exposure, especially now that `extendExposure`/`GAP_ABSORB` (plans 135/142) lengthen fullframe holds. Static held frames + longer holds = worse, not better, until this lands.

## Current state

- Cards: `pipelines/video/card-library/<family>/<name>/index.html` — self-contained Hyperframes HTML; animation via GSAP/CSS driven by the composition clock (seek-deterministic: any `t` must render the same frame). DESIGN.md owns the visual contract; README.md §"Beat contract" owns timing rules (`data-duration` uniform per file; reveals from `DATA.beats.forEach`; defaults must reproduce the 6s gallery look).
- Gate: `cd card-library && npm run check` (check-cards.sh: catalog + logos + card QA); per-card lint `npm run lint -- <family>/<name>/index.html`.
- Catalog metadata since plan 137: optional `variants: ["a","b"]` (card reads variable `variant`, default `"a"`); the v2 resolver auto-rotates variants (plan 138) — legacy cards just don't declare/implement any yet.
- Most-used legacy cards (from test-01 + the v1 catalog): `statement/keyword-statement`, `section/tool-intro`, `overlay/callout`, `overlay/tip-banner`, `overlay/stat-hit`, `overlay/lower-third`, `slate/kinetic-sentence`, `section/bullet-points-highlighted`, `checklist/icon-pills`, `title/title-aurora-wave`.
- Palette tokens (DESIGN.md): `--bg-from #3a1f08`, `--bg-to #0a0805`, `--accent #fb923c`, text/dim tokens — ambient treatments must stay inside this system.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Gate | `cd pipelines/video/card-library && npm run check` | exit 0 |
| Lint one card | `cd pipelines/video/card-library && npm run lint -- statement/keyword-statement/index.html` | clean |
| Render sample | `cd pipelines/video/card-library && npx --yes hyperframes@0.7.62 render statement/keyword-statement/index.html /tmp/ks.mp4` | mp4 written |
| Motion proof | `ffmpeg -y -i /tmp/ks.mp4 -sseof -1.2 -frames:v 1 /tmp/a.png && ffmpeg -y -i /tmp/ks.mp4 -sseof -0.2 -frames:v 1 /tmp/b.png && python3 -c "import hashlib;a=hashlib.md5(open('/tmp/a.png','rb').read()).hexdigest();b=hashlib.md5(open('/tmp/b.png','rb').read()).hexdigest();print('MOVING' if a!=b else 'STATIC')"` | `MOVING` |

## Scope

**In scope** (all in `pipelines/video/card-library/`):
- `DESIGN.md` (ambient-motion contract section), `README.md` (variants note for legacy retrofits)
- `index.html` of: the 12 `enacted/*` cards, and the 10 legacy cards listed above (ambient motion)
- `index.html` + `catalog.json` entries of the overused four (`statement/keyword-statement`, `section/tool-intro`, `overlay/callout`, `overlay/tip-banner`): add `variants: ["a","b"]`
- `scripts/card-qa.mjs` — add the `hf-ambient` marker presence check for the touched card list (data list inline in the script)

**Out of scope**: any visuals-flow(-2) pipeline file; the other ~30 untouched cards (contract applies to them at their next edit, not in this plan); reveal/beat timing of any card; `overlay/label-plate` (already authored under the contract era) unless it fails the motion proof.

## Git workflow

- Branch: `advisor/143-cards-ambient-motion-variants`. Commit per card group. Do NOT push.

## Steps

### Step 1: the contract (DESIGN.md)

Append section "Ambient motion — never dead on screen": every fullframe card must keep subtle continuous motion for its ENTIRE duration after the last reveal; overlay cards for their whole visible life. Approved treatments (pick per card, stay subtle):
- **breathe**: scale 1.000→1.012 on the main group, 6s, ease sine, alternate;
- **bg-drift**: the radial gradient origin drifts ±2% position, 12s loop;
- **accent-pulse**: the single accent element's glow/opacity 0.85→1.0, 4s;
- **float**: hero element translateY ±4px, 7s.
Rules: motion must be seek-deterministic (pure function of t — CSS animations/GSAP timelines are; `Math.random()`/rAF-accumulators are not); never louder than the entrance; never on body text. Marker: the implementing style/timeline block carries the comment `/* hf-ambient */` exactly once per card (machine-checkable).

**Verify**: `grep -n "Ambient motion" pipelines/video/card-library/DESIGN.md` → present.

### Step 2: retrofit the 22 cards

For each of the 12 enacted + 10 legacy cards: add ONE ambient treatment (breathe or float on the hero group + optionally bg-drift), running from t=0 to the card's full duration (CSS `animation ... infinite` is fine — it survives the duration rewrite). Do not touch reveal timelines, defaults, or `data-duration`. Include the `/* hf-ambient */` marker.

**Verify** (per batch of ~5 cards): `npm run lint` clean on each; after all 22, the motion-proof command on TWO samples (`statement/keyword-statement`, `enacted/fill-gauge`) → `MOVING` for both.

### Step 3: variants for the overused four

Implement `variant` `"a"|"b"` on keyword-statement, tool-intro, callout, tip-banner: `b` = mirrored layout/alignment + opposite entrance direction (and for tool-intro, logo right instead of left). Same content contract, same duration, same palette. Add `"variants": ["a","b"]` to their catalog entries. `data-composition-variables` defaults keep `variant: "a"` so the gallery look is unchanged.

**Verify**: `npm run lint` clean ×4; `python3 -c "import json;c=json.load(open('pipelines/video/card-library/catalog.json'));print(sum(1 for x in c['cards'] if x.get('variants')==['a','b'] and not x['slug'].startswith('enacted/')))"` → 4.

### Step 4: enforce the marker

`scripts/card-qa.mjs`: add a check — for every slug in an inline `AMBIENT_REQUIRED` list (the 22 retrofitted + 13 plan-137 cards), its index.html must contain `/* hf-ambient */`; fail otherwise. (List-based so the other legacy cards aren't retroactively failed.)

**Verify**: `npm run check` → exit 0; temporarily strip the marker from one card → check fails → restore.

## Test plan

card-library gate (catalog/logos/QA incl. the new marker check), per-card hyperframes lint, and the frame-hash motion proof on two rendered samples. Verifier additionally renders 2–3 cards and LOOKS (ui:true).

## Done criteria

- [ ] `cd pipelines/video/card-library && npm run check` → exit 0
- [ ] `grep -rl "hf-ambient" pipelines/video/card-library --include=index.html | wc -l` ≥ 22
- [ ] Motion-proof `MOVING` on both samples
- [ ] Catalog: the overused four carry `variants: ["a","b"]`
- [ ] Gallery defaults unchanged (spot-check: `npm run serve` cards look right — verifier screenshot)

## STOP conditions

- Ambient motion breaks seek-determinism on any card (hyperframes lint or visibly different frames at the same t across two renders) — report the card, don't ship a rAF hack.
- Any change to a card's reveal timing, variables contract, or duration.

## Maintenance notes

- New cards inherit the contract via DESIGN.md + the card-qa list (add each new slug to AMBIENT_REQUIRED).
- The remaining ~30 legacy cards get the treatment opportunistically at their next touch — extend the list then.
- If a future brand wants stiller cards, ambient amplitudes belong in brand.json tokens — not hardcoded removals.
