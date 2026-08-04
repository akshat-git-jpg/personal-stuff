---
executor: agy
model:
test_cmd: cd pipelines/video/card-library && bash scripts/check-cards.sh && cd ../visuals-flow && bash scripts/check.sh
ui: false
deploy:
needs: []
---

# Plan 163: Make array-driven beats a DECLARED pattern, not an absence

## Summary

- **Problem statement**: 4 of the 26 `beat`/`word-sync` cards carry no `beat_shape` — `enacted/bad-clip-montage`, `statement/promise-payoff`, `checklist/audience-fit`, `section/proof-of-work`. They drive their content from a variables array and their beats carry timing only. That is a legitimate second pattern, but it is expressed by *absence*, so nothing enforces it: their `max_reveal_chars` is inert, and the calibrate page renders them with generic placeholder beats that verify nothing.
- **Goals**:
  - A required `beat_source` field distinguishing the two patterns explicitly.
  - `check-catalog.mjs` enforces the correct field set for each, instead of one rule for all beat cards.
  - Drop the inert `max_reveal_chars` from the four array-driven cards.
  - Calibrate synthesizes beats from the driving array so those cards are actually verifiable.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — fully inlined contract change plus tests.
- **Done criteria** (terse): both gates exit 0; all 26 beat cards declare `beat_source`; the four render real calibrate content.
- **Stop conditions** (terse): any of the four cards' HTML is rewritten; a card's rendered output changes.
- **Test / verification for success**: `check-catalog.mjs` tests plus `lib/board.test.mjs`, and a calibrate render of one array-driven card.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5db6772..HEAD -- pipelines/video/card-library/catalog.json pipelines/video/card-library/scripts/check-catalog.mjs pipelines/video/visuals-flow/lib/board.mjs`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Difficulty**: standard
- **Planned at**: commit `5db6772`, 2026-07-28

## Why this matters

Owner decision (2026-07-28): **ratify the array-driven pattern rather than rewrite four freshly frame-verified cards** — but make it declared. "No `beat_shape`" currently means two different things that cannot be told apart: "this card drives beats from a variables array" and "somebody forgot". A contract expressed as an absence cannot be enforced, and the cost is already visible:

- `max_reveal_chars` is set on all four (28 or 60) and is **inert** — nothing reads it when there is no per-beat reveal text.
- `synthCalibrationVars` builds `max_beats` placeholder beats with generic strings, so the calibrate page shows these cards with content that does not come from their real data. Reveal text is unverifiable there, which is the surface that exists precisely to verify it.

**This relaxes part of `f35e9b8`** (boss, 2026-07-28), which made `max_reveal_chars` required for every `beat`/`word-sync` card. That fix was right for the failure it addressed — `enacted/bad-clip-montage` shipped with no `max_beats`, `synthCalibrationVars` computed `0`, and `lib/board.test.mjs` turned main red. `max_beats` stays required for everyone. Only `max_reveal_chars` becomes conditional, because for an array-driven card there is no per-beat reveal string to bound.

## Current state

**Catalog census** (run against `catalog.json` at the planned-at commit — do not assume, re-run it):

| kind | count |
|---|---|
| `single` | 38 |
| `beat` | 25 |
| `word-sync` | 1 |

22 declare `beat_shape`. The four that do not:

| slug | `max_beats` | `max_reveal_chars` | driving variables |
|---|---|---|---|
| `enacted/bad-clip-montage` | 3 | 28 | `title`, `clips` |
| `statement/promise-payoff` | 4 | 60 | `question`, `options` |
| `checklist/audience-fit` | 4 | 60 | `title`, `personas` |
| `section/proof-of-work` | 4 | 60 | `method`, `facts` |

In each, the second variable is the array that drives the beats.

**`pipelines/video/visuals-flow/lib/board.mjs`**, `synthCalibrationVars` (line 1879), verbatim opening:

```js
export function synthCalibrationVars(card) {
  const maxBeats = card.max_beats ?? 0;
  const maxChars = card.max_reveal_chars ?? 20;
  const override = CALIBRATE_OVERRIDES[card.slug] ?? {};

  const variables = {};
  for (const [key, spec] of Object.entries(card.variables ?? {})) {
    const isString = typeof spec === 'string';
    const desc = isString ? spec : (spec.descriptor || spec.type || '');
    if (isString ? /\(optional\)/i.test(desc) : spec.required === false) continue;
    if (isString ? /^array/i.test(desc) : spec.type === 'array') variables[key] = ['Calibration one', 'Calibration two', 'Calibration three'];
    else if (isString ? /^number/i.test(desc) : spec.type === 'number') variables[key] = 88;
    else variables[key] = 'Calibration title';
  }

  const beats = [];
  for (let i = 0; i < maxBeats; i++) {
```

Note it already fills array variables with three placeholder strings — but it always makes exactly `max_beats` beats regardless, and for an array-driven card those beats carry nothing the card reads.

**`lib/board.test.mjs`** asserts "every beat card synthesizes exactly `max_beats` beats" — that assertion must keep passing for BOTH patterns.

**`pipelines/video/card-library/scripts/check-catalog.mjs`** — after `f35e9b8` it fails a `beat`/`word-sync` card missing `max_beats` or `max_reveal_chars`, and fails a non-reveal card that declares them.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Card gate | `cd pipelines/video/card-library && bash scripts/check-cards.sh` | exit 0, `card check OK` |
| visuals-flow gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0 |
| Catalog check alone | `cd pipelines/video/card-library && node scripts/check-catalog.mjs` | `catalog ok` |
| Board tests | `cd pipelines/video/visuals-flow && node --test lib/board.test.mjs` | `# fail 0` |
| Census | `cd pipelines/video/card-library && node -e "const d=require('./catalog.json');const c=d.cards\|\|d;console.log(c.filter(x=>['beat','word-sync'].includes(x.kind)).length)"` | `26` |

## Scope

**In scope**:
- `pipelines/video/card-library/catalog.json`
- `pipelines/video/card-library/scripts/check-catalog.mjs`
- `pipelines/video/visuals-flow/lib/board.mjs` (`synthCalibrationVars` only)
- `pipelines/video/visuals-flow/lib/board.test.mjs`

**Out of scope**:
- **Any card's `index.html`.** The whole point of this plan is to avoid rewriting four cards that were frame-verified on landing. No rendered output may change.
- `max_beats` — stays required for every beat/word-sync card. `f35e9b8` was right about that.
- The 22 cards that already declare `beat_shape` — they get `beat_source: "beat"` added and nothing else.
- `lib/lint-cues.mjs`, `lib/resolve.mjs`.

## Git workflow

- Branch: `advisor/163-cards-beat-source-contract`
- Commit: `feat(cards): beat_source contract — array-driven beats become explicit` — no AI footers. Do NOT push.

## Steps

### Step 1: Add `beat_source` to every beat/word-sync card

In `catalog.json`, add `"beat_source": "beat"` to each of the 22 cards that declare `beat_shape`, and `"beat_source": "variables"` to the four that do not. For the four, also add `"beat_var"` naming the array that drives them, and **remove the inert `max_reveal_chars`**:

| slug | `beat_source` | `beat_var` | remove |
|---|---|---|---|
| `enacted/bad-clip-montage` | `variables` | `clips` | `max_reveal_chars: 28` |
| `statement/promise-payoff` | `variables` | `options` | `max_reveal_chars: 60` |
| `checklist/audience-fit` | `variables` | `personas` | `max_reveal_chars: 60` |
| `section/proof-of-work` | `variables` | `facts` | `max_reveal_chars: 60` |

**Insert as text — do not re-serialize `catalog.json`.** It escapes some hyphens as `-`; a `JSON.stringify` round-trip un-escapes them and buries the change in a 100+ line diff.

**Verify**:
```bash
cd pipelines/video/card-library && node -e "
const d=require('./catalog.json');const c=d.cards||d;
const bs=c.filter(x=>['beat','word-sync'].includes(x.kind));
console.log('beat/word-sync:', bs.length);
console.log('missing beat_source:', bs.filter(x=>!x.beat_source).map(x=>x.slug));
console.log('variables-driven:', bs.filter(x=>x.beat_source==='variables').map(x=>x.slug));
console.log('stray max_reveal_chars:', bs.filter(x=>x.beat_source==='variables'&&x.max_reveal_chars!==undefined).map(x=>x.slug));
"
```
-> `beat/word-sync: 26`, `missing beat_source: []`, the four listed as variables-driven, `stray max_reveal_chars: []`

### Step 2: Enforce the two patterns in `check-catalog.mjs`

Replace the blanket `max_reveal_chars` requirement added by `f35e9b8` with a per-pattern rule:

- every `beat`/`word-sync` card must declare `beat_source` (`"beat"` or `"variables"`) and `max_beats`
- `beat_source: "beat"` → must declare `beat_shape` AND `max_reveal_chars`
- `beat_source: "variables"` → must declare `beat_var`, and that name must exist in the card's `variables` with `type: "array"`; must NOT declare `beat_shape` or `max_reveal_chars`
- a `single` card must declare none of `beat_source`, `beat_shape`, `max_reveal_chars`, `max_beats`

Keep the existing non-reveal-card check from `f35e9b8` intact.

**Verify**: `cd pipelines/video/card-library && node scripts/check-catalog.mjs` -> `catalog ok`

Then prove the gate can FAIL (a green gate is not evidence it works):
```bash
cd pipelines/video/card-library
cp catalog.json /tmp/catalog.bak
python3 -c "
import json,io
s=open('catalog.json').read()
s=s.replace('\"beat_source\": \"variables\"','\"beat_source\": \"variables\", \"max_reveal_chars\": 40',1)
open('catalog.json','w').write(s)"
node scripts/check-catalog.mjs; echo "exit=$? (expect non-zero)"
cp /tmp/catalog.bak catalog.json
node scripts/check-catalog.mjs
```
**Verify**: the middle run exits non-zero naming the offending slug, and the final run prints `catalog ok`.

### Step 3: Calibrate synthesizes real content for array-driven cards

In `lib/board.mjs`'s `synthCalibrationVars`, when `card.beat_source === 'variables'`:

- fill `variables[card.beat_var]` with exactly `max_beats` entries shaped by that variable's `item_shape` (if present), using short readable strings rather than the generic three
- still emit exactly `max_beats` beats, each carrying only `{ at }` timing — so `lib/board.test.mjs`'s existing "exactly max_beats beats" assertion keeps passing for both patterns
- do not consult `max_reveal_chars` for these cards (it no longer exists on them; the existing `?? 20` fallback must not silently apply)

Leave the `beat_source: 'beat'` path exactly as it is.

**Verify**:
```bash
cd pipelines/video/visuals-flow && node -e "
import('./lib/board.mjs').then(m=>{
  const d=require('../card-library/catalog.json');const c=(d.cards||d).find(x=>x.slug==='checklist/audience-fit');
  const r=m.synthCalibrationVars(c);
  console.log('beats:', r.beats.length, '| personas:', JSON.stringify(r.variables.personas));
});"
```
-> `beats: 4` and `personas` containing 4 entries (not the generic three).

### Step 4: Tests

Append to `lib/board.test.mjs`:

1. a `beat_source: "variables"` card synthesizes exactly `max_beats` beats, each with only an `at` key
2. its `beat_var` array is filled with exactly `max_beats` entries
3. a `beat_source: "beat"` card is unchanged by this plan (same beats and reveal text as before)

Add tests for `check-catalog.mjs` if that script has a test file; if it does not, the Step 2 fail-proof is the coverage and no test file is created.

**Verify**: `cd pipelines/video/visuals-flow && node --test lib/board.test.mjs 2>&1 | tail -4` -> `# fail 0`

### Step 5: Both gates

**Verify**:
```bash
cd pipelines/video/card-library && bash scripts/check-cards.sh && cd ../visuals-flow && bash scripts/check.sh
```
-> both exit 0, ending `card check OK` and `visuals-flow check OK`

### Step 6: Confirm no rendered output changed

Render one array-driven card and confirm it still produces its device:

```bash
cd pipelines/video/card-library
npx --yes hyperframes@0.7.62 render checklist/audience-fit -o /tmp/af.mp4
for t in 1.5 4.0 6.0; do ffmpeg -v error -ss $t -i /tmp/af.mp4 -frames:v 1 /tmp/af-$t.png -y; done
```

**Verify**: open the three frames — persona chips landing, one per beat, on the shared left edge. This plan changes catalog metadata and the calibrate preview only; the card itself must look exactly as it did when plan 161 landed.

## Test plan

Three board tests plus the Step 2 fail-proof. The fail-proof matters most: `plans/runs/LESSONS.md` and the 060 rulebook both warn that a green gate is not evidence it works, and this plan's entire value is that the contract is now *enforced* rather than implied.

## Done criteria

- [ ] `cd pipelines/video/card-library && bash scripts/check-cards.sh` exits 0
- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0
- [ ] all 26 `beat`/`word-sync` cards declare `beat_source`; none of the four declares `max_reveal_chars`
- [ ] `check-catalog.mjs` exits non-zero when a `variables` card is given a `max_reveal_chars` (Step 2 fail-proof)
- [ ] `synthCalibrationVars` fills `beat_var` with `max_beats` entries for an array-driven card
- [ ] `node --test lib/board.test.mjs` reports `# fail 0`
- [ ] `git diff --stat` shows NO card `index.html` modified
- [ ] `git diff --stat catalog.json` shows insertions plus exactly 4 deletions (the removed `max_reveal_chars` lines)

## STOP conditions

- You are about to edit any card's `index.html`. The owner ratified this pattern specifically to avoid rewriting these cards. Stop and report.
- `max_beats` stops being required for any beat card — that reintroduces the `f35e9b8` failure where `synthCalibrationVars` computed 0 beats and turned main red.
- `lib/board.test.mjs`'s existing "exactly max_beats beats" assertion needs weakening to pass. It must hold for both patterns; if it cannot, the Step 3 design is wrong — stop and report.
- The catalog diff shows more than 4 deletions — the file was re-serialized. Revert and insert as text.
- A rendered frame of any of the four cards differs from its pre-plan appearance.

## Maintenance notes

- The contract in one line: **`beat_source: "beat"` means each beat carries its own content and `max_reveal_chars` bounds it; `beat_source: "variables"` means beats carry timing only and the named array carries content.** Anything that reads beats must branch on this rather than on whether `beat_shape` happens to exist.
- This is the general lesson worth keeping: a pattern expressed by the ABSENCE of a field cannot be enforced and cannot be told apart from an omission. If a third beat pattern ever appears, it gets a `beat_source` value, not another absence.
- `f35e9b8`'s non-reveal-card check (a `single` card must not declare reveal fields) is untouched and still correct.
