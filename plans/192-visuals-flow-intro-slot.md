---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: []
needs_prs: [151]
touches: [pipelines/video/visuals-flow/lib/intro-film/owns-intro.mjs, pipelines/video/visuals-flow/lib/intro-modes.mjs, pipelines/video/visuals-flow/lib/zone-constants.mjs, pipelines/video/visuals-flow/lib/lint-cues.mjs, pipelines/video/visuals-flow/lib/run-config.mjs]

mutation_apply: cd pipelines/video/visuals-flow && perl -0pi -e "s/ownsIntroSpan\(workdir\) \? \['conclusion'\]/false ? ['conclusion']/" lib/zone-constants.mjs
mutation_command: bash scripts/check.sh
mutation_expect: ZONEPARTS-CAPABILITY-VIOLATION
mutation_cwd: pipelines/video/visuals-flow
mutation_timeout: 900
---

# Plan 192: intro as a declared slot

## Summary

- **Problem statement**: The intro flow is selected by `run-config.json`
  `intro: "cards" | "film"`, but the question every consumer actually asks is
  *"does the active intro flow own the intro span?"* — and it is spelled as
  `introOwnedByFilm()`, a predicate named after ONE specific flow. Adding a third
  intro flow means editing every site that asks the capability question, because
  the question is phrased as an identity check.
- **Goals**:
  - Replace the flow-identity predicate with a capability query: `ownsIntroSpan(workdir)` / `introSpanFor(workdir)`, backed by a declarative table of intro modes.
  - Make adding an intro mode a data edit (one row) rather than a hunt through consumers.
  - Keep `introOwnedByFilm` as a thin deprecated alias so nothing breaks mid-flight, and add a gate that fails if new code uses it.
  - Preserve behaviour exactly for both existing modes, pinned by the isolation guard that already exists.
- **Executor proposed**: `claude-p` / sonnet — graded `standard`. Small, fully inlined, but it touches two lint branches whose semantics must be preserved precisely, which is judgment the plan cannot fully remove.
- **Done criteria** (terse — full list below): `check.sh` exits 0; `lib/intro-modes.mjs` declares both modes; no `lib/` source outside the alias calls `introOwnedByFilm`; `E-INTRO` gate fires when a consumer bypasses the capability query.
- **Stop conditions** (terse — full list below): either lint branch's behaviour would change for either existing mode; a consumer needs to know WHICH flow rather than the capability.
- **Test / verification for success**: `scripts/check.sh` (665+ tests) including the existing `lib/regression-cards.test.mjs` isolation guard, plus a new `lib/intro-modes.test.mjs` looping every declared mode.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b5a60bda..HEAD -- pipelines/video/visuals-flow/lib`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW — behaviour-preserving, and the isolation property already has a test.
- **Depends on**: 191 (the registry declares `requires.intro`; this plan makes that field mean something at dispatch)
- **Category**: tech-debt
- **Difficulty**: standard
- **Planned at**: commit `b5a60bda`, 2026-08-06

## Why this matters

The owner's stated goal: *"if I am using one intro flow, the other should not be
impacted."*

**An important correction to the audit that produced this plan.** The first pass
claimed eight modules branch on the intro mode and that a third flow means
extending all eight. That was overstated. Reading the code shows the
architecture is already most of the way there:

- `lib/intro-film/owns-intro.mjs` is already the designated single source of
  truth, and its own comment says why it exists: *"Five surfaces stand down on
  this; if any of them tests run-config directly instead, they drift apart and
  the failure is silent wrong output, not a crash."*
- The pure functions take the span as an injected PARAMETER and never call the
  predicate: `planSegments({ …, filmSpan })` (`assemble.mjs:136`),
  `lintShots({ …, filmSpan })` (`lint-shots.mjs:33`),
  `buildNativeFcpxml({ …, filmSpan })` (`export-timeline.mjs:225`). That is
  correct dependency injection, already done.
- `filmSpanFor(workdir)` is called only at the edges (`lint-shots.mjs:256`,
  `avatar-render.mjs:164`, and via `loadAssemblyInputs`).

So the isolation is real. What remains is narrower and genuinely worth fixing:
**the question is asked in the wrong vocabulary.** Only three sites actually
branch, and all three ask the same underlying question while spelling it as
"is the intro mode `film`?":

1. `lib/zone-constants.mjs:60` — `zoneParts(workdir)` returns `['conclusion']`
   instead of both zones, because the film owns the intro.
2. `lib/lint-cues.mjs:364` — skip error `E13 open-cover`, because the film covers
   second zero.
3. `lib/lint-cues.mjs:376` — enable error `E23 link-scrim`, because the film owns
   the first description mention.

Every one of those is really asking *"does the active intro flow own the intro
span?"* — a capability, not an identity. Spelled as `introOwnedByFilm`, a third
mode (`intro: "template"`, say) forces you to find and widen all three plus the
predicate. Spelled as `ownsIntroSpan`, a third mode is one row in a table.

This is a small plan. It is worth doing now precisely because it is small — the
cost of adding intro flow #3 is what this buys down, and every extra flow added
first makes it bigger.

## Current state

### The predicate module, in full (`lib/intro-film/owns-intro.mjs`)

```js
import fs from 'node:fs';
import path from 'node:path';
import { loadRunConfig } from '../run-config.mjs';

export function introOwnedByFilm(workdir) {
  return loadRunConfig(workdir).intro === 'film';
}

export function filmSpanFor(workdir) {
  if (!introOwnedByFilm(workdir)) return null;
  const segmentsFile = path.join(workdir, 'segments.json');
  if (!fs.existsSync(segmentsFile)) return null;
  const segData = JSON.parse(fs.readFileSync(segmentsFile, 'utf8'));
  const introPart = segData.structure?.find((p) => p.part === 'intro');
  if (!introPart) return null;
  return { start: introPart.start, end: introPart.end };
}
```

### The three branch sites, verbatim

`lib/zone-constants.mjs:59-61`:
```js
export function zoneParts(workdir) {
  return introOwnedByFilm(workdir) ? ['conclusion'] : ZONE_PARTS;
}
```

`lib/lint-cues.mjs:363-375` — E13 suppression:
```js
    if (workdir && introOwnedByFilm(workdir)) {
      // The film covers second zero; do not enforce E13.
    } else {
      const firstFull = sortedResolved.find((r) => r.placement === 'fullframe');
      // … E13 open-cover error …
    }
```

`lib/lint-cues.mjs:376-382` — E23 activation:
```js
  if (workdir && introOwnedByFilm(workdir)) {
    const partAt = (t) => (segmentsData?.structure ?? []).find((s) => t >= s.start && t < s.end)?.part ?? null;
    for (const r of sortedResolved) {
      if (r.card === 'link-in-description/link-scrim' && partAt(r.start) === 'conclusion') {
        errors.push(`E23 link-scrim: …`);
      }
    }
```

Note the two are OPPOSITE polarity: E13 is suppressed when the intro is owned,
E23 is enabled. Do not "simplify" them into one branch.

### The run-config enum (`lib/run-config.mjs`)

```js
const DEFAULTS = { engine: 'heygen3', review: 'full', intro: 'cards' };
const INTROS = ['cards', 'film'];
```

### The isolation guard that already exists

`lib/regression-cards.test.mjs` asserts *"Step 6: default path is untouched
(intro: 'cards' vs unconfigured)"*. It was on disk but not in the gate until
`b5a60bda`; it is now in the gate because `check.sh` globs. **This is the test
that proves the owner's requirement.** Extend it, never weaken it.

### Conventions to match

- `lib/*-constants.mjs` is the house shape for a declarative single source of
  truth. Exemplar for a data-driven guard test: `lib/renderer-constants.test.mjs`
  — it walks sources, asserts an invariant, and names the fix in its message.
- `check.sh` globs `find lib -name '*.test.mjs'`, so a new test joins by existing.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate (merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, `visuals-flow check OK` |
| Intro mode tests | `cd pipelines/video/visuals-flow && node --test lib/intro-modes.test.mjs` | exit 0 |
| Isolation guard | `cd pipelines/video/visuals-flow && node --test lib/regression-cards.test.mjs lib/zone-lint.test.mjs lib/lint-cues.test.mjs` | exit 0 |
| Find stale predicate uses | `cd pipelines/video/visuals-flow && grep -rn "introOwnedByFilm" lib/ --include='*.mjs' \| grep -v '\.test\.'` | only `lib/intro-film/owns-intro.mjs` |

## Scope

**In scope**:
- `lib/intro-modes.mjs` (new — the declarative mode table + capability queries)
- `lib/intro-modes.test.mjs` (new — data-driven guards)
- `lib/intro-film/owns-intro.mjs` (becomes a thin deprecated alias)
- `lib/zone-constants.mjs` (use the capability query)
- `lib/lint-cues.mjs` (use the capability query at both branches)
- `lib/run-config.mjs` (derive `INTROS` from the mode table)
- `lib/regression-cards.test.mjs` (extend the isolation guard)

**Out of scope** — looks related, do not touch:
- `pipelines/video/intro-studio/` — a DIFFERENT, standalone flow the owner is
  NOT using. Do not touch it, do not import from it, do not share code with it.
  visuals-flow is already independent of it; the only trace is a stale historical
  comment at `lib/intro-film/inputs.mjs:1`, which you may reword but must not act on.
- The parameter-injection sites (`planSegments`, `lintShots`,
  `buildNativeFcpxml`). They already take the span as an argument — that is the
  correct shape. Only the EDGE that computes the span changes name.
- Adding an actual third intro mode. This plan makes it cheap; it does not do it.
- `board-ui/` — plan 193.
- The `steps/*/step.json` `requires.intro` field — plan 191 owns its definition.

## Git workflow

- Branch: `advisor/192-visuals-flow-intro-slot`
- Commit per step, message `refactor(vf): <what>` — no AI footers. Do NOT push.

## Steps

### Step 1: Author the intro-mode table

Create `lib/intro-modes.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';
import { loadRunConfig } from './run-config.mjs';

// Every intro flow the pipeline supports, declared. Adding a flow is a row here
// plus its own step folders — NOT a hunt through consumers.
//
// Why this exists: the capability every consumer actually needs is "does the
// active intro flow own the intro span?", but it used to be spelled
// `introOwnedByFilm(workdir)` — an identity check against ONE flow. Three sites
// asked that question (zone-constants' zoneParts, and lint-cues' E13
// suppression and E23 activation), so a third flow meant widening all three and
// the predicate. Asked as a capability, a third flow changes only this table.
//
//   ownsIntroSpan  the flow renders the intro itself, so the cue passes must
//                  stand down over the intro span: zones drop "intro", E13
//                  (open-cover) is suppressed, E23 (link-scrim) is enabled.
//   spanFrom       where the owned span comes from, or null when it owns nothing.
export const INTRO_MODES = {
  cards: {
    label: 'catalog cards',
    ownsIntroSpan: false,
    spanFrom: null,
  },
  film: {
    label: 'bespoke intro film',
    ownsIntroSpan: true,
    spanFrom: 'segments.structure.intro',
  },
};

export const INTRO_MODE_NAMES = Object.keys(INTRO_MODES);

export function introModeFor(workdir) {
  const name = loadRunConfig(workdir).intro;
  const mode = INTRO_MODES[name];
  if (!mode) throw new Error(`E-INTRO unknown intro mode "${name}" — declare it in lib/intro-modes.mjs`);
  return { name, ...mode };
}

// THE capability query. Every consumer asks this, never "is the mode film?".
export function ownsIntroSpan(workdir) {
  return introModeFor(workdir).ownsIntroSpan;
}

// The span the active intro flow owns, or null when it owns nothing.
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

**Verify**: `node -e "import('./lib/intro-modes.mjs').then(m=>console.log(m.INTRO_MODE_NAMES.join(',')))"` → `cards,film`

### Step 2: Make owns-intro.mjs a thin alias, and derive run-config's enum

Rewrite `lib/intro-film/owns-intro.mjs` to re-export, keeping the historical
rationale comment but marking it deprecated:

```js
// DEPRECATED — kept so nothing breaks mid-flight. The capability query lives in
// lib/intro-modes.mjs now; see the "why" there. New code calls ownsIntroSpan /
// introSpanFor, and lib/intro-modes.test.mjs FAILS if a lib source calls these.
import { ownsIntroSpan, introSpanFor } from '../intro-modes.mjs';
export const introOwnedByFilm = ownsIntroSpan;
export const filmSpanFor = introSpanFor;
```

In `lib/run-config.mjs`, replace the hardcoded list with the table so the enum
cannot disagree with the declared modes:

```js
import { INTRO_MODE_NAMES } from './intro-modes.mjs';
const INTROS = INTRO_MODE_NAMES;
```

Watch for an import cycle: `intro-modes.mjs` imports `loadRunConfig` from
`run-config.mjs`, and `run-config.mjs` now imports `INTRO_MODE_NAMES` from
`intro-modes.mjs`. ES modules tolerate this because `INTRO_MODE_NAMES` is
evaluated at module scope while `loadRunConfig` is only CALLED later — but if
node reports a cycle error, move `INTRO_MODES` into its own leaf module
`lib/intro-mode-table.mjs` that imports nothing, and have both files import that.
Do not break the cycle by duplicating the list.

**Verify**: `node --test lib/run-config.test.mjs` → exit 0

### Step 3: Point the three branch sites at the capability query

- `lib/zone-constants.mjs:60` — `return ownsIntroSpan(workdir) ? ['conclusion'] : ZONE_PARTS;`, import from `./intro-modes.mjs`.
- `lib/lint-cues.mjs:364` — `if (workdir && ownsIntroSpan(workdir)) {` (E13 suppression; keep the comment and the `else` branch untouched).
- `lib/lint-cues.mjs:376` — `if (workdir && ownsIntroSpan(workdir)) {` (E23 activation).

Update the comment at each site to say the capability, not the flow: "the active
intro flow owns second zero" rather than "the film covers second zero".

The two branches have OPPOSITE polarity (E13 suppressed, E23 enabled). Do not
merge them.

**Verify**: `node --test lib/lint-cues.test.mjs lib/zone-lint.test.mjs lib/regression-cards.test.mjs` → exit 0, no assertion changes needed

### Step 4: Write the data-driven guards

Create `lib/intro-modes.test.mjs`, following `lib/renderer-constants.test.mjs`:

- loop EVERY entry in `INTRO_MODES`: `label` is a non-empty string,
  `ownsIntroSpan` is a boolean, `spanFrom` is `null` when `ownsIntroSpan` is
  false and a non-empty string when true
- exactly one mode has `ownsIntroSpan: false` today (`cards`) — assert at least
  one does, so the default path can never be declared away
- `introModeFor` throws `/E-INTRO/` on an undeclared mode name
- `introSpanFor` returns `null` for `cards`; returns the intro part for `film`
  with a fixture `segments.json`; returns `null` for `film` when `segments.json`
  is absent (the pre-segments case — this is existing behaviour, keep it)
- `introSpanFor` throws `/E-INTRO/` for a mode declaring an unreadable `spanFrom`
- `INTRO_MODE_NAMES` equals `run-config.mjs`'s accepted enum (round-trip:
  configuring each declared mode succeeds; an undeclared one is rejected)
- **the no-bypass gate**: walk `lib/**/*.mjs` (skipping tests, `.test-tmp`,
  `fixtures`, and `lib/intro-film/owns-intro.mjs` itself) and fail if any source
  calls `introOwnedByFilm` or `filmSpanFor`, or reads `.intro === ` directly.
  Message must name the fix: *"call ownsIntroSpan/introSpanFor from
  lib/intro-modes.mjs"*, prefixed `E-INTRO`.

That last test is the mutation target boss will exercise: reverting
`zone-constants.mjs` to the old predicate must make `check.sh` fail printing
`E-INTRO`.

**Verify**: `node --test lib/intro-modes.test.mjs` → exit 0

### Step 5: Extend the isolation guard

In `lib/regression-cards.test.mjs`, add cases beside the existing
*"default path is untouched"* test:

- for a workdir with NO `run-config.json`: `ownsIntroSpan` is false and
  `zoneParts` returns both zones (unconfigured behaves exactly like `cards`)
- for `intro: "cards"`: identical results to unconfigured
- for `intro: "film"`: `zoneParts` returns `['conclusion']` only
- **the cross-mode isolation property, stated directly**: adding a hypothetical
  third mode to a COPY of the table (do not mutate the real export) changes
  neither `cards` nor `film` results

Do not weaken the existing assertion.

**Verify**: `node --test lib/regression-cards.test.mjs` → exit 0, existing test still present and passing

### Step 6: Full gate, and prove the intro-studio boundary holds

```bash
grep -rn "intro-studio" lib/ board-ui/src scripts steps run.sh --include='*.mjs' --include='*.ts' --include='*.tsx' --include='*.sh' --include='*.json'
```

Expect: nothing, or only the historical comment in `lib/intro-film/inputs.mjs`.
Then run the full gate.

**Verify**: `bash scripts/check.sh` → exit 0, `visuals-flow check OK`

## Test plan

- `lib/intro-modes.test.mjs` (new) — the mode-table guards and the no-bypass gate.
- `lib/regression-cards.test.mjs` (extended) — the owner's isolation requirement.
- `lib/lint-cues.test.mjs`, `lib/zone-lint.test.mjs`, `lib/run-config.test.mjs` —
  must pass UNCHANGED. If any needs editing, the refactor changed behaviour:
  that is a STOP.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0
- [ ] `lib/intro-modes.mjs` declares both modes with the capability fields
- [ ] `grep -rn "introOwnedByFilm" lib/ --include='*.mjs' | grep -v '\.test\.'` returns ONLY `lib/intro-film/owns-intro.mjs`
- [ ] `lib/run-config.mjs` derives `INTROS` from `INTRO_MODE_NAMES` (no second list)
- [ ] `lib/lint-cues.test.mjs`, `lib/zone-lint.test.mjs`, `lib/run-config.test.mjs` pass with NO assertion edits
- [ ] `lib/regression-cards.test.mjs` still contains its original "default path is untouched" test, plus the new cases
- [ ] Reverting `zone-constants.mjs` to `introOwnedByFilm` makes `check.sh` fail printing `E-INTRO` (mutation gate; boss runs it)
- [ ] No reference to `intro-studio` outside a historical comment

## STOP conditions

- **Either lint branch's behaviour changes for either existing mode.** E13 is
  SUPPRESSED when the intro span is owned; E23 is ENABLED. If preserving both
  polarities is not possible, stop and report.
- **A consumer genuinely needs to know WHICH flow, not the capability.** Stop and
  report the site — do not add a `mode.name === 'film'` check, and do not widen
  the table with a flow-specific flag to paper over it.
- **An existing test needs its assertions edited to pass.** That means behaviour
  changed. Stop and report which test and why.
- **Gate integrity**: if a gate assertion fails, fix the code or the fixture.
  Weakening, swapping, or deleting the assertion is a STOP.
- **Do not touch `pipelines/video/intro-studio/`** for any reason. If something
  seems to require it, stop and report.
- **Do not add a third intro mode.** This plan makes that cheap; adding one is a
  separate decision the owner has not made.
- If the import cycle in Step 2 cannot be resolved by the leaf-module split
  described there, stop and report rather than duplicating the mode list.

## Maintenance notes

- After this lands, adding an intro flow is: one row in `INTRO_MODES`, its own
  `steps/` folders with `step.json` (`requires.intro: "<name>"`, plan 191), and
  a reader for its `spanFrom` if it is not `segments.structure.intro`. No
  consumer changes. That is the owner's "one flow must not impact the other",
  enforced by the interface instead of by convention.
- The deprecated alias in `lib/intro-film/owns-intro.mjs` exists only to avoid a
  big-bang rename. Once no in-flight branch references it, delete it — the
  no-bypass gate already prevents new uses.
- Reviewer should scrutinise: the E13/E23 polarity (opposite, easy to merge by
  mistake) and whether `introSpanFor`'s `null`-when-no-`segments.json` behaviour
  survived — several callers depend on that returning `null` rather than throwing
  before step 015 has run.
