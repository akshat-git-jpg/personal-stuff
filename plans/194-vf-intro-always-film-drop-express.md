---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: []
needs_prs: []
touches: [pipelines/video/visuals-flow/lib/intro-modes.mjs, pipelines/video/visuals-flow/lib/intro-mode-table.mjs, pipelines/video/visuals-flow/lib/intro-modes.test.mjs, pipelines/video/visuals-flow/lib/intro-film/owns-intro.mjs, pipelines/video/visuals-flow/lib/intro-film/owns-intro.test.mjs, pipelines/video/visuals-flow/lib/intro-film/approve.mjs, pipelines/video/visuals-flow/lib/run-config.mjs, pipelines/video/visuals-flow/lib/run-config.test.mjs, pipelines/video/visuals-flow/lib/zone-constants.mjs, pipelines/video/visuals-flow/lib/lint-cues.mjs, pipelines/video/visuals-flow/lib/build-zone-prompt.mjs, pipelines/video/visuals-flow/lib/card-plan.mjs, pipelines/video/visuals-flow/lib/card-plan.test.mjs, pipelines/video/visuals-flow/lib/assemble.mjs, pipelines/video/visuals-flow/lib/lint-shots.mjs, pipelines/video/visuals-flow/lib/avatar-render.mjs, pipelines/video/visuals-flow/lib/avatar-render.test.mjs, pipelines/video/visuals-flow/lib/render.mjs, pipelines/video/visuals-flow/lib/board.mjs, pipelines/video/visuals-flow/lib/board-data.mjs, pipelines/video/visuals-flow/lib/board.test.mjs, pipelines/video/visuals-flow/lib/steps.mjs, pipelines/video/visuals-flow/lib/regression-cards.test.mjs, pipelines/video/visuals-flow/lib/intro-invariants.test.mjs, pipelines/video/visuals-flow/run.sh, pipelines/video/visuals-flow/scripts/check.sh, pipelines/video/visuals-flow/steps]

mutation_apply: python3 -c "p='pipelines/video/visuals-flow/lib/lint-cues.mjs';s=open(p).read();m='// E13-REMOVED-INTRO-ALWAYS-FILM';assert m in s;i=s.index(m);e=s.index(chr(10),i);inj='  { const ff = sortedResolved.find((r) => r.placement === \'fullframe\'); if ((ff ? ff.start : Infinity) > 0.5) errors.push(\'E13 open-cover: nothing covers the opening\'); }'+chr(10);open(p,'w').write(s[:e+1]+inj+s[e+1:])"
mutation_command: cd pipelines/video/visuals-flow && node --test lib/intro-invariants.test.mjs
mutation_expect: must never fire
mutation_cwd:
mutation_timeout:
---

# Plan 194: visuals-flow — the intro is always the film; express review is gone

## Summary

- **Problem statement**: `run-config.json` carries two owner knobs that no longer
  have a second setting worth supporting. `intro` selects between a catalog-cards
  intro and the bespoke intro film; the owner has decided the intro is **always**
  the bespoke film ("i want film only.., basically intro is bespook", 2026-08-07).
  `review: express` waives the 037 and 080 owner gates; the owner has removed
  express entirely so every gate is real. Both knobs are branch-points threaded
  through ~15 lib modules, 21 step declarations and `run.sh`, and every `false`
  branch is now dead code that no run exercises.
- **Goals**:
  - Delete the intro-mode concept entirely — the table, the capability query, the
    config field, the `--intro` flag, `requires.intro` on every step, and every
    `if (ownsIntroSpan(...))` branch.
  - Keep ONE thing from it: a plain `introSpan(workdir)` helper. Four modules
    genuinely need "where does the intro start and end" regardless of modes.
  - Delete express review — the `review` field, `gateWaived()`, and the
    `waivable` flag on every step declaration.
  - Replace `lib/regression-cards.test.mjs` (which exists to assert the
    now-deleted cards path is untouched) with `lib/intro-invariants.test.mjs`,
    asserting the new invariant instead.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — every call site is
  enumerated in this plan with line numbers and replacement code; no exploration
  required.
- **Done criteria** (terse — full list below): `bash scripts/check.sh` exits 0;
  zero occurrences of `ownsIntroSpan`/`gateWaived`/`INTRO_MODES`/`waivable`/
  `requires` outside this plan's allowed list; `intro-invariants.test.mjs` passes.
- **Stop conditions** (terse — full list below): baseline red before you start;
  any gate assertion weakened rather than fixed; any change to
  `videos/*/run-config.json`.
- **Test / verification for success**: the repo gate `scripts/check.sh` (711
  assertions at the planned-at SHA) plus a new invariants test, plus a mutation
  proof that the new test can actually fail.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2e2dd69d..HEAD -- pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/steps pipelines/video/visuals-flow/run.sh pipelines/video/visuals-flow/scripts/check.sh`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none — this is the first plan of the pipeline-restructure batch (194 → 195 → 196 → 197)
- **Category**: tech-debt
- **Difficulty**: standard
- **Planned at**: commit `2e2dd69d`, 2026-08-07

## Why this matters

The pipeline supports two intro flows and two review depths. In practice it has
one of each: every video the owner makes uses the bespoke intro film, and
express review waives exactly the two gates that plan 195 is about to
restructure. A branch with one live side is not flexibility — it is untested
code that reads as coverage. `lib/regression-cards.test.mjs` is the sharpest
illustration: it runs on every gate invocation, asserting that the `cards` path
still behaves as it did, guarding a path nothing will ever take again.

The capability table (`lib/intro-mode-table.mjs`) was built deliberately so a
third flow would be one row rather than a hunt through consumers. That was good
design for the problem it had. The owner's decision removes the problem: the
only other intro flow that ever existed is the one being deleted, and the
realistic "third flow" discussed (a bespoke *conclusion* film) would need its
own `ownsConclusionSpan` capability and would not reuse this table at all.

What survives is the part that was never about modes: the intro span. Assembly
splices the film over it, `lint-shots` stops demanding a host inside it,
`avatar-render` excludes it, and the board reports it. That question has one
answer forever and deserves a plain function.

## Current state

All paths below are relative to `pipelines/video/visuals-flow/`.

### The two config knobs

`lib/run-config.mjs` lines 23–37 (read at `2e2dd69d`):

```js
const DEFAULTS = { engine: 'heygen3', review: 'full', intro: 'cards' };
const ENGINES = ['heygen3', 'heygen4'];
const REVIEWS = ['full', 'express'];
const INTROS = INTRO_MODE_NAMES;

export function loadRunConfig(workdir) {
  const p = path.join(workdir, 'run-config.json');
  if (!fs.existsSync(p)) return { ...DEFAULTS, configured: false };
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const cfg = { ...DEFAULTS, ...raw, configured: true };
  if (!ENGINES.includes(cfg.engine)) throw new Error(`run-config.json: engine must be one of ${ENGINES.join('|')}, got "${cfg.engine}"`);
  if (!REVIEWS.includes(cfg.review)) throw new Error(`run-config.json: review must be one of ${REVIEWS.join('|')}, got "${cfg.review}"`);
  if (!INTROS.includes(cfg.intro)) throw new Error(`run-config.json: intro must be one of ${INTROS.join('|')}, got "${cfg.intro}"`);
  return cfg;
}
```

and lines 41–49:

```js
export function gateWaived(workdir, gateName) {
  const cfg = loadRunConfig(workdir);
  if (cfg.review !== 'express') return false;
  console.error(`note: ${gateName} approval skipped — run-config review=express (owner kickoff choice)`);
  return true;
}
```

**`engine` is NOT touched by this plan.** It moves to the avatar-proposal gate in
plan 196. Leave it exactly as it is.

### The mode table and capability query

`lib/intro-mode-table.mjs` (whole file) declares:

```js
export const INTRO_MODES = {
  cards: { label: 'catalog cards', ownsIntroSpan: false, spanFrom: null },
  film:  { label: 'bespoke intro film', ownsIntroSpan: true, spanFrom: 'segments.structure.intro' },
};
export const INTRO_MODE_NAMES = Object.keys(INTRO_MODES);
```

`lib/intro-modes.mjs` exports `introModeFor`, `ownsIntroSpan`, `introSpanFor`.
`introSpanFor` is the only part that survives:

```js
export function introSpanFor(workdir) {
  const mode = introModeFor(workdir);
  if (!mode.ownsIntroSpan) return null;
  if (mode.spanFrom !== 'segments.structure.intro') {
    throw new Error(`E-INTRO mode "${mode.name}" declares spanFrom "${mode.spanFrom}", which has no reader`);
  }
  const segmentsFile = path.join(workdir, 'segments.json');
  if (!fs.existsSync(segmentsFile)) return null;
  const segData = JSON.parse(fs.readFileSync(segmentsFile, 'utf8'));
  const introPart = segData.structure?.find((p) => p.part === 'intro');
  if (!introPart) return null;
  return { start: introPart.start, end: introPart.end };
}
```

`lib/intro-film/owns-intro.mjs` is a deprecated 6-line alias re-exporting both
under their old names.

### Every call site (verified by grep at `2e2dd69d`)

`ownsIntroSpan` / `introSpanFor`:

| File | Line | What it does |
|---|---|---|
| `lib/zone-constants.mjs` | 1, 59–61 | `zonePartsFor()` returns `['conclusion']` when film owns, else `ZONE_PARTS` |
| `lib/lint-cues.mjs` | 6, 364, 376 | E13 suppression; E23 activation |
| `lib/lint-cues.mjs` | 397 | `if (workdir && !zonePartsFor(workdir).includes(part.part)) continue;` |
| `lib/build-zone-prompt.mjs` | 7, 42 | `if (workdir && !zonePartsFor(workdir).includes('intro'))` |
| `lib/card-plan.mjs` | 4, 24, 39 | `workdir ? zonePartsFor(workdir) : ZONE_PARTS` |
| `lib/assemble.mjs` | 16, 1042–1043 | film span + `requireIntroApproved` |
| `lib/lint-shots.mjs` | 6, 256 | `filmSpan: introSpanFor(workdir)` |
| `lib/avatar-render.mjs` | 9, 164 | `filmSpan: introSpanFor(workdir)` |
| `lib/board.mjs` | 28, 52, 774–775 | `bootFilesFor()`; lintShots filmSpan |
| `lib/board-data.mjs` | 24–33 | `applicableTabs()` filters tabs on `requires.intro` vs `cfg.intro` |
| `lib/steps.mjs` | 19, 105–107, 233–235 | `INTRO_MODES` validation + `nextStep` filtering |

`lib/board-data.mjs` lines 24–33 as they stand — this one is easy to miss because
it reads the registry field rather than calling the capability query, and it is
what plan 193 added:

```js
export function applicableTabs(workdir, { steps = null } = {}) {
  const cfg = loadRunConfig(workdir);
  const tabs = new Set(ALWAYS_TABS);
  for (const s of (steps ?? loadSteps())) {
    if (!s.tab) continue;
    if (s.requires.intro !== null && s.requires.intro !== cfg.intro) continue;
    tabs.add(s.tab);
  }
  return [...tabs];
}
```

Removing `requires` from `step.json` without fixing this throws
`TypeError: Cannot read properties of undefined (reading 'intro')` on **every**
board request.

`gateWaived`:

| File | Line |
|---|---|
| `lib/intro-film/approve.mjs` | 23 |
| `lib/render.mjs` | 203, 214 |
| `lib/avatar-render.mjs` | 131 |
| `lib/assemble.mjs` | 954, 998 |

Tests referencing either: `lib/intro-modes.test.mjs`, `lib/intro-film/owns-intro.test.mjs`,
`lib/regression-cards.test.mjs`, `lib/card-plan.test.mjs` (lines 11, 176–199),
`lib/run-config.test.mjs` (line 72+), `lib/avatar-render.test.mjs` (lines 140–144).

### The step registry

`lib/steps.mjs` line 19 declares `const INTRO_MODES = [null, 'cards', 'film'];`
and lines 105–107 validate `requires.intro`. Line 233 signature:
`nextStep({ steps, introMode = 'cards', express = false, exists, readFlag })`,
line 235 filters, line 238 honours `express && s.waivable`.

Every one of the 21 `steps/*/step.json` files carries `"waivable": <bool>` and
`"requires": { "intro": null|"cards"|"film" }`. Only `025` and `027` use a
non-null `requires.intro` (both `"film"`). Only `037` and `080` set
`"waivable": true`.

### run.sh

Lines 169–201 set `run_engine`/`run_review`/`run_intro`, echo them, and pass
`"$run_intro" "$run_review"` to `node lib/steps.mjs next`. Lines 242–250 guard
the three `intro-*` verbs:

```bash
  intro-film|intro-review|intro-render)
    intro_mode=$(node -e "import('./lib/run-config.mjs').then(m=>console.log(m.loadRunConfig('videos/$slug').intro))")
    if [[ "$intro_mode" != "film" ]]; then
      echo "intro=$intro_mode — this video does not use the bespoke intro film."
      echo "Opt in with: bash run.sh $slug configure --intro film"
```

### The gate script

`scripts/check.sh` finds every `lib/**/*.test.mjs` (no hand-typed list) and
carries this comment, which names the file this plan replaces:

```
# regression-cards is the one that stings —
# it asserts the intro:"cards" default path is untouched, which is exactly the
# guard you want running on every change.
```

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate (the merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exits 0, last line `visuals-flow check OK` |
| One test file | `cd pipelines/video/visuals-flow && node --test lib/intro-invariants.test.mjs` | exits 0 |
| Registry doc check | `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs --check` | exits 0 |
| Regenerate the doc table | `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs` | rewrites `PIPELINE.md` |
| run.sh self-test | `cd pipelines/video/visuals-flow && bash scripts/test-run-sh.sh` | `run.sh test OK` |

**Never** write `node --test <dir>` — on node 22.14 a directory argument fails
with `Cannot find module '.../test'` (LESSONS 2026-07-09). Use a file path, or
`node --test` with no argument from the package dir.

## Scope

**In scope** (all under `pipelines/video/visuals-flow/`):
- `lib/intro-modes.mjs`, `lib/intro-mode-table.mjs` (delete), `lib/intro-modes.test.mjs`
- `lib/intro-film/owns-intro.mjs` (delete), `lib/intro-film/owns-intro.test.mjs` (delete)
- `lib/intro-film/approve.mjs`
- `lib/run-config.mjs`, `lib/run-config.test.mjs`
- `lib/zone-constants.mjs`, `lib/lint-cues.mjs`, `lib/build-zone-prompt.mjs`
- `lib/card-plan.mjs`, `lib/card-plan.test.mjs`
- `lib/assemble.mjs`, `lib/lint-shots.mjs`, `lib/avatar-render.mjs`, `lib/avatar-render.test.mjs`
- `lib/render.mjs`, `lib/board.mjs`, `lib/board-data.mjs`, `lib/board.test.mjs`, `lib/steps.mjs`
- `lib/regression-cards.test.mjs` (delete) → `lib/intro-invariants.test.mjs` (new)
- all 21 `steps/*/step.json`
- `run.sh`, `scripts/check.sh`, `PIPELINE.md` (regenerated, never hand-edited)

**Out of scope** — looks related, do not touch:
- **`engine` in `run-config.mjs`** and the `engineMode` cross-check in
  `lib/avatar-render.mjs` lines 138–148. Plan 196 moves the engine decision to
  the avatar-proposal gate. Removing it here would collide.
- **`videos/*/run-config.json`.** Three real videos carry `review` and `intro`
  keys. `loadRunConfig` spreads `{...DEFAULTS, ...raw}` and, once the validators
  are gone, simply ignores unknown keys — the stale keys are harmless and plan
  197's migration cleans them. Editing owner data is not this plan's job.
- **Step renumbering.** Plan 197 does that. Keep every folder name as-is.
- **The 037 card-plan gate and the board's Card Plan tab.** Plan 195. This plan
  removes `waivable` (the express waiver) but leaves the gates themselves.
- **`board-ui/`** — no UI change here.

## Git workflow

- Branch: `advisor/194-vf-intro-always-film-drop-express`
- Commit per step, message `plan 194 step N: <what>` — no AI footers. Do NOT push.

## Steps

### Step 1: Confirm a green baseline

```bash
cd pipelines/video/visuals-flow && bash scripts/check.sh
```

**Verify**: exits 0, last line `visuals-flow check OK`. If it is red **before you
change anything**, STOP and report — see STOP conditions.

### Step 2: Reduce `lib/intro-modes.mjs` to the span helper, delete the table and the alias

Replace the **entire contents** of `lib/intro-modes.mjs` with:

```js
import fs from 'node:fs';
import path from 'node:path';

// The intro is ALWAYS the bespoke intro film (owner decision 2026-08-07:
// "i want film only.., basically intro is bespook"). There is no mode to pick,
// so there is no capability query any more — this module answers the one
// question that survives the choice: WHERE is the intro?
//
// This replaced lib/intro-mode-table.mjs + ownsIntroSpan(). That table existed
// so a third intro flow would be one row instead of a hunt through consumers,
// which was right while `cards` and `film` both existed. With `cards` gone the
// table had a single row and every `if (ownsIntroSpan(...))` had a dead false
// branch — untested code that reads as coverage. The realistic next bespoke
// part (a conclusion film) would need its own span helper, not this one.
//
// Returns null when segments.json has not been written yet, or carries no
// intro part. Callers treat null as "not measured yet", never as "no film".
export function introSpan(workdir) {
  const segmentsFile = path.join(workdir, 'segments.json');
  if (!fs.existsSync(segmentsFile)) return null;
  const segData = JSON.parse(fs.readFileSync(segmentsFile, 'utf8'));
  const introPart = segData.structure?.find((p) => p.part === 'intro');
  if (!introPart) return null;
  return { start: introPart.start, end: introPart.end };
}
```

Then delete four files:

```bash
cd pipelines/video/visuals-flow
rm lib/intro-mode-table.mjs lib/intro-modes.test.mjs
rm lib/intro-film/owns-intro.mjs lib/intro-film/owns-intro.test.mjs
```

**Verify**: `node -e "import('./lib/intro-modes.mjs').then(m=>console.log(Object.keys(m)))"`
→ prints `[ 'introSpan' ]`

### Step 3: `lib/run-config.mjs` — drop `intro` and `review`

- Delete the `import { INTRO_MODE_NAMES } from './intro-mode-table.mjs';` line.
- `DEFAULTS` becomes `{ engine: 'heygen3' }`.
- Delete `const REVIEWS`, `const INTROS`, and both validator lines for
  `cfg.review` and `cfg.intro`. Keep the `engine` validator.
- Delete `export function gateWaived(...)` entirely.
- Update the header comment: replace the `review:` and `intro:` bullets with a
  single line: `// Express review and the intro-mode choice were removed 2026-08-07 (plan 194): every gate is real, and the intro is always the bespoke film.`
- In `main()`, the usage string becomes:
  `'usage: node lib/run-config.mjs <slug> [--engine heygen3|heygen4]'` — and any
  `--review` / `--intro` argument parsing in that function is deleted.

**Verify**: `node -e "import('./lib/run-config.mjs').then(m=>console.log('gateWaived' in m))"`
→ prints `false`

### Step 4: `lib/zone-constants.mjs` — one constant, no function

- Delete the `import { ownsIntroSpan } from './intro-modes.mjs';` line (line 1).
- Replace lines 57–61 with:

```js
// The intro film owns the intro on every video (plan 194), so the cue passes
// author the CONCLUSION only. This was zonePartsFor(workdir), branching on the
// intro mode; with one mode the branch was dead.
export const ZONE_PARTS = ['conclusion'];
```

**Verify**: `node -e "import('./lib/zone-constants.mjs').then(m=>console.log(JSON.stringify(m.ZONE_PARTS), 'zonePartsFor' in m))"`
→ prints `["conclusion"] false`

### Step 5: `lib/lint-cues.mjs` — E13 gone, E23 unconditional, ZONE_PARTS direct

Three edits.

**(a)** Line 6: delete `import { ownsIntroSpan } from './intro-modes.mjs';`.
Line 7 becomes `import { ZONE_CONSTANTS, ENACTED_PREFIX, ZONE_PARTS } from './zone-constants.mjs';`

**(b)** Replace the whole E13 block (the `{ ... }` spanning roughly lines 359–375,
from the `// E13 open-cover` comment through its closing brace) with exactly:

```js
  // E13-REMOVED-INTRO-ALWAYS-FILM: the intro film covers second zero on every
  // video (plan 194), so nothing may demand a fullframe cover card there. This
  // was an error with an ownsIntroSpan() suppression around it; with the film
  // always owning the intro, the enforcing branch could never run.
```

Keep the marker comment text verbatim — the merge-time mutation gate anchors on it.

**(c)** The E23 block immediately below loses its condition. Replace
`if (workdir && ownsIntroSpan(workdir)) {` with `if (workdir) {` and keep the body
unchanged, updating its inner error string's phrase `the active intro flow owns`
to `the intro film owns`.

**(d)** Line ~397: `if (workdir && !zonePartsFor(workdir).includes(part.part)) continue;`
becomes `if (workdir && !ZONE_PARTS.includes(part.part)) continue;`

**Verify**: `grep -c "ownsIntroSpan\|zonePartsFor" lib/lint-cues.mjs` → `0`

### Step 6: the remaining `zonePartsFor` consumers

`lib/build-zone-prompt.mjs`: line 7 import becomes
`import { ZONE_CONSTANTS, ZONE_PARTS } from './zone-constants.mjs';`; line 42's
condition becomes `if (workdir && !ZONE_PARTS.includes('intro')) {`.

> Note for the executor: `ZONE_PARTS` no longer contains `'intro'`, so that
> branch is now always taken when `workdir` is set. **Leave the branch in place**
> — plan 196 rewrites this prompt builder for the conclusion-only step, and
> collapsing it here would collide.

`lib/card-plan.mjs`: line 4 becomes `import { ZONE_PARTS } from './zone-constants.mjs';`.
Lines 24 and 39 — `workdir ? zonePartsFor(workdir) : ZONE_PARTS` — both become
plain `ZONE_PARTS`.

`lib/card-plan.test.mjs`: line 11 drops the `zonePartsFor` import. Replace the
whole `test('zonePartsFor', ...)` block (lines 176–199) with:

```js
test('ZONE_PARTS is conclusion-only — the intro film owns the intro', () => {
  assert.deepStrictEqual(ZONE_PARTS, ['conclusion'],
    'ZONEPARTS-CAPABILITY-VIOLATION: the cue passes must never author the intro zone');
});
```

adding `ZONE_PARTS` to that file's existing `zone-constants.mjs` import.

> The assertion message `ZONEPARTS-CAPABILITY-VIOLATION` is load-bearing — plan
> 192 armed a mutation gate on that exact string. Keep it verbatim.

**Verify**: `grep -rc "zonePartsFor" lib/ | grep -v ':0' || echo NONE` → `NONE`

### Step 7: the `introSpanFor` → `introSpan` renames

Four files, mechanical. In each, change the import to
`import { introSpan } from './intro-modes.mjs';` (from `'../intro-modes.mjs'` where
already relative) and the call to `introSpan(workdir)`:

- `lib/lint-shots.mjs` — line 6 import, line 256 call
- `lib/avatar-render.mjs` — line 9 import, line 164 call
- `lib/board.mjs` — line 774's dynamic `await import('./intro-modes.mjs')` destructure
  becomes `const { introSpan } = await import('./intro-modes.mjs');` and line 775's
  `filmSpan: filmSpanForBoard(workdir)` becomes `filmSpan: introSpan(workdir)`
- `lib/assemble.mjs` — line 16 import; line 1042 `const filmSpan = introSpan(workdir);`

**Verify**: `grep -rc "introSpanFor\|ownsIntroSpan" lib/ | grep -v ':0' || echo NONE` → `NONE`
(after Step 8 also clears `lib/board.mjs` line 52 and `lib/assemble.mjs` line 1043)

### Step 8: the two `ownsIntroSpan(...)` conditionals become unconditional

`lib/board.mjs` line 52 — `bootFilesFor` currently drops `cues.json` from the
boot precondition when the film owns the intro. It always does now:

```js
export function bootFilesFor(workdir) {
  // The film owns the intro on every video (plan 194), and cues.json is not
  // written until the body pass — so it can never be a boot precondition.
  return BOOT_FILES.filter((n) => n !== 'cues.json');
}
```

Delete `lib/board.mjs` line 28's `import { ownsIntroSpan } from './intro-modes.mjs';`.
Keep the `workdir` parameter even though it is now unused — every caller passes it
and plan 197 renumbers around this signature.

`lib/assemble.mjs` lines 1043–1051 — delete the `if (ownsIntroSpan(workdir)) {`
wrapper and dedent its body, so the missing-film check and `requireIntroApproved`
always run:

```js
  const filmSpan = introSpan(workdir);
  const introFile = path.join(workdir, 'intro-film', 'out', 'intro.mp4');
  if (!fs.existsSync(introFile)) {
    throw new Error(`missing intro film: ${introFile} — run.sh ${video} intro-render`);
  }
  requireIntroApproved(workdir);
```

**Verify**: `grep -rc "ownsIntroSpan" lib/ | grep -v ':0' || echo NONE` → `NONE`

### Step 9: remove every `gateWaived` call

Five call sites. In each, delete the `&& !gateWaived(...)` clause (keeping the
rest of the condition) and drop `gateWaived` from that file's `run-config.mjs`
import — but **keep `loadRunConfig`** where it is also imported
(`lib/avatar-render.mjs`).

- `lib/render.mjs` line 203: `if (fs.existsSync(cardPlanPath) && !gateWaived(workdir, 'card-plan (037)')) {` → `if (fs.existsSync(cardPlanPath)) {`
- `lib/render.mjs` line 214, `lib/assemble.mjs` line 954: `if (cuesFile.approved !== true && !opts.force) {`
- `lib/assemble.mjs` line 998, `lib/avatar-render.mjs` line 131: `if (shotsFile.approved !== true && !opts.force) {`
- `lib/intro-film/approve.mjs` line 23: delete the whole `if (gateWaived(...)) return;` line and the `gateWaived` import.

Also update `lib/assemble.mjs`'s comment above line 954 — it currently explains
the express waiver. Replace with:
`// 080 board approval. Express review was removed 2026-08-07 (plan 194): there is no waiver, only --force, which is a developer escape hatch and is never used in a real run.`

**Verify**: `grep -rc "gateWaived" lib/ | grep -v ':0' || echo NONE` → `NONE`

### Step 10: tests that assert the deleted behaviour

`lib/run-config.test.mjs`: delete the `gateWaived` test (line 72+) and any
assertion that `review` or `intro` defaults/validates. Keep the `engine` tests.

`lib/avatar-render.test.mjs`: delete "Case 3b" (lines ~140–144), the express-waives
case. Keep the surrounding approved/not-approved cases.

**Verify**: `node --test lib/run-config.test.mjs lib/avatar-render.test.mjs` → exits 0

### Step 11: replace the cards regression test with the film invariant test

```bash
cd pipelines/video/visuals-flow && rm lib/regression-cards.test.mjs
```

Create `lib/intro-invariants.test.mjs` with exactly this content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lintCues } from './lint-cues.mjs';
import { ZONE_PARTS } from './zone-constants.mjs';
import { introSpan } from './intro-modes.mjs';

// Replaces lib/regression-cards.test.mjs, which asserted the intro:"cards" path
// stayed untouched. That path is gone (plan 194): the intro is ALWAYS the
// bespoke film. These are the invariants that replace it — every assertion
// message carries INTRO-ALWAYS-FILM so a failure names the decision it broke.

function tmpWorkdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'intro-invariants-'));
}

const STRUCTURE = [
  { part: 'intro', start: 0, end: 10 },
  { part: 'body', start: 10, end: 20 },
  { part: 'conclusion', start: 20, end: 30 },
];

function lintInputs(workdir) {
  const cues = [{ id: 'z1', placement: 'fullframe', start: 12, duration: 2, card: 'body/thing' }];
  return {
    workdir,
    cuesFile: { cues, approved: true },
    resolved: cues,
    words: [],
    catalog: { cards: {} },
    segmentsData: { structure: STRUCTURE },
    manifest: { base: 'screen' },
    conceptData: null,
    avatarJobs: null,
  };
}

test('INTRO-ALWAYS-FILM: the cue passes author the conclusion only', () => {
  assert.deepEqual(ZONE_PARTS, ['conclusion'],
    'INTRO-ALWAYS-FILM: ZONE_PARTS must be ["conclusion"] — the film owns the intro span');
});

test('INTRO-ALWAYS-FILM: E13 open-cover never fires — the film covers second zero', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'segments.json'), JSON.stringify({ structure: STRUCTURE }));
  // No fullframe cue anywhere near t=0, and no avatar span. Under the old
  // cards flow this was an E13 error; the film makes it correct.
  const report = lintCues(lintInputs(w));
  const e13 = (report.errors ?? []).filter((e) => String(e).includes('E13'));
  assert.deepEqual(e13, [],
    `INTRO-ALWAYS-FILM: E13 open-cover must never fire — the intro film covers second zero, got ${JSON.stringify(e13)}`);
  fs.rmSync(w, { recursive: true, force: true });
});

test('INTRO-ALWAYS-FILM: introSpan reads the measured intro from segments.json', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'segments.json'), JSON.stringify({ structure: STRUCTURE }));
  assert.deepEqual(introSpan(w), { start: 0, end: 10 },
    'INTRO-ALWAYS-FILM: introSpan must return the measured intro part');
  fs.rmSync(w, { recursive: true, force: true });
});

test('INTRO-ALWAYS-FILM: introSpan is null before segments.json exists', () => {
  const w = tmpWorkdir();
  assert.equal(introSpan(w), null,
    'INTRO-ALWAYS-FILM: introSpan must return null when segments.json is absent, never throw');
  fs.rmSync(w, { recursive: true, force: true });
});

test('INTRO-ALWAYS-FILM: no run-config knob can turn the film off', async () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'cards', review: 'express' }));
  const m = await import('./run-config.mjs');
  const cfg = m.loadRunConfig(w);
  assert.equal(cfg.intro, undefined,
    'INTRO-ALWAYS-FILM: run-config must not resolve an `intro` mode — stale keys in old videos are ignored, never honoured');
  assert.equal('gateWaived' in m, false,
    'INTRO-ALWAYS-FILM: express review is gone — gateWaived must not exist');
  fs.rmSync(w, { recursive: true, force: true });
});
```

**Verify**: `node --test lib/intro-invariants.test.mjs` → exits 0, 5 tests pass

### Step 12a: `lib/board-data.mjs` — every tab is applicable

`applicableTabs()` filters on `requires.intro`, which Step 12 is about to delete.
Replace the function body's loop condition — drop the `requires` line entirely and
the now-unused `cfg`:

```js
export function applicableTabs(workdir, { steps = null } = {}) {
  // Every step's tab is applicable on every video (plan 194). This used to
  // filter on requires.intro against run-config's intro mode, so an
  // intro:"cards" video hid the Intro tab; with the film always owning the
  // intro there is nothing to hide.
  const tabs = new Set(ALWAYS_TABS);
  for (const s of (steps ?? loadSteps())) {
    if (!s.tab) continue;
    tabs.add(s.tab);
  }
  return [...tabs];
}
```

Remove the `loadRunConfig` import from this file **only if** nothing else in it
uses `loadRunConfig` — grep before deleting.

`lib/board.test.mjs` around line 1416 carries a test whose comment reads *"a
cards-intro video still requires cues.json"*. That premise is gone. Update that
test to assert the film behaviour (no `cues.json` in the boot precondition) and
rewrite the comment; **do not delete the test** — deleting coverage to get green
is a STOP condition.

**Verify**: `node --test lib/board.test.mjs lib/board-data.test.mjs 2>/dev/null || node --test lib/board.test.mjs` → exits 0

### Step 12: strip `requires` and `waivable` from the step registry

**(a)** `lib/steps.mjs`:
- Delete line 19 `const INTRO_MODES = [null, 'cards', 'film'];`
- Delete the `requires` validation (lines ~104–107) and the `waivable` entry from
  the `for (const k of ['waivable', 'external', 'optional'])` loop — that loop
  becomes `for (const k of ['external', 'optional'])`.
- Delete the `if (s.waivable && s.gate === null) die(...)` check.
- Update the field docs comment block: remove the `waivable` and `requires` rows.
- `nextStep` signature becomes `nextStep({ steps = null, exists, readFlag } = {})`
  and both the `requires.intro` filter line and the `express && s.waivable`
  clause are deleted, so the gate line reads:
  `if (s.gate && !readFlag(s.gate.file, s.gate.field)) return s;`

**(b)** All 21 `steps/*/step.json`: delete the `"waivable"` and `"requires"` keys.
Change nothing else — not `number`, not `slug`, not `gate`.

```bash
cd pipelines/video/visuals-flow
for f in steps/*/step.json; do
  node -e '
    const fs=require("fs"); const p=process.argv[1];
    const o=JSON.parse(fs.readFileSync(p,"utf8"));
    delete o.waivable; delete o.requires;
    fs.writeFileSync(p, JSON.stringify(o,null,2)+"\n");
  ' "$f"
done
```

**(c)** Regenerate the doc table: `node scripts/gen-pipeline-table.mjs`

**Verify**: `grep -l "waivable\|requires" steps/*/step.json || echo NONE` → `NONE`,
then `node scripts/gen-pipeline-table.mjs --check` → exits 0

### Step 13: run.sh

- Delete `run_review` and `run_intro` (assignment, the `node -e` reads, and the
  `echo "run-config …"` line keeps only `engine=$run_engine`).
- Line ~201 becomes `node lib/steps.mjs next "$slug"`. If `lib/steps.mjs`'s CLI
  entry reads `process.argv[3]`/`[4]` for intro/review, delete that too and pass
  only the slug.
- Delete the whole `intro_mode` guard block in the `intro-film|intro-review|intro-render)`
  case (the `node -e` read, the `if [[ "$intro_mode" != "film" ]]` refusal, and its
  `Opt in with:` message). The three verbs now always run.
- Search run.sh for any remaining `--review`, `--intro`, `express` or
  `configure --intro` text in usage/help strings and delete those too.

**Verify**: `bash scripts/test-run-sh.sh` → `run.sh test OK`, and
`grep -c "run_intro\|run_review\|--intro\|express" run.sh` → `0`

### Step 14: update the gate script's comment and run the whole gate

In `scripts/check.sh`, replace the sentence naming the deleted test:

```
# regression-cards is the one that stings —
# it asserts the intro:"cards" default path is untouched, which is exactly the
# guard you want running on every change.
```

with:

```
# intro-invariants is the one that stings — it asserts the intro film owns the
# intro on every video (plan 194 deleted the intro:"cards" flow it replaced),
# which is exactly the guard you want running on every change.
```

**Verify**: `bash scripts/check.sh` → exits 0, last line `visuals-flow check OK`

### Step 15: prove the new gate can fail

From the repo root, run the mutation recipe in this plan's frontmatter by hand
before declaring done:

```bash
cd /Users/kbtg/codebase/personal-stuff
# apply (the frontmatter mutation_apply block)
cd pipelines/video/visuals-flow && node --test lib/intro-invariants.test.mjs; echo "exit=$?"
```

**Verify**: the test **fails** and the output contains `INTRO-ALWAYS-FILM`. Then
`git checkout -- pipelines/video/visuals-flow/lib/lint-cues.mjs` and confirm it
passes again. Do not commit the mutated file.

## Test plan

- `lib/intro-invariants.test.mjs` (new, 5 tests) replaces `lib/regression-cards.test.mjs`
  and is discovered automatically by `check.sh`'s `find` — no list to update.
- Existing suites keep their coverage minus the deleted branches:
  `run-config.test.mjs`, `avatar-render.test.mjs`, `card-plan.test.mjs`, `steps.test.mjs`.
- The registry doc check (`gen-pipeline-table.mjs --check`) proves the 21 edited
  `step.json` files still load and that `PIPELINE.md` was regenerated.
- The mutation proof (Step 15) demonstrates the replacement test is not vacuous —
  which is exactly the failure mode `regression-cards.test.mjs` was guarding
  against for the flow being deleted.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0, last line `visuals-flow check OK`
- [ ] `grep -rn "ownsIntroSpan\|introSpanFor\|introOwnedByFilm\|filmSpanFor\|INTRO_MODES\|INTRO_MODE_NAMES\|gateWaived\|zonePartsFor" lib/ run.sh scripts/ steps/` returns **no matches**
- [ ] `grep -l "waivable\|requires" steps/*/step.json` returns **no matches**
- [ ] `ls lib/intro-mode-table.mjs lib/intro-modes.test.mjs lib/intro-film/owns-intro.mjs lib/intro-film/owns-intro.test.mjs lib/regression-cards.test.mjs 2>&1 | grep -c "No such file"` → `5`
- [ ] `node --test lib/intro-invariants.test.mjs` exits 0 with 5 passing tests
- [ ] `node scripts/gen-pipeline-table.mjs --check` exits 0
- [ ] Step 15's mutation makes `lib/intro-invariants.test.mjs` fail printing `INTRO-ALWAYS-FILM`, and reverting makes it pass
- [ ] `git status --porcelain` shows no untracked scratch files (no session traces, prompt copies, `.test-tmp` leftovers)

## STOP conditions

- **Baseline red.** If Step 1's `check.sh` fails before you have changed anything,
  STOP and report the failing assertion. Do not "fix" a pre-existing failure as
  part of this plan.
- **Gate integrity.** If an assertion fails, fix the code or the fixture.
  Weakening, swapping, deleting or `skip`-ing an assertion to get green is a STOP.
  This applies especially to `ZONEPARTS-CAPABILITY-VIOLATION` in
  `card-plan.test.mjs` — plan 192 armed a merge-time mutation gate on that exact
  string, and changing it silently disarms that gate.
- **Anything under `videos/`.** If a change appears to require editing a real
  video's `run-config.json`, `cues.json`, or `run-log.json`, STOP — that is plan
  197's migration, and the answer here is that stale keys are ignored, not edited.
- **`engine` creep.** If removing `review`/`intro` seems to require also removing
  `engine` or the `engineMode` cross-check, STOP and report. Plan 196 owns that.
- **Renumbering creep.** If any step folder appears to need a new number, STOP.
  Plan 197 owns that.
- **A `requires`-dependent behaviour you cannot find a replacement for.** `025`
  and `027` are the only steps with `requires.intro: "film"`; after this plan they
  simply always apply. If some consumer depends on them being conditionally
  skipped, STOP and report rather than inventing a replacement condition.

## Maintenance notes

- **This is plan 1 of 4.** The batch: **194** (this) → **195** drop the card-plan
  gate + its board tab → **196** every command becomes a step, plus the static
  avatar stand-in and the engine decision moving to an avatar-proposal gate →
  **197** renumber into `0xx`–`6xx` phase buckets with the `run-log.json` slug
  migration. Later plans assume this one landed; `needs_prs` chains them.
- **`bootFilesFor(workdir)` keeps an unused parameter** on purpose — every caller
  passes it and plan 197 renumbers around the signature. Do not "clean it up"
  before 197 lands.
- **`build-zone-prompt.mjs`'s `includes('intro')` branch is now always taken.**
  Left deliberately; plan 196 rewrites that builder for the conclusion-only step.
- **Stale keys in `videos/*/run-config.json`.** Three videos carry `review` and
  `intro`. `loadRunConfig` spreads unknown keys through harmlessly. Plan 197's
  migration removes them; until then, a reviewer seeing `"intro": "film"` in a
  workdir should know it is inert.
- **A reviewer should scrutinise**: that Step 8's dedent of the `assemble.mjs`
  film block did not accidentally widen what `requireIntroApproved` guards, and
  that Step 12's scripted `step.json` rewrite preserved key order and the trailing
  newline (the registry's own validation catches structure, not formatting).
