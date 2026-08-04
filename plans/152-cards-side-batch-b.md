---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/card-library && bash scripts/check-cards.sh && node scripts/check-catalog.mjs && node scripts/check-side.mjs
ui: true
deploy:
needs: ["151 must land first — it defines the contract, the gate and card-qa --side"]
---

# Plan 152: card-library side conversion — batch B (27 dense cards)

## Summary

- **Problem statement**: Plan 151 established the side-ready contract and converted the 21 cards that reflow cleanly. The remaining 27 fullframe cards — comparison, enacted, verdict, pros-cons — are the dense ones, all still `side: false`. The owner asked for every card to support side mode where it honestly can.
- **Goals**:
  - Convert the 27 batch-B cards to the side-ready contract where the layout survives it.
  - Where a card genuinely cannot survive 1200px without shrinking type, keep `side: false` and record WHY, so the decision is documented rather than silently inherited.
  - Leave the count of side-incapable cards visible and justified.
- **Executor proposed**: `claude-p` / `sonnet` — per-card reflow is visual judgment that cannot be fully inlined (`tooling/boss/data/rules.md`).
- **Done criteria** (terse — full list below): all three gate commands exit 0; every one of the 27 cards has an inspected `--side` contact sheet; every remaining `side: false` card carries a written reason in the PR body.
- **Stop conditions** (terse — full list below): do not touch `visuals-flow/`; never shrink type to fit; no `side: true` without a rendered frame.
- **Test / verification for success**: `scripts/check-side.mjs` plus a render-and-inspect pass per card against plan 151's 6-point rubric.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 525d5ba..HEAD -- pipelines/video/card-library/`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plan 151
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `525d5ba`, 2026-07-25

## Why this matters

These 27 are where side mode either becomes genuinely useful or quietly stalls. A comparison table narrated by the host is exactly the moment side mode exists for — but a 12-column feature matrix at 1200px is also the most likely card to break. Getting an honest answer per card matters more than a high conversion count: the owner's constraint is that graphics quality must not degrade, so `side: false` on a card that truly needs the full canvas is a **correct** result, not a shortfall.

The failure mode to avoid is the opposite of laziness — over-converting. A card forced to fit by dropping a column, shrinking a font, or truncating a label has been damaged to serve the avatar, which is precisely what the owner refused.

**Read `plans/runs/LESSONS.md` 2026-07-24 first**: twelve cards once shipped as title-only stubs with every gate green. `check-cards.sh` and `check-side.mjs` are content-blind. The rendered contact sheet is the only real evidence here.

## Current state

Plan 151 has already landed and provides everything this plan consumes:

- `DESIGN.md` → `## Side-ready cards (side avatar mode)` — the 4-rule contract.
- `catalog.json` → a REQUIRED boolean `side` on all 48 fullframe cards; batch A is `true`, batch B is `false`.
- `scripts/check-side.mjs` → fails if a `side: true` card contains `1920px` or has lost its `data-width="1920"` anchor.
- `scripts/card-qa.mjs <slug> --side` → renders the card at 1200×1080 (min + max variable variants) and writes a two-up contact sheet.
- Plan 150's `rewriteCanvas` in the pipeline rewrites **only** `data-width`, never CSS — which is why rule 1 (no hardcoded `1920px`) is load-bearing.

Re-read the contract in `DESIGN.md` before starting; do not re-derive it from this plan.

### The 27 cards

| Family | n | Slugs |
|---|---|---|
| comparison | 12 | `bar-chart`, `billing-discount`, `checkout-summary`, `comparison-storm-cascade`, `comparison-tier-list`, `feature-matrix`, `head-to-head`, `pricing-tiers`, `savings-stacker`, `summary-table`, `credits-math`, `table-rows` |
| enacted | 9 | `fill-gauge`, `race-bars`, `counter-tally`, `pipeline-flow`, `before-after`, `spotlight-focus`, `timeline-scrub`, `terminal-enact`, `promise-split` |
| verdict | 5 | `verdict-badges`, `verdict-report-card`, `verdict-trophy`, `winners-podium`, `persona-match` |
| pros-cons | 1 | `pros-cons` |

### Expected difficulty per family (guidance, not a verdict — the render decides)

- **verdict** and **enacted** are mostly single-hero layouts (a badge, a gauge, a counter, a podium). These should reflow like batch A.
- **comparison** is the hard family. Two-column head-to-heads can usually stack vertically. Wide matrices (`feature-matrix`, `summary-table`, `table-rows`) have a real minimum width — a table whose columns must all stay visible is the canonical `side: false` case.
- `before-after` and `head-to-head` are semantically side-by-side; stacking them vertically may still read correctly, but check that the comparison is still legible as a comparison.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Structural card check | `cd pipelines/video/card-library && bash scripts/check-cards.sh` | exit 0 |
| Catalog schema check | `cd pipelines/video/card-library && node scripts/check-catalog.mjs` | exit 0 |
| Side contract gate | `cd pipelines/video/card-library && node scripts/check-side.mjs` | exit 0 |
| Render at side width | `cd pipelines/video/card-library && node scripts/card-qa.mjs <slug> --side` | contact sheet PNG path |
| Render at full width (regression) | `cd pipelines/video/card-library && node scripts/card-qa.mjs <slug>` | contact sheet PNG path |
| Count remaining incapable cards | `cd pipelines/video/card-library && node -e "const c=require('./catalog.json');console.log(c.cards.filter(x=>x.placement==='fullframe'&&!x.side).length)"` | a falling number |

## Scope

**In scope**:
- The 27 batch-B card `index.html` files listed above
- `pipelines/video/card-library/catalog.json` — flipping `side` to `true` for cards that pass
- `pipelines/video/card-library/DESIGN.md` — ONLY to append per-family notes if a family needs a documented pattern

**Out of scope**:
- `pipelines/video/visuals-flow/**` — plan 150 owns the pipeline
- `scripts/check-side.mjs`, `scripts/card-qa.mjs`, `scripts/check-catalog.mjs` — plan 151 owns them; if one needs a change, that is a STOP condition
- The 21 batch-A cards — already converted
- Overlay-placement cards — side mode is fullframe-only

## Git workflow

- Branch: `advisor/152-cards-side-batch-b`
- Commit per family: `cards: side-ready <family> (<n> cards)` — no AI footers. Do NOT push.

## Steps

### Step 1: Re-read the contract

Read `DESIGN.md` → `## Side-ready cards (side avatar mode)` and plan 151's 6-point inspection rubric (reproduced below). Everything in this plan follows them; do not invent a different standard.

**Inspection rubric** — score every card at 1200×1080, any FAIL means fix or set `side: false`:

| # | Check | FAIL looks like |
|---|---|---|
| 1 | No text is cut off at any edge | a word runs past the right edge or is clipped |
| 2 | No two elements overlap | text sits on top of a panel border or another element |
| 3 | Type is the same size as the full-canvas render | text visibly smaller than the 1920 sheet |
| 4 | Nothing is horizontally squashed | logos/icons non-square, text condensed |
| 5 | The layout still reads as designed | elements bunched in a corner, huge empty band, broken alignment |
| 6 | The `max` variable variant fits, not just `min` | the longest strings overflow |

**Verify**: `cd pipelines/video/card-library && grep -c "Side-ready cards" DESIGN.md` -> `1`

### Step 2: Convert `verdict` (5 cards)

For each of `verdict/verdict-badges`, `verdict/verdict-report-card`, `verdict/verdict-trophy`, `verdict/winners-podium`, `verdict/persona-match`:

1. Replace hardcoded `1920px` on `html`, `body`, `#root` with `100%`. Height stays `1080px`.
2. Make fixed content `max-width` values relative, or ≤1080px.
3. Re-stack wide arrangements: rows → columns, N-up → fewer-up with wrapping. **Never reduce a `font-size`.**
4. `node scripts/card-qa.mjs <slug> --side` and READ the sheet against the rubric.
5. Regression: `node scripts/card-qa.mjs <slug>` — confirm the full-width render is unchanged.
6. Pass → set `"side": true` in `catalog.json`. Fail → revert the HTML changes, keep `side: false`, and write the reason down for the PR body.

**Verify**: `cd pipelines/video/card-library && node scripts/check-side.mjs && node scripts/check-catalog.mjs` -> exit 0

### Step 3: Convert `enacted` (9 cards)

Same procedure for `enacted/fill-gauge`, `race-bars`, `counter-tally`, `pipeline-flow`, `before-after`, `spotlight-focus`, `timeline-scrub`, `terminal-enact`, `promise-split`.

Extra care: enacted cards carry **animation keyed to layout** (bars that fill to a width, counters that scale, a pipeline that traverses). After reflowing, confirm the motion still plays correctly at 1200px — a bar whose fill target was a hardcoded px width will animate to the wrong place. Check the contact sheet frame is taken mid-motion, not at t=0.

**Verify**: `cd pipelines/video/card-library && node scripts/check-side.mjs && node scripts/check-catalog.mjs` -> exit 0

### Step 4: Convert `comparison` (12 cards) + `pros-cons` (1)

Same procedure for the 12 comparison slugs and `pros-cons/pros-cons`.

This is where `side: false` is most likely to be the right answer. Apply the rubric strictly:

- A two-column comparison that stacks vertically and still reads as a comparison → `side: true`.
- A table that needs 4+ columns visible simultaneously → almost certainly `side: false`. Do not drop columns, truncate headers, or shrink type to force it.

For every card left at `side: false`, write one line naming the specific rubric check it failed.

**Verify**: `cd pipelines/video/card-library && node scripts/check-side.mjs && node scripts/check-catalog.mjs` -> exit 0

### Step 5: Full gate and the final tally

**Verify**: `cd pipelines/video/card-library && bash scripts/check-cards.sh && node scripts/check-catalog.mjs && node scripts/check-side.mjs && node -e "const c=require('./catalog.json');const f=c.cards.filter(x=>x.placement==='fullframe');console.log(f.filter(x=>x.side).length+' side-capable / '+f.length+' fullframe');console.log('incapable: '+f.filter(x=>!x.side).map(x=>x.slug).join(', '))"` -> exit 0 from all three gates, and a printed tally

## Test plan

- **Structural**: `check-side.mjs` proves no `side: true` card retains a hardcoded 1920px canvas or has lost its `data-width` anchor.
- **Schema**: `check-catalog.mjs` proves every fullframe card still carries an explicit boolean `side`.
- **Visual**: one `card-qa --side` contact sheet per card, scored against the 6-point rubric — the only real verification.
- **Regression**: every converted card re-rendered at full width and confirmed visually unchanged, because these cards keep serving non-side cues.
- **Motion** (enacted only): confirm layout-keyed animation still lands correctly at 1200px.

## Done criteria

- [ ] `bash scripts/check-cards.sh` exits 0
- [ ] `node scripts/check-catalog.mjs` exits 0
- [ ] `node scripts/check-side.mjs` exits 0
- [ ] All **27** batch-B cards have an inspected `--side` contact sheet; the PR body lists each with PASS or `side: false` + the specific rubric check it failed
- [ ] Every card converted to `side: true` also has a full-width contact sheet confirming no regression
- [ ] No `font-size` was reduced anywhere: `git diff --name-only 525d5ba..HEAD -- '*/index.html'` reviewed and no shrunk font-size in the diff
- [ ] The final tally is printed and recorded in the PR body
- [ ] `git diff --name-only 525d5ba..HEAD` lists only paths from the In-scope list

## STOP conditions

- **Any file under `pipelines/video/visuals-flow/` needs editing.** Plan 150 owns the pipeline. Stop and report.
- **`check-side.mjs`, `card-qa.mjs` or `check-catalog.mjs` appears to need a change.** Plan 151 owns those. If the gate is genuinely wrong, stop and report rather than editing it to pass — a gate edited to accommodate the work it gates is worthless.
- **A card only fits by reducing a font-size, dropping a column, or truncating a label.** That is the quality loss the owner explicitly refused. Set `side: false` and move on.
- **`card-qa --side` cannot render.** Never mark a card `side: true` from reading its CSS. Without a rendered frame there is no evidence — stop and report.
- **More than 12 of the 27 end up `side: false`.** That is over half the batch and suggests the contract or the 1200px split is wrong, not the cards. Stop and report with the list and reasons.

## Maintenance notes

- The permanent tally command is the thing to watch over time: `node -e "const c=require('./catalog.json');const f=c.cards.filter(x=>x.placement==='fullframe');console.log(f.filter(x=>x.side).length+'/'+f.length)"`. Any new fullframe card must make a deliberate `side` call — `check-catalog.mjs` enforces it.
- Cards left `side: false` are a standing design backlog, not a permanent verdict. A future redesign of `feature-matrix` or `summary-table` into a stackable form would unlock the comparison family, which is where side mode is most valuable narratively.
- Enacted cards are the ones to scrutinise on review: their animation is keyed to layout, so a reflow that looks right in a still frame can still animate wrong. The contact sheet must be sampled mid-motion.
- If side mode's split ratio is ever retuned away from 1200/720, every `side: true` card needs re-inspection — the contract is relative, but the rubric was scored at 1200px specifically.
