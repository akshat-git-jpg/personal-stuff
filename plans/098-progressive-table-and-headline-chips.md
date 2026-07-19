---
executor: claude-p
model: opus
test_cmd: bash pipelines/video/card-library/scripts/beat-smoke.sh
ui: true
deploy:
needs: [097]
---

# Plan 098: progressive comparison table + headline-chips slate

## Summary

- **Problem statement**: The reference channel's two most-used fullframe graphics are missing from our library: a comparison table whose ROWS populate one-by-one as each product's numbers are spoken (`references/vPqSgj8Ta3Y.md` moment 12:20.0), and a canvas slate with a headline sentence plus icon chips ticking in per spoken item (moment 5:07.2).
- **Goals**: two new beat cards — `comparison/table-rows` (header + one table row per beat, pipe-separated cells) and `slate/headline-chips` (headline + one pill chip per beat) — cataloged, routable, passing gates.
- **Executor proposed**: claude-p / opus (novel-card authoring is Opus-class — HANDOFF "Model routing").
- **Done criteria** (terse): beat-smoke green (count → 14 after plan 097's 12), calibrate-clean rendering at declared caps, routing lines added, screenshots attached.
- **Stop conditions** (terse): beat_shape with pipe-cells rejected by resolve/lint → stop; design rules win.
- **Test / verification for success**: card gate + rendered-frame inspection against an explicit rubric.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a249173..HEAD -- pipelines/video/card-library pipelines/video/visuals-flow/steps/020-cue-pass-llm`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 097 (beat-count arithmetic in beat-smoke.sh; routing-section edits collide otherwise)
- **Category**: feature
- **Difficulty**: standard (taste-judged output — hence opus + ui screenshot)
- **Planned at**: commit `a249173`, 2026-07-19

## Why this matters

"Say numbers across products → the table builds row-by-row, in sync" is the
reference channel's core retention device for pricing/spec talk; the
headline+chips slate is its standard canvas beat for spoken lists ("you can't
create: short films / character videos / dialogue"). Both are beat cards — our
cue system's native shape — so they slot into the existing pipeline without
engine changes.

## Current state

Identical card contract, style rules, catalog conventions, gates, and
routing surfaces as plan 097's "Current state" — read that section first
(same commit). Additional facts for this plan:

- Existing `comparison/` family has `summary-table` and `feature-matrix`
  (kind: read their catalog entries before writing — they are SINGLE cards
  that appear all-at-once; this plan's card is the BEAT variant, a separate
  card, not an edit to them).
- Beat cards encode reveal text via `beat_shape: {"text":"string"}` with
  `max_reveal_chars`. For table rows this plan encodes CELLS in the beat text
  with a pipe separator: `"Seedance 2.0|15s|1080p|180 cr"`. The card splits
  on `|`; resolve/lint treat it as an opaque string (verify with the scratch
  round-trip in Step 3).
- After plan 097 the beat-card count in `scripts/beat-smoke.sh` is `12`; this
  plan lands two more beat cards → bump to `14`.
- `card-library/DESIGN.md` capacity-honesty rule: declared caps must actually
  fit at 1080p — the `/calibrate` board page renders every beat card at its
  caps; keep `max_beats` honest.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Card gate | `bash pipelines/video/card-library/scripts/beat-smoke.sh` | exit 0 |
| Flow gate | `bash pipelines/video/visuals-flow/scripts/check.sh` | exit 0 |
| Catalog valid | `cd pipelines/video/card-library && node -e "require('./catalog.json')"` | exit 0 |

## Scope

**In scope**:
- `pipelines/video/card-library/comparison/table-rows/index.html` (new)
- `pipelines/video/card-library/slate/headline-chips/index.html` (new, new `slate/` family dir)
- `pipelines/video/card-library/catalog.json` (2 entries)
- `pipelines/video/card-library/scripts/beat-smoke.sh` (count 12 → 14)
- `pipelines/video/visuals-flow/steps/020-cue-pass-llm/cue-pass-prompt.md` + `RULEBOOK.md` (routing lines, edited together)

**Out of scope**:
- `comparison/summary-table`, `comparison/feature-matrix` (untouched)
- resolver/lint/board/render code; effects modules; any existing card.

## Git workflow

- Branch: `advisor/098-progressive-table-and-headline-chips`
- Commit per step: `feat(card-library): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: comparison/table-rows card

Fullframe beat card on the standard dark-amber radial background (copy the
`#bg` + `#frame` scaffolding and palette from `checklist/checklist/index.html`).
Layout: title (64px 900), then a table panel (white 4% fill, 1px white 10%
border, radius 24): a header row (dim cream, uppercase, 22px, wide tracking)
rendered at card start, then one data row per beat. Row entrance: slide up
18px + fade 0.45s ease-out; the row's first cell (product name) lands white
700, remaining cells 400. Cell layout: CSS grid, column count driven by the
`columns` variable; rows split their beat `text` on `|` (trim each cell; if a
row has fewer cells than columns, leave trailing cells empty — never crash).

Variables + beat shape (catalog entry):

```json
{
  "slug": "comparison/table-rows",
  "kind": "beat",
  "placement": "fullframe",
  "purpose": "comparison table that builds one row per beat as each product's numbers are spoken; cells pipe-separated in beat text",
  "variables": {
    "title": "string",
    "columns": "array of strings — header cells, 2-4 columns"
  },
  "beat_shape": { "text": "string — pipe-separated cells, e.g. 'Kling 3.0|15s|1080p|30 cr'" },
  "default_duration": 10,
  "max_beats": 5,
  "max_reveal_chars": 44
}
```

Default `data-composition-variables` demo content: title "What you actually
pay", columns `["Model","Max length","Resolution","Cost (15s)"]`, 5 beats with
realistic pipe rows (use the values from the reference: Seedance 180cr, Kling
30cr, Veo 165cr, Grok 23cr, Wan 38cr — demo data only, appears nowhere else).

**Verify**: `cd pipelines/video/card-library && node -e "const c=require('./catalog.json').cards.find(x=>x.slug==='comparison/table-rows');console.log(c.kind,c.max_beats,c.max_reveal_chars)"` -> `beat 5 44`

### Step 2: slate/headline-chips card

Fullframe beat card, same scaffolding. Layout: headline sentence top-left area
(40px, 700, ≤2 lines, sentence case — this is a spoken line, not a title),
then a vertical stack of pill chips: icon circle (accent orange ring, simple
inline SVG glyph — dot/spark; no emoji) + label (30px 600) in a white-4% pill.
Chip entrance per beat: slide left→right 24px + fade 0.45s; icon pops 90%→100%
0.2s later (badge overshoot allowed). Headline enters at 0.1s regardless of
beats.

```json
{
  "slug": "slate/headline-chips",
  "kind": "beat",
  "placement": "fullframe",
  "purpose": "canvas beat: a spoken headline sentence plus pill chips ticking in one per beat (lists, consequences, criteria)",
  "variables": { "headline": "string" },
  "beat_shape": { "text": "string" },
  "default_duration": 8,
  "max_beats": 4,
  "max_reveal_chars": 34
}
```

**Verify**: `cd pipelines/video/card-library && node -e "require('./catalog.json')"` -> exit 0.

### Step 3: gates, routing, scratch round-trip

1. `scripts/beat-smoke.sh` count → `14`.
2. Routing lines in `cue-pass-prompt.md` "Choosing a card" + identical mirror
   in `RULEBOOK.md`:
   - "VO walks per-product numbers (price/specs) across 3+ products →
     `comparison/table-rows`, one beat per product row, cells pipe-separated,
     anchor each beat at that product's first spoken number."
   - "VO states a claim then lists items under it →
     `slate/headline-chips`: headline = the claim, one chip beat per listed
     item."
   - Add to the pricing-consolidation rule (already in the prompt): when the
     table card is used, do NOT also emit stat-hit cues for the same numbers.
3. Scratch round-trip proving the pipe convention survives resolve+lint:
   create `pipelines/video/visuals-flow/videos/scratch-098/` with a minimal
   `transcript.json` (copy the shape from `videos/test-01/transcript.json`,
   ~20 words) and a hand-written `cues.json` containing one `table-rows` cue
   (2 beats, pipe cells) and one `headline-chips` cue; run
   `node lib/resolve.mjs scratch-098 && node lib/lint-cues.mjs scratch-098`;
   expect exit 0 (lint warnings acceptable, errors not). DELETE the scratch
   dir afterwards — it must not land in the commit.

**Verify**: `bash pipelines/video/card-library/scripts/beat-smoke.sh` -> exit 0; `bash pipelines/video/visuals-flow/scripts/check.sh` -> exit 0; `git status --short pipelines/video/visuals-flow/videos/` -> empty.

### Step 4: visual proof (ui gate)

Render both cards at their DEFAULT variables AND once at max caps (5 pipe rows
× 44 chars; 4 chips × 34 chars) — the capacity-honesty check. Extract a frame
near the end of each render, LOOK at it, attach the 4 PNGs to the PR, delete
scratch renders. Rubric:

- [ ] nothing overflows or wraps at declared caps (shrink caps if it does — capacity honesty beats capacity)
- [ ] palette exact (amber bg, white/cream text, one orange accent; no new hues)
- [ ] Inter everywhere; sentence case except header cells/labels
- [ ] rows/chips appear one-by-one in the render (scrub two frames mid-card to confirm staggering)

**Verify**: 4 PNGs exist and are attached; each rubric line explicitly stated pass/fail in the PR body.

## Test plan

Card gate (count 14), flow gate, catalog validity, scratch resolve/lint
round-trip for the pipe-cell convention, rendered-frame inspection at default
AND cap content (rubric above).

## Done criteria

- [ ] Both cards exist, timelines registered, CONTENT/TIMELINE split respected
- [ ] `bash pipelines/video/card-library/scripts/beat-smoke.sh` exit 0 (count = 14)
- [ ] `bash pipelines/video/visuals-flow/scripts/check.sh` exit 0
- [ ] Scratch round-trip passed and scratch dir deleted
- [ ] Routing + pricing-consolidation lines in BOTH prompt and RULEBOOK, identical
- [ ] 4 inspection PNGs attached, rubric stated per line

## STOP conditions

- resolve/lint error on the pipe-cell beat text or on the `columns` variable — stop and report the exact error; do not patch resolver code.
- Caps don't fit at 1080p even after one reduction attempt (e.g. 5→4 rows) — stop and propose the honest cap in the report.
- Any edit needed outside the Scope list — stop.

## Maintenance notes

- The pipe-separator is a card-local convention; if a second card ever needs
  structured beats, promote a `beat_shape.cells` array in catalog + resolver
  instead of spreading the pipe hack.
- Expect the 060 fold to tune both cards' caps after the first real usage.
- Reference evidence: `references/vPqSgj8Ta3Y.md` moments 12:20.0 (table), 5:07.2 (slate).
