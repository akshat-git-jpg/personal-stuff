---
executor: claude-p
model:
test_cmd: cd pipelines/video/card-library && bash scripts/check-cards.sh && node scripts/card-qa.mjs enacted/pipeline-flow --check
ui: true
deploy:
needs: ["card-library only — no file overlap with 175/176/177/179 except scripts/overflow-probe.mjs, which 175 edits (one import line). Safe to run in parallel with all of them."]
---

# Plan 178: card-library type-scale and variant QA gates

## Summary

- **Problem statement**: Two card-library gates have blind spots that let the owner find the defect instead. The hero-to-body type ceiling only inspects selectors literally named `.row` or `.item`, so 17 of 55 fullframe cards exceed it invisibly. And `card-qa.mjs` renders a `max` contact sheet but never sets the a/b variant, so a card's tightest layout has never been photographed.
- **Goals**: Make both gates measure what they claim to measure.
- **Executor proposed**: claude-p, sonnet — mechanical once the contract is decided, but it touches many cards.
- **Done criteria** (terse): every fullframe card with body text declares `--body-size`; the gate measures against it; `card-qa` renders every declared variant at `max`.
- **Stop conditions** (terse): a card cannot satisfy the ratio without a design change.
- **Test / verification for success**: mutate a card to reintroduce each original defect and confirm the gate fails.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 802e7078..HEAD -- pipelines/video/card-library/scripts/`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Difficulty**: standard
- **Planned at**: commit `802e7078`, 2026-08-02

## Why this matters

Both gaps produced owner feedback on `best-ai-video-generator`, and in both cases a gate written for that exact complaint was already in place and simply looking in the wrong place.

**c01, the type cliff.** `tool-icon/tool-glass-tile` ran a 150px name over a 32px subtitle, 4.69x. `scripts/check-type-scale.mjs` has carried `HERO_RATIO_MAX = 4` since 2026-07-31, added from the complaint "heading very big, rest all very small". But the ceiling is applied only to font sizes found behind a selector matching `\.(?:row|item)\b`, and this card's descriptor is `#subtitle`. The same blind spot hides the 36px `ROW_MIN` floor. A sweep on 2026-08-02 found 17 of 55 fullframe cards over 4x with nothing named `.row` or `.item` to catch them, though many of those are legitimate eyebrows rather than real defects, which is exactly why a selector-name heuristic cannot decide this.

**c27, the unphotographed variant.** `enacted/pipeline-flow` hardcoded `body.variant-b .chain { height: 760px }` whatever the step count. With 3 steps the flex connectors absorbed 472px of slack and drew two ~236px bare lines, and 150px title + 64px margin + 760px chain overflowed the 840px padding box by 134px, so the frame's centering stopped working. `card-qa.mjs` builds a `max` variable set and calls `runVariant('max', maxVars)`, but `generateVariables` never emits a `variant` key, so the render always lands on the default `variant-a` in the body class. Variant B has never appeared in a contact sheet.

The immediate instances were fixed by hand on 2026-08-02. This plan closes the gates so the next one is caught by CI instead of by the owner.

## Current state

- `pipelines/video/card-library/scripts/check-type-scale.mjs` — `HERO_MIN`, `HERO_RATIO`, `HERO_RATIO_MAX`, `ROW_MIN`, `PROSE_MIN`, the `hero_shape` switch, and the two regexes scoped to `.row`/`.item`.
- `pipelines/video/card-library/scripts/card-qa.mjs` — `generateVariables(card, variant)` (line ~57), `runVariant` (line ~148), `runVariant('max', maxVars)` (line ~172).
- `pipelines/video/card-library/DESIGN.md` — the Typography section this gate enforces.
- `pipelines/video/card-library/catalog.json` — `hero_shape` and `variants` per card.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Type gate alone | `node scripts/check-type-scale.mjs` | `check-type-scale OK` |
| Full card gate | `bash scripts/check-cards.sh` | `card check OK` |
| Contact sheets | `node scripts/card-qa.mjs <slug>` | writes a sheet per variant |
| Survey the cliffs | see Step 1 | a triage table |

## Scope

**In scope**:
- A `--body-size` custom property contract for fullframe cards that have a readable secondary line.
- `check-type-scale.mjs` measuring hero against `--body-size` instead of guessing by selector name.
- `card-qa.mjs` rendering every entry in a card's `variants` at `max`.
- Updating the cards the new gate legitimately fails.
- The DESIGN.md paragraph describing the contract.

**Out of scope**:
- Changing `HERO_MIN`, `HERO_RATIO`, `HERO_RATIO_MAX` or `PROSE_MIN` values.
- Overlay cards. They are subordinate by design and the gate already skips them.
- Redesigning any card beyond what the ratio requires.

## Git workflow

- Branch: `advisor/178-card-library-type-and-variant-gates`
- Commit: `fix(cards): type-scale gate measures declared body size; card-qa shoots every variant` — no AI footers. Do NOT push.

## Steps

### Step 1: Survey before changing anything

Produce the triage table. For every fullframe card, list hero size, every other declared font size, and which of those is a genuine body/descriptor line versus an eyebrow, label or badge.

```bash
node -e "
const fs=require('fs'),path=require('path');
const cat=require('./catalog.json');
for(const c of (cat.cards||[]).filter(x=>x.placement==='fullframe')){
  const f=path.join('.',c.slug,'index.html'); if(!fs.existsSync(f))continue;
  const css=(fs.readFileSync(f,'utf8').split('</style>')[0]||'').replace(/\/\*[\s\S]*?\*\//g,'');
  const h=css.match(/--hero-size:\s*(\d+)px/); if(!h)continue;
  const sizes=[...css.matchAll(/([^{}]*)\{[^}]*?font-size:\s*(\d+)px/g)].map(m=>[m[1].trim().split('\n').pop().trim(),Number(m[2])]).filter(([,n])=>n!==Number(h[1]));
  console.log(c.slug, 'hero='+h[1], JSON.stringify(sizes));
}
"
```

Write the triage into the PR body. A size is a BODY size when a viewer is expected to read it as content (a descriptor, a tagline, a row, a table cell). It is a WHISPER size when it is an eyebrow, a category chip, a unit suffix or an index badge. Whisper sizes never cap the hero.

**Verify**: the table covers every fullframe card and classifies every non-hero size.

### Step 2: Declare `--body-size` on the cards that have body text

For each card whose triage row has at least one body size, add `--body-size: <px>` to `:root` next to `--hero-size`, and make the body element use `font-size: var(--body-size)`.

Cards with no body text at all (a bare title card, a `hero_shape: "none"` card) declare nothing and stay exempt.

**Verify**: `grep -L "body-size" $(node -e "…list of cards the triage says need one…")` prints nothing.

### Step 3: Rewrite the gate to measure the declaration

In `check-type-scale.mjs`, replace the `.row`/`.item` regexes with:

- If `--body-size` is declared: enforce `body >= ROW_MIN` and `HERO_RATIO <= hero/body <= HERO_RATIO_MAX`.
- If it is not declared: enforce nothing extra, but error if the card has three or more distinct non-hero font sizes, since that shape almost always means a body line went undeclared.
- Keep the existing `--hero-size` floor, the accent-colour rule and the em-tracking rule exactly as they are.
- Keep the `hero_shape: "none"` early-continue added 2026-08-02, and its comment.

**Verify**: `bash scripts/check-cards.sh` -> `card check OK`.

### Step 4: Mutation-proof the type gate

Reintroduce the original c01 defect and confirm the gate now catches it:

- In `tool-icon/tool-glass-tile/index.html`, set the subtitle back to `32px` and `--body-size: 32px`.
- `node scripts/check-type-scale.mjs` -> MUST fail with a 4.69x message.
- Revert.

**Verify**: the mutated run exits non-zero naming `tool-icon/tool-glass-tile`; the reverted run prints `check-type-scale OK`.

### Step 5: Make card-qa shoot every variant

In `card-qa.mjs`, when `card.variants` is a non-empty array, loop it and render `max` once per variant, writing `…-max-<variant>.png` and including each in the contact sheet with the variant named in its caption. When there are no variants, behave exactly as today.

Add a `--check` flag that fails when any rendered frame has content outside the safe area, so the script is usable as a `test_cmd`. Reuse whatever overflow probe already exists rather than writing a second one; if none exists, measure the rendered PNG for non-background pixels in the outer 40px border.

**Verify**: `node scripts/card-qa.mjs enacted/pipeline-flow` writes both an `a` and a `b` sheet, and the `b` sheet shows the vertical chain.

### Step 6: Mutation-proof the variant gate

- In `enacted/pipeline-flow/index.html`, set `body.variant-b .chain` back to `height: 760px` and remove the `--vb-node-h` block.
- `node scripts/card-qa.mjs enacted/pipeline-flow --check` -> MUST fail on the variant-b frame.
- Revert.

**Verify**: the mutated run exits non-zero; the reverted run passes.

### Step 7: Write the contract down

Add a short DESIGN.md paragraph under Typography: a fullframe card names its hero with `--hero-size` and its readable secondary line with `--body-size`; eyebrows, chips and badges are neither and stay undeclared; the gate enforces the spread between the two.

**Verify**: `bash scripts/check-cards.sh` -> `card check OK`.

## Test plan

Steps 4 and 6 are the real test: each reintroduces the exact defect the owner reported and requires the gate to go red. Everything else is covered by `check-cards.sh`, which runs the type gate, the catalog contract, the side contract and the logo gate.

## Done criteria

- [ ] Step 1's triage table is in the PR body and covers all 55 fullframe cards
- [ ] Every card the triage marks as having body text declares `--body-size`
- [ ] The gate no longer contains a `.row`/`.item` selector regex
- [ ] Step 4 mutation fails the gate and the revert passes it
- [ ] `card-qa.mjs` writes one `max` sheet per declared variant
- [ ] Step 6 mutation fails `--check` and the revert passes it
- [ ] `bash scripts/check-cards.sh` -> `card check OK`

## STOP conditions

- A card cannot meet the 2.5x-to-4x spread without a design change. Report it with its numbers rather than moving the constants.
- The overflow probe would need to become a full layout engine. Stop and re-plan; a border-pixel check is enough for this gate.
- Step 1's triage is ambiguous for more than about five cards. Bring the list back rather than guessing.

## Maintenance notes

- The 17 cards over 4x found on 2026-08-02 are NOT 17 bugs. Most are eyebrows. The whole point of `--body-size` is that the card, not a regex, says which text is content.
- `hero_shape: "none"` already exempts headless cards; do not fold `--body-size` into that switch.
