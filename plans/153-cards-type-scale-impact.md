---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/card-library && bash scripts/check-cards.sh && node scripts/check-catalog.mjs && node scripts/check-side.mjs && node scripts/check-type-scale.mjs
ui: true
deploy:
needs: ["152 must land first — it is the last plan that rewrites card CSS; running this concurrently would collide on the same declarations"]
---

# Plan 153: card type scale — make the text impactful

## Summary

- **Problem statement**: The owner reviewed rendered cards and found the text "subtle, not impactful… very normal". Measured cause: across all 61 cards the **median card's largest text is 64px on a 1080-tall frame — 5.9% of frame height**, and 47 of 61 never exceed 90px. `DESIGN.md` caps titles at 52–72px while allowing hero *numbers* up to 220px, so words are structurally forbidden from being the hero. It is a web type scale on a video canvas.
- **Goals**:
  - Rewrite the `DESIGN.md` type scale so hero text is 120–200px and hierarchy is explicit.
  - Add an explicit `--hero-size` contract so every fullframe card names its hero element, and gate it with `scripts/check-type-scale.mjs` — turning "make the text better" into something that can fail a build.
  - Require one accent-coloured text element per fullframe card.
  - Tighten copy capacity (`max_reveal_chars` / `max_beats`) where bigger type no longer fits the old word counts.
  - Apply across all 49 fullframe cards.
- **Executor proposed**: `claude-p` / `sonnet` — `DESIGN.md` is quality-setting content the owner judges by taste, and per-card type decisions need visual judgment (`tooling/boss/data/rules.md`).
- **Done criteria** (terse — full list below): all four gate commands exit 0; every fullframe card declares `--hero-size` ≥ 120px with a ≥2.5× ratio to its next-largest text and em-based tracking; every card render-inspected at both full and side width.
- **Stop conditions** (terse — full list below): do not touch `visuals-flow/`; never let a card overflow to keep type large; do not edit or delete an owner note except to mark it done.
- **Test / verification for success**: `check-type-scale.mjs` (new, mechanical) plus a render-and-inspect pass per card against a written rubric.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9fc22fb..HEAD -- pipelines/video/card-library/`
>
> **Expect large drift.** Plans 151 and 152 rewrite the CSS of all 49 fullframe
> cards between this plan's authoring and its execution. That is intended, not a
> conflict — read each card as it stands now, never assume the excerpts below are
> still literal.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plan 152 (and transitively 150, 151)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `9fc22fb`, 2026-07-25

## Why this matters

The owner's words, after reviewing rendered frames: *"the text is very subtle and it looks very normal… it doesn't look good. It's subtle, it's not impactful."* And specifically: *"Especially the title."*

Four measured causes, all fixable at the rulebook rather than per card:

1. **Scale.** Median largest text is 64px = 5.9% of frame height. Video hero text wants 12–20%. `DESIGN.md` line 33 caps titles at 52–72px; line 36 permits hero *numbers* to 220px. Numbers are allowed to dominate, words are not.
2. **No dominance.** `enacted/promise-split` runs promise text 46px, names 42px, pills 34px — a 2× spread. Strong layouts run 4–6× between hero and support. When everything is mid-sized the eye has nothing to land on, which reads as flat rather than calm.
3. **The headline is styled as a subordinate.** In `promise-split` the idea-carrying line is `#promiseText { font-size: 46px; font-weight: 600; color: var(--dim) }` — grey and semi-bold. The most important sentence on screen is the most recessive thing on screen.
4. **Accent is decoration, not emphasis.** The brand orange appears as hairline dividers and small underlines; no *word* is ever accented, so colour never marks meaning.

The reason a single bad rule produced 61 consistent cards is that it was written down and obeyed. The reason it was never caught is that nothing checked the *result*. This plan fixes both halves — the rule and the gate.

**Read `plans/runs/LESSONS.md` 2026-07-24 before starting**: twelve cards once shipped as title-only stubs with every gate green. `check-cards.sh` and `check-type-scale.mjs` are content-blind about how a card *looks*. The rendered contact sheet is the only real verification.

## Current state

### The rule being replaced

`pipelines/video/card-library/DESIGN.md`, "Typography":

```markdown
- Font: `'Inter', system-ui, sans-serif` (Google Fonts link, weights 400–900). Every card.
- Titles: 52–72px, weight 800, negative letter-spacing (-1 to -2px).
- List/row content: 24–40px, weight 400–600, line-height ~1.35.
- Labels/eyebrows: 18–22px, often uppercase with wide letter-spacing, `--accent` or `--text-dim`.
- Hero numbers (grades, stats): up to 220px, weight 900.
```

### Measured type scale at authoring time (2026-07-25, commit 9fc22fb)

Largest `font-size` declared per card, across 61 cards on a 1080-tall canvas:

| | px | % of frame height |
|---|---|---|
| 25th percentile | 50 | 4.6% |
| median | 64 | 5.9% |
| 75th percentile | 88 | 8.1% |
| max | 280 | 25.9% |

47 of 61 cards never exceed 90px. Title-family specifically: `title/title-versus` 80px, `title/title-aurora-wave` 88px, `title/title-storm-pop` 88px, `statement/keyword-statement` 70px, `section/bullet-points` 54px.

**These numbers are the BEFORE picture and will have shifted after 151/152.** Re-measure at execution time with the command in the table below.

### Why a naive "largest font-size" gate would be wrong

`enacted/fill-gauge` declares `.tile .fallback { font-size: 68px }` — a logo-fallback glyph that is usually hidden. A gate that simply took the maximum declared `font-size` would read that as the hero. Hence the explicit `--hero-size` contract in Step 1: the card *names* its hero rather than the gate guessing.

### Owner review happens AFTER this plan, not before

The owner will review every template in the local gallery (`npm run serve`) once this lands, and file notes in `card-notes.json` for anything still not reading well. **Do not read, act on, or modify `card-notes.json` in this plan** — per `card-library/CLAUDE.md`, notes are a queue acted on only when the owner says "apply my template notes", and they have not said that for this work. That review is the follow-up pass, not an input.

### Capacity fields

22 of 49 fullframe cards declare `max_beats` / `max_reveal_chars` in `catalog.json`, e.g. `checklist/checklist` has `max_beats: 6, max_reveal_chars: 40`. `DESIGN.md` already requires: *"pick font sizes so `max_beats` rows at `max_reveal_chars` characters fit without overflow — then record those two."* Growing the type breaks that relationship, so the numbers must come down where they no longer fit.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Structural card check | `cd pipelines/video/card-library && bash scripts/check-cards.sh` | exit 0 |
| Catalog schema | `cd pipelines/video/card-library && node scripts/check-catalog.mjs` | exit 0 |
| Side contract (from 151) | `cd pipelines/video/card-library && node scripts/check-side.mjs` | exit 0 |
| Type scale gate (new) | `cd pipelines/video/card-library && node scripts/check-type-scale.mjs` | exit 0 |
| Render a card, both variants | `cd pipelines/video/card-library && node scripts/card-qa.mjs <slug>` | contact sheet PNG path |
| Render at side width (from 151) | `cd pipelines/video/card-library && node scripts/card-qa.mjs <slug> --side` | contact sheet PNG path |
| Re-measure the type scale | see Step 0 | a table of percentiles |

## Scope

**In scope**:
- `pipelines/video/card-library/DESIGN.md` — the type scale and hierarchy rules
- `pipelines/video/card-library/scripts/check-type-scale.mjs` — NEW gate
- `pipelines/video/card-library/scripts/check-cards.sh` — call the new gate
- `pipelines/video/card-library/package.json` — the new script entry
- All 49 fullframe card `index.html` files
- `pipelines/video/card-library/catalog.json` — `max_reveal_chars` / `max_beats` reductions only

**Out of scope**:
- `pipelines/video/visuals-flow/**` — no pipeline surface changes at all
- The 12 overlay-placement cards — lower-thirds and tip banners are subordinate by design; the hero rule does not apply and they get no `--hero-size`
- `brand.json` and the accent colour itself — a brand/colour change is separate work the owner has not commissioned; this plan uses `var(--accent)` as it stands
- `scripts/check-side.mjs`, `scripts/card-qa.mjs` — owned by plan 151; if one needs changing, that is a STOP condition
- `card-notes.json` — the owner's review pass comes after this plan; do not read or write it here
- The font itself — Inter stays. The reference the owner admired is a monospace code editor, not a comparable surface; weight, tracking and leading are the levers, not the typeface

## Git workflow

- Branch: `advisor/153-cards-type-scale-impact`
- Commit per family: `cards: type scale <family> (<n> cards)` — no AI footers. Do NOT push.

## Steps

### Step 0: Re-measure, and read the notes

Plans 151/152 have rewritten every card since this plan was authored. Establish the real starting point:

```bash
cd pipelines/video/card-library && node -e "
const fs=require('fs'),path=require('path');
const IGN=new Set(['brand','logos','renders','scripts','node_modules']);
let all=[];
for(const t of fs.readdirSync('.')){
  if(IGN.has(t)||!fs.statSync(t).isDirectory())continue;
  for(const c of fs.readdirSync(t)){
    const f=path.join(t,c,'index.html'); if(!fs.existsSync(f))continue;
    const css=(fs.readFileSync(f,'utf8').split('</style>')[0]||'');
    const sizes=[...css.matchAll(/font-size:\s*(\d+)px/g)].map(m=>+m[1]);
    if(sizes.length) all.push([t+'/'+c, Math.max(...sizes)]);
  }
}
const m=all.map(a=>a[1]).sort((a,b)=>a-b);
console.log('cards: '+all.length+'  median largest: '+m[Math.floor(m.length/2)]+'px  under 90px: '+all.filter(a=>a[1]<90).length);
"
```

**Verify**: the command runs; you have written down the median and the count under 90px, to compare against at the end

### Step 1: Rewrite the DESIGN.md type scale

Replace the "Typography" section of `DESIGN.md` with:

```markdown
## Typography

- Font: `'Inter', system-ui, sans-serif` (Google Fonts link, weights 400–900). Every card.

**The canvas is video, not web.** Type that looks generous in a browser reads as
timid at 1080p on a phone. Size against the FRAME, not against a document.

**Size alone is not the fix.** Enlarged type with default tracking and loose
leading looks *bigger*, not *designed*. Five things move together:

- **Hero** (the one thing the card is about): **120–200px**, weight **800–900**,
  `letter-spacing: -0.035em`, `line-height: 1.0`. Every fullframe card declares
  its hero size once as `--hero-size` in `:root` and uses
  `font-size: var(--hero-size)` on that element.
- **Secondary** (names, row content, values): 40–56px, weight 600–700,
  `letter-spacing: -0.015em`, `line-height: 1.2`.
- **Labels / eyebrows**: 22–28px, weight 700, uppercase, `letter-spacing: 0.12em`
  (wide — the opposite of the hero), colour `var(--accent)`.
- **Hero numbers** (grades, stats): up to 280px, weight 900, same tracking as hero.

**Tracking is in `em`, never `px`.** A fixed `-1.5px` is meaningful at 40px and
invisible at 160px. `-0.035em` scales with the type, which is why it survives a
size change and a px value does not. This was the single most-missed rule in the
pre-2026-07-25 library.

**Contrast, not just scale.** The hero is `var(--text)`. A headline set in
`var(--text-dim)` recedes no matter how large it is — that combination (large but
grey) is what read as "subtle" to the owner.

**Hierarchy is the point.** The hero must be at least **2.5×** the next-largest
text on the card. A card where everything sits in a narrow band reads as flat
however large the type is — a 2× spread across the whole library is what produced
the original complaint.

**The bands and the ratio must agree.** Secondary is capped at BOTH 56px and
`hero ÷ 2.5`, whichever is smaller. So a 56px secondary requires a hero of at
least 140px; a 120px hero allows a secondary of at most 48px. Pick the hero
first, then derive the ceiling — do not set both from the bands independently.

**One accented word per card.** Every fullframe card colours at least one text
element `var(--accent)`. Colour marks meaning; a card where the accent only
appears in dividers and underlines never tells the eye where to land.

**Never style the headline as a subordinate.** The idea-carrying line uses
`--text` at hero size, not `--text-dim` at body size.

**Big type means fewer words.** Growing the hero shrinks capacity, so
`max_beats` / `max_reveal_chars` in `catalog.json` must come DOWN to match —
verify with the `max` variant in `card-qa`, and reduce the declared capacity
until it fits. Never shrink the hero to fit more words; cut the words.

These rules are enforced by `scripts/check-type-scale.mjs`.
```

Also update the existing capacity bullet under "Layout" to cross-reference the last rule above.

**Verify**: `cd pipelines/video/card-library && grep -c "hero-size" DESIGN.md` -> at least `2`

### Step 2: The gate — `scripts/check-type-scale.mjs`

Create it. This is the intelligence-heavy part; use it verbatim:

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Gate for the type-scale contract (DESIGN.md → "Typography"). A naive
// "largest declared font-size" check is wrong — cards carry hidden fallback
// glyphs at large sizes (enacted/fill-gauge's .tile .fallback at 68px), which a
// max() would mistake for the hero. So the card NAMES its hero via --hero-size
// and the gate measures everything else against it.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog.json'), 'utf8'));

const HERO_MIN = 120;        // px on a 1080-tall canvas = 11.1% of frame height
const HERO_RATIO = 2.5;      // hero must be >= 2.5x the next-largest text

const errors = [];
let checked = 0;

for (const card of catalog.cards ?? []) {
  if (card.placement !== 'fullframe') continue;   // overlays are subordinate by design
  checked++;
  const file = path.join(ROOT, card.slug, 'index.html');
  if (!fs.existsSync(file)) { errors.push(`${card.slug}: index.html missing`); continue; }
  const html = fs.readFileSync(file, 'utf8');
  const css = html.split('</style>')[0] || html;

  const heroDecl = css.match(/--hero-size:\s*(\d+)px/);
  if (!heroDecl) {
    errors.push(`${card.slug}: no --hero-size declared in :root (DESIGN.md → Typography)`);
    continue;
  }
  const hero = Number(heroDecl[1]);
  if (hero < HERO_MIN) {
    errors.push(`${card.slug}: --hero-size is ${hero}px, minimum is ${HERO_MIN}px`);
  }
  if (!/font-size:\s*var\(--hero-size\)/.test(css)) {
    errors.push(`${card.slug}: --hero-size is declared but never used as a font-size`);
  }

  // every literal font-size that is NOT the hero
  const others = [...css.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1]));
  const nextLargest = others.length ? Math.max(...others) : 0;
  if (nextLargest > 0 && hero / nextLargest < HERO_RATIO) {
    errors.push(
      `${card.slug}: hero ${hero}px vs next-largest ${nextLargest}px = ${(hero / nextLargest).toFixed(2)}x, needs >= ${HERO_RATIO}x — the card reads flat`,
    );
  }

  if (!/color:\s*var\(--accent\)/.test(css)) {
    errors.push(`${card.slug}: no text element uses color: var(--accent) — every fullframe card accents one word or label`);
  }

  // Tracking must be em-based on large type: a fixed -1.5px reads as tight at
  // 40px and as nothing at 160px, so a px value silently stops working the
  // moment the hero grows. This is the rule the pre-2026-07-25 library missed.
  if (!/letter-spacing:\s*-0?\.\d+em/.test(css)) {
    errors.push(`${card.slug}: no em-based negative letter-spacing found — hero type needs letter-spacing: -0.035em, not a px value`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(e);
  console.error(`\ncheck-type-scale: ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`check-type-scale OK — ${checked} fullframe card(s)`);
```

Wire it into `scripts/check-cards.sh` and add `"check-type-scale": "node scripts/check-type-scale.mjs"` to `package.json`.

**It will fail loudly on every card at this point. That is correct** — the gate lands before the work so each card is verified as you go, and so you can see the count fall.

**Verify**: `cd pipelines/video/card-library && node scripts/check-type-scale.mjs; echo "exit=$?"` -> `exit=1` with roughly 49 `no --hero-size declared` errors

### Step 3: Convert the hero-text families first (16 cards)

`title/*` (5), `section/*` (7), `statement/keyword-statement`, `slate/*` (2), `table-of-contents/table-of-contents`.

These are where the owner's complaint lands hardest (*"Especially the title"*). Per card:

1. Add `--hero-size: <120–200>px` to the card's `:root`. Pick toward 200 for 2–5 word titles, toward 120 for longer lines.
2. Apply to the hero element: `font-size: var(--hero-size)`, `font-weight: 800–900`, `letter-spacing: -0.035em`, `line-height: 1.0`, `color: var(--text)` — never `--text-dim`.
3. Pull the remaining sizes into the bands, respecting the ceiling `hero ÷ 2.5`: secondary ≤ min(56px, hero/2.5) with `letter-spacing: -0.015em` and `line-height: 1.2`; labels 22–28px uppercase, weight 700, `letter-spacing: 0.12em`, `color: var(--accent)`.
4. Ensure at least one `color: var(--accent)` on a text element.
5. Replace any remaining px `letter-spacing` on text ≥40px with the `em` equivalent — a fixed px value does not survive a size change.
6. `node scripts/card-qa.mjs <slug>` — render both variants and LOOK, scoring the rubric below.
7. If the `max` variant overflows, **reduce `max_reveal_chars` / `max_beats` in `catalog.json`** until it fits. Do not shrink the hero.
8. `node scripts/card-qa.mjs <slug> --side` — confirm it still works in the 1200px side column (plan 151's contract). The hero rule is height-based so it should survive, but a 200px hero in a 1200px column wraps differently — verify, don't assume.

**Inspection rubric** — score every card; any FAIL means fix before moving on:

| # | Check | FAIL looks like |
|---|---|---|
| 1 | One element clearly dominates | you cannot tell in one glance what the card is about |
| 2 | Hero is `--text`, not `--text-dim` | the headline is grey and recedes |
| 3 | Exactly one accent moment | no accent at all, or accent scattered over many elements |
| 4 | Nothing clips or overflows, `max` variant included | text past an edge, rows cut off |
| 5 | Hero reads at phone size | squint at the sheet — the hero should still be legible |
| 6 | Still correct at side width | the `--side` sheet fails any of 1–5 |

**Verify**: `cd pipelines/video/card-library && node scripts/check-type-scale.mjs 2>&1 | tail -1` -> error count has dropped by ~16

### Step 4: Convert the remaining fullframe families (33 cards)

Same procedure for `comparison/*` (12), `enacted/*` (9), `verdict/*` (5), `checklist/*` (2), `pros-cons`, `process/step-flow`, `prompt/prompt-typing`, `tool-icon/tool-glass-tile`.

These are denser, so the hero is often a number or a short verdict rather than a sentence — that is fine and the `--hero-size` contract handles it identically. `enacted/*` cards additionally have layout-keyed animation: after resizing, confirm the motion still lands (a bar that fills to a hardcoded px width will animate wrong once its container changes).

**Verify**: `cd pipelines/video/card-library && node scripts/check-type-scale.mjs` -> `check-type-scale OK — 49 fullframe card(s)`

### Step 5: Re-measure and run the full gate

Re-run the Step 0 measurement command. The median largest font-size must now be ≥ 120px (it was 64px before 151/152 and should not have moved much through those plans, since they changed layout rather than type).

**Verify**: `cd pipelines/video/card-library && bash scripts/check-cards.sh && node scripts/check-catalog.mjs && node scripts/check-side.mjs && node scripts/check-type-scale.mjs` -> exit 0 from all four

## Test plan

- **Mechanical**: `check-type-scale.mjs` proves every fullframe card declares and uses a `--hero-size` ≥ 120px, holds a ≥2.5× ratio to its next-largest text, and accents at least one text element.
- **Visual**: one `card-qa` contact sheet per card at full width plus one at side width, scored against the 6-point rubric. This is the real test — the gate is blind to how a card looks.
- **Capacity**: the `max` variant of every card renders without overflow; where it did not, `catalog.json` capacity came down rather than the hero.
- **Motion** (enacted only): layout-keyed animation still lands after resizing.
- **Regression**: `check-side.mjs` stays green — the 151/152 side contract must survive this sweep.

## Done criteria

- [ ] `bash scripts/check-cards.sh` exits 0
- [ ] `node scripts/check-catalog.mjs` exits 0
- [ ] `node scripts/check-side.mjs` exits 0 (151/152's work is not regressed)
- [ ] `node scripts/check-type-scale.mjs` prints `check-type-scale OK — 49 fullframe card(s)`
- [ ] `DESIGN.md` Typography section states the 120–200px hero band, the 2.5× hierarchy rule, the one-accent rule, and the "cut the words, not the type" capacity rule
- [ ] The re-measured median largest font-size is **≥ 120px** (was 64px at authoring)
- [ ] Every card has an inspected contact sheet at BOTH full and side width; the PR body lists each card with PASS
- [ ] `git diff --name-only 9fc22fb..HEAD -- card-notes.json` is EMPTY — the owner's review pass comes after this plan
- [ ] `git diff --name-only 9fc22fb..HEAD` lists only paths from the In-scope list

## STOP conditions

- **Any file under `pipelines/video/visuals-flow/` needs editing.** This is a card-library-only plan. Stop and report.
- **A card can only pass the gate by letting content overflow.** The rule is cut the words (lower `max_reveal_chars`), never shrink the hero — but if a card cannot hold its required content at 120px hero, that card needs a redesign, not a fudge. Stop and report it rather than shipping a clipped card.
- **`check-side.mjs` starts failing.** This sweep must not regress plan 151/152's side contract. Stop and report — do not edit `check-side.mjs` to make it pass.
- **`scripts/card-qa.mjs` or `scripts/check-side.mjs` appears to need a change.** Plan 151 owns them. Stop and report.
- **You are tempted to change the typeface.** Inter stays. The reference the owner liked is a monospace code editor, which is not a comparable surface; weight, tracking, leading and contrast are the levers. A font swap is separate work nobody has commissioned.
- **More than 6 cards cannot reach a 2.5× hierarchy ratio.** That suggests the ratio is wrong for this library rather than the cards being wrong. Stop and report with the list.

## Maintenance notes

- The permanent health check is the median: `node -e "…"` from Step 0. If it drifts back down as new cards are added, the gate has a hole — most likely a card declaring `--hero-size` and then not using it on the element that actually reads as the headline. The gate checks *usage*, not *prominence*, and cannot tell the difference.
- `--hero-size` is a contract, not just a variable. Its value is what `check-type-scale.mjs` measures everything against, so a card that declares 200px and applies it to a decorative glyph passes the gate while failing the intent. That is exactly the class of failure the rendered-sheet rubric exists to catch.
- The 2.5× ratio and 120px floor are the two numbers to revisit if the library's feel needs retuning. They live at the top of `check-type-scale.mjs` as named constants for that reason.
- **The owner reviews every template in the local gallery after this lands** and files notes in `card-notes.json` for anything still not reading well. That is the follow-up pass and the reason this plan deliberately does not touch notes: acting on notes written *before* the type change would mix two rounds of feedback. Handle that queue as its own fold when the owner says "apply my template notes".
- Overlay cards are deliberately exempt. If overlays ever start looking weak too, the fix is a separate, smaller band — not extending the fullframe hero rule to lower-thirds.
- This plan deliberately does NOT change the accent colour. The owner has an open question about moving to a muted gold (`#C8A24B`) while keeping the dark background; that is a `brand.json` token change plus ~29 accent-family hardcodings across 18 cards, and is cleanest as its own plan once these cards are stable.
