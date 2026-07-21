<!-- boss frontmatter -->
---
executor: agy
model:
test_cmd: cd pipelines/video/card-library && bash scripts/check-cards.sh && node scripts/check-catalog.mjs && cd ../visuals-flow && node --test
ui: true
deploy:
needs: ["Needs 115 (variable contracts drive the worst-case generator) and 121 (normalized logos)"]
---

# Plan 122: Card stress-test QA harness, and the three layout defects it would have caught

## Summary

- **Problem statement**: Cards are authored and reviewed against their own convenient `data-composition-variables` demo data — five products, equal-length labels, hand-picked logos. Real pipeline output has different shapes, so layouts distort and nobody finds out until an owner reviews a finished video. Three such defects are live right now: `icon-pills` icons drift out of column, `summary-table` column ratios distort at 2 products, and `head-to-head` shows letter tiles instead of logos.
- **Goals**:
  - Build a stress-test harness that renders every card with **worst-case** content derived from the plan-115 contracts, into a reviewable contact sheet.
  - Require that sheet on any PR touching a card.
  - Fix the three known defects.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High) — generator is fully specified; card fixes are CSS-level with exact selectors; visual output passes the render+inspect gate.
- **Done criteria** (terse — full list below): harness renders all cards at min and max content; the three cards fixed and verified by frame extraction; gates green.
- **Stop conditions** (terse — full list below): a card that cannot render worst-case content without redesign; `head-to-head` changing shape rather than gaining logos.
- **Test / verification for success**: contact sheets inspected by eye, plus the existing structural and contract gates.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 18488a2..HEAD -- pipelines/video/card-library`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 115 (variable contracts), 121 (normalized logos)
- **Category**: bug
- **Difficulty**: standard
- **Planned at**: commit `18488a2`, 2026-07-21

## Why this matters

Plans 115–120 made the *pipeline* deterministic — contracts, timing, placement, constants. None of them touch how a card *renders*. Owner review on 2026-07-21 produced four rejections in that untouched space, and every one shares a cause:

> A card looks correct with its own demo data and breaks with real data, and nothing checks the difference.

This is the same failure shape plan 116 fixed in the time domain: `persona-match`'s demo beats ran 0.6–4.2s, so its title-gating bug was invisible until the resolver handed it 6.42s. Here it is in the layout domain.

### Defect 1 — `checklist/icon-pills`: icons drift out of column

```css
#rows { display: flex; flex-direction: column; gap: 34px; align-items: center; justify-content: center; }
.row  { display: flex; align-items: center; gap: 24px; }
```

`align-items: center` sizes each `.row` to its own content and centres it **independently**. Pills of differing text length therefore start at different x, dragging their icon tiles with them. Owner's four labels ("Pick the clip model", "Set the video genre", "Choose the clip length", "Auto hook on top clips") produced a visibly ragged icon column. It only looks aligned when every label is the same length.

### Defect 2 — `comparison/summary-table`: ratios tuned for five products

```js
grid.style.gridTemplateColumns = `1.3fr repeat(${DATA.products.length}, 1fr) 2.4fr`;
```

| Products | FACTOR | Each product | REASON |
|---|---|---|---|
| 5 (the card's demo data) | 15% | 11.5% | 28% |
| **2 (real video)** | **23%** | **17.5%** | **42%** |

At two products REASON takes 42% of the table and the left column bloats. Two further owner points, both confirmed in the CSS:

- Logos in the header are hardcoded `width:24px; height:24px` with `filter:saturate(0.5) brightness(0.95); opacity:0.9` — tiny and muddy.
- `.hcell.feat, .hcell.reason` and `.feat` are **both** `color: var(--accent)`, so the FACTOR/REASON headers and the row labels are the same colour with no hierarchy.

### Defect 3 — `comparison/head-to-head`: no logos

```js
const initial = (n) => `<svg ...><rect fill="#673DE6"/><text ...>${(n || '?')[0]}</text></svg>`;
$('logoL').innerHTML = DATA.left.logoSvg ?? initial(DATA.left.name);
```

The card takes a raw `logoSvg` and otherwise renders a purple letter tile. It is not wired to the logo registry, and `logos-inline.mjs` does not look inside `left`/`right`, so real logos can never reach it. Plan 119 explicitly scoped this out; the owner has since rejected the letter tiles, so it comes in here.

## Current state

- **Contracts (plan 115)**: `catalog.json` variables carry `type`, `required`, `role`, `max_words`, `max_chars`, `enum`, `shape`, `item_shape`, `example`. These are what make worst-case generation possible without hand-authoring fixtures per card.
- **Beat limits**: `max_beats` and `max_reveal_chars` already exist per beat card.
- **Logos (plan 121)**: every registry logo is a 256×256 tile, mark at 72%, with `bg` / `dark` metadata. `logos-inline.mjs` inlines `variables.logo`, `productLogos[]`, `platforms[].logo`, and `beats[].logo` as data URIs under `__logos`.
- **Rendering**: `npx hyperframes@0.7.62 render <type>/<card> --out <mp4>`; variables come from the card's `data-composition-variables` when rendered standalone.
- **Gates**: `scripts/check-cards.sh` (structure), `scripts/check-catalog.mjs` (contracts, plan 115), `scripts/check-logos.mjs` (plan 121).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Card structure gate | `cd pipelines/video/card-library && bash scripts/check-cards.sh` | exit 0 |
| Contract gate | `cd pipelines/video/card-library && node scripts/check-catalog.mjs` | `catalog ok` |
| Stress harness | `cd pipelines/video/card-library && node scripts/card-qa.mjs` | sheets in `~/kb-scratch/card-qa/` |
| One card only | `cd pipelines/video/card-library && node scripts/card-qa.mjs checklist/icon-pills` | one sheet |
| Render a card | `cd pipelines/video/card-library && npx --yes hyperframes@0.7.62 render <slug> --out /tmp/c.mp4` | mp4 |
| Extract a frame | `ffmpeg -v error -ss 3 -i /tmp/c.mp4 -frames:v 1 /tmp/c.png -y` | png |
| Visuals-flow suite | `cd pipelines/video/visuals-flow && node --test` | exit 0 |

**All harness output goes to `~/kb-scratch/card-qa/`, never into the repo** (`pipelines/CLAUDE.md`: generated media never lives in the repo; `card-library/CLAUDE.md`: never commit test output).

## Scope

**In scope**:
- `pipelines/video/card-library/scripts/card-qa.mjs` (new)
- `pipelines/video/card-library/checklist/icon-pills/index.html`
- `pipelines/video/card-library/comparison/summary-table/index.html`
- `pipelines/video/card-library/comparison/head-to-head/index.html`
- `pipelines/video/card-library/catalog.json` (head-to-head variable contract gains logo slugs)
- `pipelines/video/visuals-flow/lib/logos-inline.mjs` (collect `left.logo` / `right.logo`)
- `pipelines/video/visuals-flow/lib/logos.test.mjs`
- `pipelines/video/card-library/DESIGN.md`, `CLAUDE.md` (the QA gate rule)

**Out of scope**:
- Every other card. The harness will surface more defects — **record them, do not fix them here.** Write findings into the PR body; each becomes its own plan. Fixing ten cards in one PR is unreviewable.
- `head-to-head`'s layout, stats rows, or motion. It gains logo support and nothing else.
- Any `cues.json` or video.
- Re-rendering `opusclip-tutorial`.

## Git workflow

- Branch: `advisor/122-card-stress-qa`
- Commit per step. Message style: `fix(card-library): align icon-pills rows`. No AI footers. Do NOT push.

## Steps

### Step 1: Build the worst-case generator

Create `scripts/card-qa.mjs`. For each card in `catalog.json` it synthesizes two variable sets from the contracts:

- **`min`** — every required field at its shortest sensible value; arrays and beats at their minimum count (2).
- **`max`** — every string filled to its `max_words` / `max_chars` limit; arrays and beats at their maximum (`max_beats`, or 5 products for `products`); logos deliberately mismatched (`opusclip` dark tile beside `submagic` bright tile) to expose weight differences.

Filler generator — words that are realistic in length rather than `xxxx`:

```js
const FILLER = ['publish', 'workflow', 'captions', 'rendering', 'automation', 'timeline', 'export', 'quality'];
function fillString(spec) {
  const words = spec.max_words ?? 6;
  let out = [];
  for (let i = 0; i < words; i++) out.push(FILLER[i % FILLER.length]);
  let s = out.join(' ');
  if (spec.max_chars) s = s.slice(0, spec.max_chars);
  if (spec.role === 'value') s = '$' + (12 + (words % 7)) + ' / mo';
  return s;
}
```

Respect `enum` (pick the last value, not the first — defaults hide bugs) and `role` (a `value` role must carry a unit).

For each card and each variant: write a temp copy of the card with `data-composition-variables` replaced, render it, extract a frame at 80% of duration (after all beats have revealed), and tile the results into one contact sheet per card at `~/kb-scratch/card-qa/<type>-<card>.png` with the variant labelled.

**Verify**: `cd pipelines/video/card-library && node scripts/card-qa.mjs checklist/icon-pills && ls ~/kb-scratch/card-qa/` -> `checklist-icon-pills.png` exists

### Step 2: Fix `icon-pills` alignment

Replace the flex row with a two-column grid so the icon column is fixed and every pill starts at the same x:

```css
#rows { display: grid; grid-auto-flow: row; gap: 34px; justify-content: center; align-items: center; }
.row  { display: grid; grid-template-columns: 88px 1fr; align-items: center; gap: 24px; }
.pill { justify-self: start; }
```

`#rows` becoming a grid makes all rows share one column track, so the icon tiles align regardless of pill width. Pills stay content-width (`justify-self: start`) rather than stretching — equal-width pills would look like a table, which is not this card's design.

**Verify**: render with four labels of deliberately different lengths, extract a frame, and **look at it**: all four icon tiles share one left edge, all four pills share one left edge.

### Step 3: Fix `summary-table` proportions and hierarchy

Make the grid a function of product count instead of a fixed string:

```js
// Column ratios must hold at 2..5 products. A fixed "1.3fr ... 2.4fr" was
// tuned for 5 and distorts badly at 2 (REASON took 42% of the table).
const n = DATA.products.length;
const factorFr = 1.3;
const reasonFr = Math.max(1.2, 2.4 - (5 - n) * 0.35);  // shrinks as products shrink
grid.style.gridTemplateColumns = `${factorFr}fr repeat(${n}, 1fr) ${reasonFr}fr`;
```

At n=5 this reproduces today's 2.4fr exactly; at n=2 it yields 1.35fr, putting REASON at ~24% instead of 42%.

Typography and logo fixes (owner's explicit asks):

```css
/* header labels: distinct from row labels, larger */
.hcell.feat, .hcell.reason { font-size: 23px; color: var(--text-dim); letter-spacing: 1.5px; }
/* row labels: their own colour, not the same accent as the headers */
.feat { font-size: 25px; font-weight: 700; color: var(--text); }
```

Logos in the header (line ~126): raise to `width:44px; height:44px`, drop `filter: saturate(0.5) brightness(0.95)` and `opacity:0.9` entirely — plan 121 normalized apparent weight, so per-card dimming now fights that work and is forbidden by the DESIGN.md logo rule. Add the `dark` hairline border when `registry[slug].dark` is true.

Exact colour choices are the owner's call at review; the requirement is that header labels, row labels, and score values are three visually distinct treatments.

**Verify**: render at 2 products AND 5 products, extract a frame of each, look at both: no column exceeds ~30% at either count, logos are legible, and the three text roles are distinguishable.

### Step 4: Wire `head-to-head` to the logo registry

In `visuals-flow/lib/logos-inline.mjs`, add `left`/`right` logo collection alongside the existing refs:

```js
  for (const side of [variables.left, variables.right]) {
    if (typeof side?.logo === 'string') refs.add(side.logo);
  }
```

In the card, prefer a registry logo over the letter fallback, keeping `logoSvg` working for hand-authored uses:

```js
const LOGOS = VARS.__logos ?? {};
const logoFor = (side) => LOGOS[side.logo]
  ? `<img src="${LOGOS[side.logo]}" alt="" style="width:100%;height:100%;object-fit:contain;border-radius:18px;">`
  : (side.logoSvg ?? initial(side.name));
$('logoL').innerHTML = logoFor(DATA.left);
$('logoR').innerHTML = logoFor(DATA.right);
```

Update the catalog contract for `left`/`right` `shape` to include `logo: { type: "string", required: false, role: "logo_slug", example: "opusclip" }`. Because `resolve.mjs` validates `logo_slug` roles against the registry (plan 115), a bad slug now errors instead of silently falling back to a letter.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/logos.test.mjs` -> exit 0, with a new test asserting `left.logo`/`right.logo` reach `__logos`

### Step 5: Run the harness across the library and record findings

Run `node scripts/card-qa.mjs` for all cards. Review every sheet. For each card other than the three fixed here, record any defect as a one-line finding in the PR body: `<slug> — <what distorts> at <which variant>`.

**Do not fix them.** The value of this step is the inventory; each finding becomes its own plan so it can be reviewed on its own merits.

**Verify**: `ls ~/kb-scratch/card-qa/*.png | wc -l` -> matches the catalog card count; PR body carries the findings list.

### Step 6: Make the sheet a required gate

- `card-library/CLAUDE.md`, "Adding a new card": add a step — run `node scripts/card-qa.mjs <type>/<card>` and attach the contact sheet to the PR. A card whose `max` variant clips, overlaps, or misaligns is not done.
- `DESIGN.md`: add a "Survives worst-case content" rule — layouts must hold at both the minimum and maximum item counts the catalog allows, and at every string's `max_words`. Grid ratios must be computed from item count, never hardcoded for one count.
- Add `"card-qa": "node scripts/card-qa.mjs"` to `package.json`.

**Verify**: `grep -c "card-qa" pipelines/video/card-library/CLAUDE.md pipelines/video/card-library/package.json` -> both at least `1`

## Test plan

The harness is a visual tool; its own correctness is checked by the Step 1 verify (a sheet is produced with both variants). The card fixes are verified by frame extraction, because no assertion can judge "the icons line up". Structural and contract gates guard the rest.

## Done criteria

- [ ] `cd pipelines/video/card-library && bash scripts/check-cards.sh` exits 0
- [ ] `node scripts/check-catalog.mjs` prints `catalog ok`
- [ ] `cd pipelines/video/visuals-flow && node --test` exits 0
- [ ] `node scripts/card-qa.mjs` produces one sheet per catalog card in `~/kb-scratch/card-qa/`
- [ ] `icon-pills` frame shows all icon tiles sharing one left edge with four different-length labels
- [ ] `summary-table` frames at 2 and 5 products both show no column above ~30%, 44px logos, three distinct text treatments
- [ ] `head-to-head` frame shows two real registry logos, no letter tiles
- [ ] PR body lists findings for every other card, unfixed
- [ ] Nothing written under `~/kb-scratch/` is committed
- [ ] `git diff --stat 18488a2..HEAD` touches only the in-scope list

## STOP conditions

- **A card cannot render worst-case content without a redesign.** Record it as a finding and move on — do not redesign a card inside this plan.
- **`head-to-head` needs layout changes to fit a real logo.** It gains logo support only. If the 256×256 tile does not fit its logo slot, report the constraint rather than resizing the card.
- **The harness would write into the repo.** All output belongs in `~/kb-scratch/card-qa/`. A generated PNG appearing in `git status` is a defect.
- **Plan 115 or 121 has not landed.** The generator reads contract fields from 115 and expects normalized logos from 121; without them the sheets are meaningless. Stop and report.
- **You are tempted to fix a fourth card.** Out of scope, every time.

## Maintenance notes

- The harness's value is proportional to how honest the worst case is. If a contract's `max_words` is generous fiction, the sheet proves nothing — that makes plan 115's limits load-bearing for this plan too.
- Frame extraction at 80% of duration assumes all beats have revealed by then. Cards with a late outro beat may need a second extraction point; add it per-card rather than moving the global default.
- `head-to-head` keeps `logoSvg` support deliberately: the editor hand-authors cards at render2 and may not have a registry slug.
- The findings list from Step 5 is the real deliverable of this plan. Expect it to generate several follow-up plans; that is the harness working, not scope creep.
