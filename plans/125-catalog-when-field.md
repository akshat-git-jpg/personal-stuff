<!-- boss frontmatter -->
---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: ["Depends on 124"]
---

# Plan 125: Per-card "fire me when X" moves onto the card, as a required `when` field in catalog.json

## Summary

- **Problem statement**: A card's own trigger condition is currently written twice: as the `purpose` line in `catalog.json` (what the card IS) and again as a paragraph in `cue-pass-prompt.md`'s "New cards" block (when to FIRE it). Adding a card therefore means editing a file far from the card, and nothing checks the two agree.
- **Goals**:
  - Add a required `when` field to every `catalog.json` card entry: one sentence stating the VO condition that fires it.
  - Delete the prompt's per-card "New cards (2026-07-21)" block; the catalog dump already reaches the model through `{{CATALOG}}`.
  - Make `check-catalog.mjs` fail a card that has no `when`, so a new card cannot be registered without stating its trigger.
- **Executor proposed**: `claude-p` / `sonnet` — writing 52 trigger sentences is quality-setting content the owner judges by taste (`tooling/boss/data/rules.md`).
- **Done criteria** (terse — full list below): every card has a non-empty `when`; the prompt's per-card block is gone; a card without `when` fails the catalog check; `bash scripts/check.sh` green.
- **Stop conditions** (terse — full list below): suite red before starting; a card whose trigger you cannot state without inventing policy.
- **Test / verification for success**: `check-catalog.mjs` rejects a fixture card missing `when`.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat be36087..HEAD -- pipelines/video/card-library/catalog.json pipelines/video/card-library/scripts pipelines/video/visuals-flow/steps/020-cue-pass-llm`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 124
- **Category**: tech-debt
- **Difficulty**: standard
- **Planned at**: commit `be36087`, 2026-07-22

## Why this matters

The owner's stated design is that a template carries its own definition and the pipeline decides when to use it. Half of that is already true: `catalog.json` carries each card's schema, capacity and placement. The trigger condition is the missing half, and its absence is why adding a card today touches three files.

Putting the trigger ON the card means adding a card becomes: build the folder, write the catalog entry. Two edits, both about that card, neither in a distant rules file. Cross-card arbitration stays in `lib/cue-rules.mjs` (plan 124), because those are decisions about relationships, not about any single card.

## Current state

### A catalog entry today, `catalog.json` first card verbatim

```json
{
  "slug": "prompt/prompt-typing",
  "kind": "single",
  "placement": "fullframe",
  "purpose": "a 'Prompt' panel that types its text out over the clip; [m:ss] timestamp tags glow orange, a caret blinks, the box auto-scrolls — for showing an AI-tool/video prompt being written",
  "variables": { "title": {...}, "prompt": {...} },
  "default_duration": 12
}
```

`purpose` describes the card. Nothing states the VO condition that should fire it.

### The duplicate, `cue-pass-prompt.md` lines 108-121 verbatim

```
New cards (2026-07-21) — when to fire each:
- VO dictates or the screen shows a **prompt** (AI image/video/text prompt) →
  `prompt/prompt-typing`: `variables.prompt` = the prompt verbatim (keep any
  `[m:ss]` shot tags inline), `variables.title` defaults "Prompt", `beats: []`.
- VO names/switches to a **specific tool/model** as a hero moment →
  `tool-icon/tool-glass-tile`: `logo` = tool registry slug, `name` = official
  name, optional `subtitle`, `beats: []`. Distinct from a section opener.
- A **single punchy assertion/bridge** with one phrase to emphasize →
  `statement/keyword-statement`: `text` = the spoken line, `keyword` = the 2–4
  words carrying the point, `beats: []`. Sibling of `slate/kinetic-sentence`;
  use both to punctuate bridge stretches.
- **Enumerating features/capabilities** where a concept icon helps (unless the screen is currently showing those capabilities being set — during a demo this card is illegal (fullframe)) →
  `checklist/icon-pills`: one beat per item; beat = `{icon, text, keyword?}`,
  `icon` ∈ brain|calendar|person|bolt|gear|lock|clock|chart|chat|shield|doc|search|star|cloud.
```

Only four cards got this treatment, because it was added ad hoc when those four shipped. The other 48 cards have no stated trigger anywhere.

### `card-library/scripts/check-catalog.mjs` lines 1-10 verbatim

```js
import fs from 'node:fs';
import { validateVariable } from '../../visuals-flow/lib/resolve.mjs';

const ROLES = ['heading', 'sentence', 'label', 'descriptor', 'value', 'logo_slug', 'icon_name', 'free'];
const catalog = JSON.parse(fs.readFileSync('catalog.json', 'utf8'));

let failed = false;
function err(msg) {
  console.error(msg);
  failed = true;
}
```

It runs with cwd = `card-library` (the catalog path is relative), invoked from `scripts/check-cards.sh`.

### How the catalog reaches the model

`cue-pass-prompt.md:202-203` carries a `{{CATALOG}}` placeholder that the operating session fills with a dump of `catalog.json`. A new field on each entry therefore reaches the model with no prompt change, which is why deleting the prompt's per-card block loses nothing.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate (merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, ends `visuals-flow check OK` |
| Catalog check alone | `cd pipelines/video/card-library && node scripts/check-catalog.mjs` | exit 0 |
| Card structural check | `cd pipelines/video/card-library && bash scripts/check-cards.sh` | exit 0 |
| Count cards | `cd pipelines/video/card-library && node -e "console.log(require('./catalog.json').cards.length)"` | `52` |

## Scope

**In scope**:
- `pipelines/video/card-library/catalog.json`
- `pipelines/video/card-library/scripts/check-catalog.mjs`
- `pipelines/video/card-library/CLAUDE.md` (the "Two registrations" table gains the `when` requirement)
- `pipelines/video/visuals-flow/steps/020-cue-pass-llm/cue-pass-prompt.md` (delete lines 108-121 only)

**Out of scope**:
- `lib/cue-rules.mjs` — plan 124 owns cross-card arbitration. A rule that mentions two cards in opposition is NOT a `when`.
- Any card's `index.html`. This plan does not touch card rendering.
- `gallery-order.json` — ordering only, unrelated.
- `videos/**` — never touch a video workdir.

## Git workflow

- Branch: `advisor/125-catalog-when-field`
- Commit: `card-library: every card states its own trigger condition (when)` — no AI footers. Do NOT push.

## Steps

### Step 1: Add `when` to the four cards that already have stated triggers

Move the text from `cue-pass-prompt.md:108-121` onto these entries, one sentence each, phrased as the VO condition:

- `prompt/prompt-typing` -> `"when": "The VO dictates a prompt, or the screen shows an AI image/video/text prompt being written."`
- `tool-icon/tool-glass-tile` -> `"when": "The VO names or switches to a specific tool or model as a hero moment. Distinct from a section opener."`
- `statement/keyword-statement` -> `"when": "A single punchy assertion or bridge line with one phrase worth emphasising. Sibling of slate/kinetic-sentence."`
- `checklist/icon-pills` -> `"when": "The VO enumerates features or capabilities and a concept icon per item helps."`

Place `when` immediately after `purpose` in each entry, so a reader sees what-it-is then when-to-fire.

**Verify**: `cd pipelines/video/card-library && node -e "const c=require('./catalog.json');console.log(c.cards.filter(x=>x.when).length)"` -> `4`

### Step 2: Write `when` for the remaining 48 cards

For each card, derive the trigger from its existing `purpose` and from how it is used in `videos/test-01/cues.json` and `videos/test-02/cues.json` (read those for real usage; do not modify them).

Rules for the sentence:
- One sentence, present tense, starting with the VO or screen condition.
- State the condition, not the card's appearance. `purpose` already covers appearance.
- Never restate a number. Numbers are governed by `lib/cue-constants.mjs` and `check-rulebook.mjs:10-17` will fail the build.
- Never state a rule about a DIFFERENT card. If the trigger only makes sense as "use A rather than B", that is cross-card arbitration and belongs in `lib/cue-rules.mjs`; write the plain condition here and note the pair in your final report.

**Verify**: `cd pipelines/video/card-library && node -e "const c=require('./catalog.json');const m=c.cards.filter(x=>!x.when||!x.when.trim());console.log(m.length?('MISSING: '+m.map(x=>x.slug).join(', ')):'all cards have when')"` -> `all cards have when`

### Step 3: Enforce `when` in `check-catalog.mjs`

Inside the existing `for (const card of catalog.cards)` loop, add:

```js
  if (typeof card.when !== 'string' || !card.when.trim()) {
    err(`FAIL: ${card.slug} missing "when" — every card must state the VO condition that fires it`);
  }
```

**Verify**: `cd pipelines/video/card-library && node scripts/check-catalog.mjs` -> exit 0. Then temporarily delete one card's `when`, re-run, confirm it fails naming that slug, and restore it.

### Step 4: Delete the prompt's per-card block

Remove `cue-pass-prompt.md` lines 108-121 (the "New cards (2026-07-21) — when to fire each:" block) entirely. Do not replace it with anything: the catalog dump carries this now.

Leave every other line of the prompt alone. In particular do not touch the generated marker pairs.

**Verify**: `cd pipelines/video/visuals-flow && node lib/build-prompt.mjs --check && node lib/check-rulebook.mjs` -> exit 0, prints `rulebook ok`

### Step 5: Update `card-library/CLAUDE.md`

In the "Two registrations, not one" table, change the visuals-flow row's "Needs" cell from:

`a `catalog.json` entry (`slug: "<type>/<card>"`)`

to:

`a `catalog.json` entry with `slug`, `purpose` AND `when``

and add one line under the table: `A card with no `when` is registered but has no stated trigger, so the cue pass has no basis to select it. `scripts/check-catalog.mjs` rejects it.`

**Verify**: `cd pipelines/video/card-library && bash scripts/check-cards.sh` -> exit 0

## Test plan

The enforcement in Step 3 is the durable part. Verify it by induced failure (delete a `when`, confirm the named failure, restore), as described in Step 3. No new test file is needed: `check-catalog.mjs` is itself the test, and `check-cards.sh` runs it.

## Done criteria

- [ ] All 52 cards have a non-empty `when`, positioned after `purpose`
- [ ] `node scripts/check-catalog.mjs` exits 0
- [ ] Deleting one card's `when` makes it fail, naming that slug
- [ ] `cue-pass-prompt.md` no longer contains "New cards (2026-07-21)"
- [ ] `node lib/build-prompt.mjs --check` exits 0
- [ ] `card-library/CLAUDE.md` documents the `when` requirement
- [ ] `bash scripts/check.sh` exits 0

## STOP conditions

- `bash scripts/check.sh` is already red before you start. Report and stop.
- A card's trigger cannot be stated without inventing new policy. Write your best plain reading of `purpose`, mark that card in your final report, and continue. Do not invent a rule the owner never set.
- A trigger only makes sense as a comparison against another card. That is cross-card arbitration, owned by plan 124. Do not put it here.
- You need to change a card's `purpose` to make `when` fit. Stop: `purpose` is what the model already routes on today and changing it alters live behaviour beyond this plan's scope.
- You find yourself editing anything under `videos/`. Stop immediately.

## Maintenance notes

- After this lands, adding a card is: create `<type>/<name>/index.html`, add a catalog entry with `purpose` + `when`, push. `check-cards.sh` enforces both registrations.
- The `when` sentences are the highest-value text in the catalog for cue quality. Expect the 060 fold to revise them over time; that is correct, and it is why they live next to the card rather than in a rules file.
