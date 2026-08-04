---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/card-library && bash scripts/check-cards.sh && node scripts/check-catalog.mjs && node scripts/check-side.mjs
ui: true
deploy:
needs: ["150 must land first — it defines the side geometry and consumes the catalog `side` flag"]
---

# Plan 151: card-library side contract + convert batch A (21 cards)

## Summary

- **Problem statement**: Plan 150 adds a `side` avatar mode where the motion-graphics card renders into a 1200×1080 left column. All 49 fullframe cards hardcode a 1920×1080 canvas, so none of them can do it. The owner's constraint is explicit: the graphics must not lose quality to accommodate the host — no shrinking, no squashing.
- **Goals**:
  - Define the side-ready card contract in `DESIGN.md` and enforce it with a gate, not with hope.
  - Add a `side` boolean to `catalog.json`, REQUIRED on every fullframe card so the decision is deliberate for all 49.
  - Delete the `host-stage` card and `tool-intro`'s `head_zone` (stage mode is gone as of 150).
  - Convert **batch A** — the 21 cards whose layouts reflow cleanly (title, section, statement, slate, tool-icon, prompt, checklist, table-of-contents, process).
- **Executor proposed**: `claude-p` / `sonnet` — per-card reflow is a visual judgment that cannot be fully inlined (`tooling/boss/data/rules.md`, "plan can't be fully inlined" row).
- **Done criteria** (terse — full list below): all three gate commands exit 0; every fullframe card has an explicit `side` boolean; all 21 batch-A cards render at 1200×1080 with a frame extracted and inspected for clipping/overlap.
- **Stop conditions** (terse — full list below): do not touch `visuals-flow/`; do not shrink type to make a card fit; do not mark a card `side: true` without a rendered frame proving it.
- **Test / verification for success**: `scripts/check-side.mjs` (new, structural), plus a render-and-inspect pass per card via `card-qa.mjs --side` with a written rubric.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 525d5ba..HEAD -- pipelines/video/card-library/`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plan 150 (defines side geometry, consumes the `side` flag)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `525d5ba`, 2026-07-25

## Why this matters

The owner's words: *"I don't want to suffer the quality of the motion graphics just because we have a side avatar. The motion graphic also should look good."* That rules out the cheap option (scale the whole 1920 card down ~0.58× into the column — every bit of type renders at 58% and dense cards go unreadable).

So a side-ready card must genuinely **reflow**: type stays at its designed size, elements re-stack, nothing is squashed. That is a real per-card design change, and some cards will not survive it — a 12-column feature matrix has a minimum width. Those declare `side: false` and the shot pass simply cannot put a side span over them (plan 150's E6 lint enforces it).

**Read this before starting** — `plans/runs/LESSONS.md`, 2026-07-24: *"plan 137's crew shipped all 12 enacted cards as 76-line title-only stubs and every gate passed: check-cards/lint/existence checks are content-blind. Card plans need a rendered-frame inspection gate (extract frames at beat times and LOOK)."* This plan is the same shape and the same trap. `check-cards.sh` passing means nothing about whether a card looks right at 1200px. The render-and-inspect step is not optional ceremony; it is the only real verification here.

Related, LESSONS 2026-07-21: *"an escape hatch added 'for progressive adoption' doubles as a permanent blind spot, so pair it with a gate that fails while the hatch is still in use."* `side: false` is exactly such a hatch. That is why the `side` key is REQUIRED on every fullframe card rather than defaulting to false — a missing key fails the gate, forcing a deliberate call on all 49.

## Current state

### The card shape today

Every fullframe card hardcodes the canvas. From `section/tool-intro/index.html`:

```html
    <meta name="viewport" content="width=1920, height=1080" />
```
```css
      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #000; font-family: var(--font); color: var(--text); }
      #root { position: relative; width: 1920px; height: 1080px; }
      .content { display: flex; flex-direction: column; align-items: flex-start; max-width: 1560px; }
```
```html
    <div id="root" data-composition-id="toolintro" data-start="0" data-duration="6" data-width="1920" data-height="1080"
```

`DESIGN.md` currently says (lines 40-41): *"Canvas 1920x1080, content in a centered `#frame` with ~120px padding; content block max-width ~1560px."*

### How plan 150 renders a side cue

`lib/render.mjs` gains `rewriteCanvas(html, 1200)`, which rewrites **only** `data-width="1920"` → `data-width="1200"` in the staged HTML. It deliberately does **not** touch CSS — regex-rewriting stylesheets is fragile. That is the whole reason the contract below exists: a side-ready card must lay out relative to its root so that changing `data-width` is sufficient.

### Catalog entry shape

```json
{
  "slug": "section/tool-intro",
  "kind": "single",
  "placement": "fullframe",
  "purpose": "section opener for one tool/product: TOOL N OF M progress, huge name, positioning line, category chip",
  "variables": { "...": "..." },
  "default_duration": 6,
  "structural": true,
  "variants": ["a", "b"],
  "head_zone": { "x": 0.6, "y": 0.28, "w": 0.3, "h": 0.53 }
}
```

`scripts/check-catalog.mjs:67-78` validates `head_zone`. That block is deleted by this plan.

### The 49 fullframe cards, by family

| Family | n | Slugs |
|---|---|---|
| comparison | 12 | bar-chart, billing-discount, checkout-summary, comparison-storm-cascade, comparison-tier-list, feature-matrix, head-to-head, pricing-tiers, savings-stacker, summary-table, credits-math, table-rows |
| enacted | 9 | fill-gauge, race-bars, counter-tally, pipeline-flow, before-after, spotlight-focus, timeline-scrub, terminal-enact, promise-split |
| section | 8 | bullet-points, bullet-points-highlighted, key-takeaways, section-card-flip, section-counter-scale, section-particle-storm, tool-intro, **host-stage (deleted by this plan)** |
| title | 5 | title-aurora-wave, title-cinematic-float, title-versus, title-kinetic-lines, title-storm-pop |
| verdict | 5 | verdict-badges, verdict-report-card, verdict-trophy, winners-podium, persona-match |
| checklist | 2 | checklist, icon-pills |
| slate | 2 | headline-chips, kinetic-sentence |
| prompt / tool-icon / statement / pros-cons / table-of-contents / process | 6 | prompt-typing, tool-glass-tile, keyword-statement, pros-cons, table-of-contents, step-flow |

**Batch A (this plan, 21 cards)**: title (5), section (7, after host-stage is deleted), statement (1), slate (2), tool-icon (1), prompt (1), checklist (2), table-of-contents (1), process (1). These are the big-type, few-element layouts that reflow cleanly.

**Batch B (plan 152, 27 cards)**: comparison (12), enacted (9), verdict (5), pros-cons (1) — the dense ones, where genuine `side: false` decisions get made.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Structural card check | `cd pipelines/video/card-library && bash scripts/check-cards.sh` | exit 0 |
| Catalog schema check | `cd pipelines/video/card-library && node scripts/check-catalog.mjs` | exit 0 |
| Side contract gate (new) | `cd pipelines/video/card-library && node scripts/check-side.mjs` | exit 0 |
| Render one card at side width | `cd pipelines/video/card-library && node scripts/card-qa.mjs <slug> --side` | writes a contact sheet PNG, prints its path |
| Hyperframes lint | `cd pipelines/video/card-library && npx --yes hyperframes@0.7.62 lint <slug>` | the 2 known warnings are OK |

## Scope

**In scope**:
- `pipelines/video/card-library/DESIGN.md` — the side-ready contract
- `pipelines/video/card-library/catalog.json` — `side` on every fullframe card; remove `head_zone`
- `pipelines/video/card-library/scripts/check-catalog.mjs` — require `side`, drop `head_zone` validation
- `pipelines/video/card-library/scripts/check-side.mjs` — NEW gate
- `pipelines/video/card-library/scripts/card-qa.mjs` — `--side` flag
- `pipelines/video/card-library/scripts/check-cards.sh` — call the new gate
- The 21 batch-A card `index.html` files
- `pipelines/video/card-library/section/host-stage/` — DELETED
- `pipelines/video/card-library/gallery-order.json` — only if it references host-stage

**Out of scope**:
- `pipelines/video/visuals-flow/**` — plan 150 owns every pipeline surface. This plan must not edit it.
- The 27 batch-B cards — plan 152. Give them `side: false` in the catalog for now so the gate passes; 152 revisits each.
- `overlay`-placement cards (12 of them) — side mode only applies to fullframe. They get no `side` key.
- `brand/`, `logos/` — not cards.

## Git workflow

- Branch: `advisor/151-cards-side-contract-batch-a`
- Commit per step: `cards: <step summary>` — no AI footers. Do NOT push.

## Steps

### Step 1: Write the contract into DESIGN.md

Add a new section to `pipelines/video/card-library/DESIGN.md`:

```markdown
## Side-ready cards (side avatar mode)

In side mode the host takes the right 720px and the card renders into the left
**1200 × 1080**. The renderer bakes this by rewriting only `data-width` on
`#root` — it does not touch your CSS. So a side-ready card must lay out
**relative to its root**, and a card that hardcodes 1920px cannot work.

A card marked `"side": true` in `catalog.json` MUST satisfy all of:

1. **No hardcoded canvas width.** `html`, `body` and `#root` size with `100%`
   (or `100vw`/`100vh`), never `1920px`. The string `1920px` must not appear
   anywhere in the file. `data-width="1920"` on `#root` stays — that attribute
   is the thing the renderer rewrites.
2. **Type size does not change.** The point of side mode is that the graphic
   still reads. Never shrink a font to make a layout fit; re-stack it instead
   (row → column, 2-up → 1-up, horizontal chips → wrapped chips).
3. **Content widths are relative.** `max-width` in `%` or `vw`, or a px value
   that is ≤ 1080 so it still fits inside the 1200 column with padding. The
   old "content block max-width ~1560px" rule applies to the full canvas only.
4. **Nothing clips or overlaps at 1200 × 1080**, verified by rendering — not
   by reading the CSS.

A card that cannot meet these without shrinking type declares `"side": false`.
That is a legitimate outcome, not a failure: dense tables and wide matrices have
a real minimum width. The shot pass then cannot place a side span over it.

Verify with `node scripts/card-qa.mjs <slug> --side` and LOOK at the sheet.
```

Also amend the existing canvas line (currently *"Canvas 1920x1080, content in a centered `#frame`…"*) to note that side-ready cards follow the relative rules above.

**Verify**: `cd pipelines/video/card-library && grep -c "Side-ready cards" DESIGN.md` -> `1`

### Step 2: Delete stage's leftovers

1. `git rm -r pipelines/video/card-library/section/host-stage/`
2. Remove the `host-stage` entry from `catalog.json`.
3. Remove `head_zone` from `section/tool-intro`'s catalog entry.
4. Remove the `head_zone` validation block from `scripts/check-catalog.mjs` (lines 67-78).
5. If `gallery-order.json` lists `section/host-stage`, remove that entry.

**Verify**: `cd pipelines/video/card-library && ! test -d section/host-stage && ! grep -q "head_zone" catalog.json scripts/check-catalog.mjs && echo CLEAN` -> `CLEAN`

### Step 3: `side` becomes a required catalog field

In `scripts/check-catalog.mjs`, add validation: **every card with `placement: "fullframe"` must have a boolean `side`.** A missing key is an error, not a default:

```js
  if (card.placement === 'fullframe') {
    if (typeof card.side !== 'boolean') {
      err(`FAIL: ${card.slug}.side must be a boolean (true = renders correctly at 1200x1080; false = needs full canvas). This key is REQUIRED on fullframe cards so the decision is deliberate.`);
    }
  } else if (card.side !== undefined) {
    err(`FAIL: ${card.slug}.side only applies to fullframe cards`);
  }
```

Then add `"side": false` to **all 48 remaining fullframe cards** in `catalog.json`. Batch A cards flip to `true` in Step 6, once a render proves it.

**Preserve the file's existing encoding.** `catalog.json` contains escaped non-ASCII (`—` etc). A naive `JSON.parse` → `JSON.stringify` round-trip converts those to literal characters and produces a huge spurious diff. Edit the JSON textually, or re-escape non-ASCII after writing.

**Verify**: `cd pipelines/video/card-library && node scripts/check-catalog.mjs && node -e "const c=require('./catalog.json');const f=c.cards.filter(x=>x.placement==='fullframe');console.log(f.length+' fullframe, '+f.filter(x=>typeof x.side==='boolean').length+' with boolean side')"` -> exit 0 and `48 fullframe, 48 with boolean side`

### Step 4: The structural gate — `scripts/check-side.mjs`

Create `pipelines/video/card-library/scripts/check-side.mjs`. It fails the build when a card claims `side: true` but violates the mechanical parts of the contract:

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Gate for the side-ready contract (DESIGN.md → "Side-ready cards"). Only the
// MECHANICAL rules are checkable here: a hardcoded 1920px canvas makes side
// rendering impossible regardless of how the card looks. Rules 2 and 4 (type
// size, nothing clips) are visual and are verified by card-qa --side + a human
// or agent looking at the sheet. This gate exists because check-cards.sh is
// content-blind — see plans/runs/LESSONS.md 2026-07-24.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog.json'), 'utf8'));

const errors = [];
let checked = 0;

for (const card of catalog.cards ?? []) {
  if (card.placement !== 'fullframe') continue;
  if (card.side !== true) continue;
  checked++;
  const file = path.join(ROOT, card.slug, 'index.html');
  if (!fs.existsSync(file)) { errors.push(`${card.slug}: side:true but ${file} is missing`); continue; }
  const html = fs.readFileSync(file, 'utf8');

  if (/1920px/.test(html)) {
    errors.push(`${card.slug}: side:true but the file still contains "1920px" — root and content must size relatively (DESIGN.md rule 1)`);
  }
  if (!/data-width="1920"/.test(html)) {
    errors.push(`${card.slug}: #root must keep data-width="1920" — the renderer rewrites that attribute to 1200 for side cues`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(e);
  console.error(`\ncheck-side: ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`check-side OK — ${checked} side-capable card(s)`);
```

Wire it into `scripts/check-cards.sh` so the standard check runs it, and add `"check-side": "node scripts/check-side.mjs"` to `package.json` scripts.

**Verify**: `cd pipelines/video/card-library && node scripts/check-side.mjs` -> `check-side OK — 0 side-capable card(s)` (zero is correct at this point — no card has flipped yet)

### Step 5: `card-qa.mjs --side`

Add a `--side` flag to `scripts/card-qa.mjs`. When passed, before rendering it copies the card to a temp dir and rewrites `data-width="1920"` → `data-width="1200"` (the same single-attribute rewrite the pipeline does), renders both the `min` and `max` variable variants, extracts a frame from each, and writes the two-up contact sheet exactly as the existing flow does.

Reuse the existing render/extract/montage code path — only the staged HTML and the output filename suffix (`-side`) differ. Do not fork a second pipeline.

**Verify**: `cd pipelines/video/card-library && node scripts/card-qa.mjs title/title-storm-pop --side` -> exits 0 and prints a path to a PNG that exists and is >10KB

### Step 6: Convert batch A — the 21 cards

For **each** of these 21 cards, in this order:

`title/title-aurora-wave`, `title/title-cinematic-float`, `title/title-versus`, `title/title-kinetic-lines`, `title/title-storm-pop`, `section/bullet-points`, `section/bullet-points-highlighted`, `section/key-takeaways`, `section/section-card-flip`, `section/section-counter-scale`, `section/section-particle-storm`, `section/tool-intro`, `statement/keyword-statement`, `slate/headline-chips`, `slate/kinetic-sentence`, `tool-icon/tool-glass-tile`, `prompt/prompt-typing`, `checklist/checklist`, `checklist/icon-pills`, `table-of-contents/table-of-contents`, `process/step-flow`:

1. Replace hardcoded `1920px` widths on `html`, `body`, `#root` with `100%`. Height stays `1080px` — only the width varies in side mode.
2. Change fixed content `max-width` values (e.g. `1560px`, `1200px`) to a relative value, or to ≤1080px so they still fit the column with padding.
3. Re-stack anything that only works wide: horizontal rows become columns, side-by-side pairs stack, chip rows wrap. **Do not reduce any `font-size`.**
4. Render and LOOK: `node scripts/card-qa.mjs <slug> --side`, then read the produced PNG and check it against the rubric below.
5. Only if it passes, set `"side": true` for that card in `catalog.json`.
6. Confirm the card still renders correctly at FULL width — `node scripts/card-qa.mjs <slug>` — because it must keep working in non-side cues. A change that fixes 1200 and breaks 1920 is a regression.

**Inspection rubric** (score every card at 1200×1080; any FAIL means fix or set `side: false`):

| # | Check | FAIL looks like |
|---|---|---|
| 1 | No text is cut off at any edge | a word runs past the right edge or is clipped |
| 2 | No two elements overlap | text sits on top of a panel border or another element |
| 3 | Type is the same size as the full-canvas render | text visibly smaller than the 1920 sheet |
| 4 | Nothing is horizontally squashed | logos/icons non-square, text condensed |
| 5 | The layout still reads as designed | elements bunched in a corner, huge empty band, broken alignment |
| 6 | The `max` variable variant fits, not just `min` | the longest strings overflow |

If a card cannot pass without shrinking type, leave it `side: false`, revert its HTML changes, and record it in the summary. That is a correct outcome.

**Verify (per card)**: `cd pipelines/video/card-library && node scripts/card-qa.mjs <slug> --side` -> exit 0, sheet inspected against the rubric
**Verify (batch)**: `cd pipelines/video/card-library && node scripts/check-side.mjs` -> `check-side OK — N side-capable card(s)` where N is the number you flipped to true

### Step 7: Full gate

**Verify**: `cd pipelines/video/card-library && bash scripts/check-cards.sh && node scripts/check-catalog.mjs && node scripts/check-side.mjs` -> exit 0 from all three

## Test plan

- **Structural**: `check-side.mjs` proves no `side: true` card carries a hardcoded 1920px canvas and every one keeps its `data-width` anchor.
- **Schema**: `check-catalog.mjs` proves all 48 fullframe cards carry an explicit boolean `side`, and that `head_zone` is gone.
- **Visual**: one `card-qa --side` contact sheet per batch-A card, scored against the 6-point rubric. This is the real test — the structural gates are content-blind by design.
- **Regression**: each converted card also re-rendered at full width and confirmed unchanged in appearance.

## Done criteria

- [ ] `bash scripts/check-cards.sh` exits 0
- [ ] `node scripts/check-catalog.mjs` exits 0
- [ ] `node scripts/check-side.mjs` exits 0
- [ ] `node -e "const c=require('./catalog.json');const f=c.cards.filter(x=>x.placement==='fullframe');console.log(f.length, f.filter(x=>typeof x.side==='boolean').length)"` prints `48 48`
- [ ] `test -d section/host-stage` is false; `grep -q head_zone catalog.json scripts/check-catalog.mjs` finds nothing
- [ ] `DESIGN.md` contains a `## Side-ready cards (side avatar mode)` section
- [ ] `node scripts/card-qa.mjs <slug> --side` produced an inspected contact sheet for **every one of the 21 batch-A cards**, and the PR body lists each card with PASS or `side: false` + reason
- [ ] No card's `font-size` was reduced — `git diff 525d5ba..HEAD -- '*/index.html' | grep '^-.*font-size' ` shows no line whose replacement is smaller
- [ ] `git diff --name-only 525d5ba..HEAD` lists only paths from the In-scope list

## STOP conditions

- **Any file under `pipelines/video/visuals-flow/` needs editing.** Plan 150 owns every pipeline surface. Stop and report.
- **A card only fits by reducing a font-size.** That is the exact quality loss the owner refused. Set `side: false` and move on — do not shrink type.
- **More than 8 of the 21 batch-A cards end up `side: false`.** That means the batch was mis-scoped or the contract is wrong. Stop and report rather than converting the rest on a bad premise.
- **`card-qa --side` cannot render** (hyperframes CLI failure, ffmpeg missing). Do NOT mark any card `side: true` on the strength of reading its CSS. Without a rendered frame there is no evidence — stop and report.
- **The catalog diff is enormous** (hundreds of changed lines for a one-key-per-card edit). That means a JSON round-trip re-encoded the escaped non-ASCII. Revert and edit textually.

## Maintenance notes

- `side: false` is a deliberate escape hatch and, per LESSONS 2026-07-21, hatches become permanent blind spots. It is paired with a REQUIRED key so the count is always visible: `node -e "const c=require('./catalog.json');console.log(c.cards.filter(x=>x.placement==='fullframe'&&!x.side).length+' cards cannot do side')"`. Watch that number fall across 152.
- The gate can only check the mechanical rules. Rules 2 and 4 of the contract (type size, nothing clips) are visual forever — any future card plan must keep the render-and-inspect step. A green `check-side` on a stub card proves nothing, which is precisely how plan 137 shipped 12 stubs.
- `data-width="1920"` staying in a side-ready card looks wrong but is load-bearing: it is the anchor `rewriteCanvas` matches on. Removing it silently disables side rendering for that card.
- Overlay-placement cards deliberately have no `side` key. If side mode ever extends to overlays, `check-catalog.mjs`'s `else if (card.side !== undefined)` branch is the place to start.
