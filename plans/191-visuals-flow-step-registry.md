---
executor: claude-p
model: opus
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: []
needs_prs: []
touches: [pipelines/video/visuals-flow/run.sh, pipelines/video/visuals-flow/lib/steps.mjs, pipelines/video/visuals-flow/lib/build-prompt.mjs, pipelines/video/visuals-flow/lib/check-rulebook.mjs, pipelines/video/visuals-flow/lib/run-log.mjs, pipelines/video/visuals-flow/scripts/test-run-sh.sh, pipelines/video/visuals-flow/PIPELINE.md]

mutation_apply: cd pipelines/video/visuals-flow && python3 -c "import json,io; p='steps/030-pick-or-propose-graphics-llm/step.json'; d=json.load(open(p)); d['produces']=[]; json.dump(d,open(p,'w'),indent=2)"
mutation_command: bash scripts/check.sh
mutation_expect: E-REG
mutation_cwd: pipelines/video/visuals-flow
mutation_timeout: 900
---

# Plan 191: visuals-flow step registry

## Summary

- **Problem statement**: The pipeline's 20-step list is hand-encoded in six places that must be edited in lockstep, and two library modules resolve step FOLDER NAMES at runtime — so renumbering or inserting a step breaks running code with no compiler to catch it. Adding a step is a six-file coordinated edit, and `run.sh status` silently gives wrong next-step guidance on any video using the intro film.
- **Goals**:
  - One machine-readable declaration per step: `steps/<slug>/step.json`.
  - `run.sh`'s usage list, verb dispatch, and `status` next-hint all DERIVED from a folder scan instead of hand-maintained.
  - A `stepDir(ref)` helper that resolves a step folder by number or verb, replacing every hardcoded `path.resolve(..., 'steps', '<literal>')`.
  - `scripts/test-run-sh.sh` asserts dispatch BEHAVIOUR against the registry instead of grepping `run.sh`'s source text.
  - The `PIPELINE.md` step table generated from the registry, so a rename can never desync it again.
  - Guard tests that loop over ALL `step.json` files (the repo's mandatory data-driven-layer rule).
- **Executor proposed**: `claude-p` / opus — graded `tricky`: this rewrites the single entry point of the whole pipeline in bash, where several constructs are load-bearing for non-obvious reasons (`|| true` on a grep, `PIPESTATUS[0]` through a `tee`), and 30 verbs must keep working identically.
- **Done criteria** (terse — full list below): `bash scripts/check.sh` exits 0; every one of the 30 verbs dispatches to the same command as before; `E-REG` guard fires on a malformed `step.json`; no `path.resolve` in `lib/` names a step folder literally.
- **Stop conditions** (terse — full list below): any verb's dispatched command would change; a step folder resists description by the schema; the `status` next-hint order cannot be derived from `consumes`/`produces`.
- **Test / verification for success**: `scripts/check.sh` (665 tests) plus a new `lib/steps.test.mjs` looping every `step.json`, plus a behaviour-based `test-run-sh.sh` that runs `run.sh` with a dry-run env var and compares dispatched commands to a table.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b5a60bda..HEAD -- pipelines/video/visuals-flow/run.sh pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/steps pipelines/video/visuals-flow/scripts`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED — the blast radius is the pipeline's entry point, but every change is behaviour-preserving and pinned by a before/after dispatch table.
- **Depends on**: none
- **Category**: tech-debt
- **Difficulty**: tricky
- **Planned at**: commit `b5a60bda`, 2026-08-06

## Why this matters

This pipeline is the owner's main video-editing flow and it will keep growing
steps. Today growth is taxed six times over. The step list lives in:

1. `run.sh` lines 17–49 — the `usage()` verb list, hand-typed.
2. `run.sh` lines 124–474 — the `case "$step"` dispatch.
3. `run.sh` lines 199–217 — the `status` next-hint `if/elif` chain.
4. `steps/*/` folders — the de-facto registry; `lib/run-log.mjs` REFUSES a
   ledger key that is not a folder name, which is the one real constraint today.
5. `PIPELINE.md` — the prose step table.
6. `board-ui/src/lib/router.ts` — `TABS` / `HASH_TAB` / `TAB_HASH` for gates
   that have a board tab.

Two of those are worse than duplication — they are runtime coupling to a folder
NAME:

- `lib/build-prompt.mjs:12` — `path.resolve(import.meta.dirname, '..', 'steps', '030-pick-or-propose-graphics-llm', 'cue-pass-prompt.md')`
- `lib/check-rulebook.mjs:51` — `path.resolve(import.meta.dirname, '..', 'steps', '030-pick-or-propose-graphics-llm')`

So renumbering a step to insert one before it breaks running code. `PIPELINE.md`
already records the precedent, verbatim:

> "The previous old→new mapping table lived here and was destroyed by two rounds
> of automated renaming rewriting both of its columns; git history is the
> reliable record. Do not reintroduce a table that a path-rename sweep will
> silently corrupt."

A rename sweep has already eaten a doc once. The fix is not "be careful with
renames" — it is to stop encoding the list by hand.

The `status` next-hint is where this already produces wrong output today. It is
a fixed `if/elif` over artifact probes and it has no awareness of the intro film,
so on a video with `run-config.json` `intro: "film"` the `next:` line never once
mentions step 025 or 027. The driver grew a branch and its own guidance did not.

`decisions.md` 2026-08-06 already states the principle this plan generalises:
**"A NEW STEP ADDS NO CODE HERE."** That was applied to review surfaces. This
applies it to the step list.

## Current state

### The 20 step folders

```
005-configure-run-human      010-transcribe-run           015-map-segments-run
020-choose-concept-llm       025-author-intro-film-llm    030-pick-or-propose-graphics-llm
035-pick-or-propose-intro-outro-llm                       037-approve-card-plan-human
038-build-cards-llm-and-review-human                      040-sync-graphics-run
050-review-graphics-llm      060-place-avatar-llm         080-approve-storyboard-human
090-render-graphics-run      100-render-avatar-run        110-build-video-run
120-approve-final-cut-human  130-learn-from-feedback-opus 140-davinci-export-run
150-deliver-drive-run
```

Note `027-approve-intro-film-human` is documented in `PIPELINE.md` and recorded
by the board (`lib/board.mjs:1228` calls `recordGate(workdir, '027', …)`) but
**has no folder on disk**. Resolve this in Step 2 (create the folder) — a gate
the board records must exist in the registry, or `lib/run-log.mjs`'s
folder-validation would reject it.

### The complete verb → dispatch table (behaviour to preserve EXACTLY)

This is the contract. After this plan, every verb must dispatch the identical
command. Derived by reading `run.sh` at `b5a60bda`.

| verb | step | dispatches |
|---|---|---|
| `status` | — (meta) | prints `node lib/run-log.mjs <slug>` + artifact table + next-hint |
| `configure` | 005 | `node lib/run-config.mjs <slug> "$@"` |
| `transcribe` | 010 | `record_step 010 … bash steps/010-transcribe-run/run.sh <slug>` |
| `segments` | 015 | `record_step 015 … node lib/segments.mjs <slug> --propose` |
| `concept-pass` | 020 | `record 020 running` + prints LLM instructions, `exit 0` |
| `intro-film` | 025 | guard `intro==film`; `cat steps/025-author-intro-film-llm/AUTHORING.md \| sed s/<slug>/$slug/g`, `exit 0` |
| `intro-review` | 027 | guard `intro==film`; `node lib/intro-film/review-film.mjs <slug>` |
| `intro-render` | 027 | guard `intro==film`; `requireIntroApproved` then `node lib/intro-film/render-film.mjs <slug>` |
| `cue-pass` | 030 | `record 030 running` + prints LLM instructions, `exit 0` |
| `zone-pass` | 035 | `record 035 running` + prints LLM instructions, `exit 0` |
| `validate` | — (helper) | `node lib/resolve.mjs <slug> --validate-only` |
| `resolve` | 040 | `record_step 040 … node lib/resolve.mjs <slug> && node lib/lint-cues.mjs <slug>` |
| `stillness` | — (helper) | `node lib/stillness.mjs <slug>` |
| `audit` | 050 | `record 050 running` + prints LLM instructions, `exit 0` |
| `audit-gate` | — (helper) | `node lib/audit-gate.mjs <slug>` |
| `card-plan` | 037 | `node lib/card-plan.mjs <slug>` |
| `outline` | — (helper) | `node lib/card-plan.mjs <slug> --outline` |
| `board` | 080 | `bash steps/080-approve-storyboard-human/run.sh <slug>` |
| `render` | 090 | `record_step 090 … bash steps/090-render-graphics-run/run.sh <slug>` |
| `fold` | 130 | `record 130 running` + `node lib/feedback-status.mjs` + message, `exit 0` |
| `sound` | — (stage) | `node lib/sound/sfx-plan.mjs <slug>` |
| `mix` | — (stage) | `node lib/sound/build-mix.mjs <slug>` |
| `shot-pass` | 060 | `record 060 running` + prints LLM instructions, `exit 0` |
| `shots` | — (helper) | `node lib/resolve-shots.mjs <slug> && node lib/lint-shots.mjs <slug>` |
| `avatar` | 100 | `record_step 100 … bash steps/100-render-avatar-run/run.sh <slug> --submit --spans-only --template "${AVATAR_TEMPLATE:-specs-man}"` |
| `avatar-download` | 100 | `record_step 100 … bash steps/100-render-avatar-run/run.sh <slug> --download` |
| `cut` | — (composite) | see composite sequence below |
| `assemble` | 110 | `record_step 110 … bash steps/110-build-video-run/run.sh <slug>` |
| `deliver` | 150 | `record_step 150 … bash steps/150-deliver-drive-run/run.sh <slug>` |
| `export` | 140 | `record_step 140 … bash steps/140-davinci-export-run/run.sh <slug>` |
| `qc` | — (helper) | `bash scripts/qc-video.sh <slug>` |

Steps with NO verb: `038` (LLM+owner procedure, driven from `card-library/CLAUDE.md`)
and `120` (approved on the board only).

`cut`'s composite sequence, in order, from `run.sh:405-440`:
1. refuse unless `cues.json.approved === true` (exit-code check, NOT string compare)
2. warn if `shots.json` exists but `avatar-jobs.json` does not
3. `record_step 090 … bash steps/090-render-graphics-run/run.sh <slug>`
4. `node lib/effects-plan.mjs <slug>`
5. `node lib/sound/sfx-plan.mjs <slug>`
6. `node lib/sound/build-mix.mjs <slug>`
7. if `avatar-jobs.json` exists: `bash steps/100-render-avatar-run/run.sh <slug> --download` (warn on failure, do not fail)
8. `record_step 110 … bash steps/110-build-video-run/run.sh <slug> --draft`
9. print the Final Cut URL line

### Load-bearing bash you must NOT simplify

`run.sh:75-122` contains three constructs with comments explaining incidents.
Preserve them verbatim in the new dispatch:

```bash
record() {
  node lib/run-log.mjs "$slug" "$@" >/dev/null 2>&1 || true
}
```
Ledger writes must never take a step down — hence `|| true`.

```bash
  "$@" 2>&1 | tee "$logfile"
  rc="${PIPESTATUS[0]}"
```
`PIPESTATUS[0]` is the real exit code; `set -o pipefail` alone would not give it
here.

```bash
issue_total="$(grep -aciE '...' "$logfile" || true)"
```
The `|| true` is load-bearing: zero warning lines makes grep exit 1, and under
`set -euo pipefail` that killed `record_step` AFTER the step command had
succeeded — the ledger stayed "running" on a clean run (bitten 2026-07-31 on
both 090 and 100 of `opusclip-vs-submagic`).

Also preserve the header comment at `run.sh:5-11` forbidding an `--all` verb.

### The source-text test that must be replaced

`scripts/test-run-sh.sh` lines 44, 46, 64:

```bash
grep -q 'bash steps/010-transcribe-run/run.sh "$slug"' run.sh || fail "missing transcribe command"
grep -q 'bash steps/080-approve-storyboard-human/run.sh "$slug"' run.sh || fail "missing board command"
grep -q '"030-pick-or-propose-graphics-llm"' "$tmpwd/run-log.json" \
```

These assert on `run.sh`'s SOURCE TEXT, so they fail on any correct rename while
catching nothing about whether dispatch works. They have already shaped
production code: `run.sh:317` carries the comment *"Kept as a function so the
command reads literally, both here and to the grep in scripts/test-run-sh.sh
that pins it."* Line 64 asserts on run-log CONTENT and is fine to keep.

### Conventions to match

- `lib/*-constants.mjs` is the house shape for a single-source-of-truth module
  (`lib/cue-constants.mjs`, `lib/shot-constants.mjs`, `lib/zone-constants.mjs`,
  `lib/renderer-constants.mjs`). Exemplar for a data-driven guard test:
  **`lib/renderer-constants.test.mjs`** (landed at `b5a60bda`) — it walks
  sources, asserts an invariant, and names the fix in its failure message.
- `lib/run-log.mjs` already reads `steps/` at load time and refuses unknown
  keys. Reuse its directory read rather than adding a second one.
- Tests are `node:test` + `node:assert/strict`, one `lib/<name>.test.mjs` per
  module. `scripts/check.sh` now GLOBS `find lib -name '*.test.mjs'`, so a new
  test file joins the gate by existing — do not add it to a list.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate (merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, prints `visuals-flow check OK` |
| Just the registry tests | `cd pipelines/video/visuals-flow && node --test lib/steps.test.mjs` | exit 0 |
| run.sh behaviour tests | `cd pipelines/video/visuals-flow && bash scripts/test-run-sh.sh` | exit 0, prints `run.sh test OK` |
| Verb list | `cd pipelines/video/visuals-flow && bash run.sh 2>&1 \| head -40` | usage listing every verb |
| Dry-run one verb | `cd pipelines/video/visuals-flow && VF_DRY_RUN=1 bash run.sh test-01 render` | prints the command, runs nothing |

Never author a test command as `node --test <dir>` — it fails on node 22.14
("Cannot find module '.../test'"). Use explicit files or a glob.

## Scope

**In scope**:
- `pipelines/video/visuals-flow/steps/*/step.json` (new, 21 files incl. 027)
- `pipelines/video/visuals-flow/steps/_verbs.json` (new)
- `pipelines/video/visuals-flow/steps/027-approve-intro-film-human/` (new folder + README.md)
- `pipelines/video/visuals-flow/lib/steps.mjs` (new — the registry loader + `stepDir`)
- `pipelines/video/visuals-flow/lib/steps.test.mjs` (new — data-driven guards)
- `pipelines/video/visuals-flow/run.sh` (usage + dispatch + status derived)
- `pipelines/video/visuals-flow/lib/build-prompt.mjs` (use `stepDir`)
- `pipelines/video/visuals-flow/lib/check-rulebook.mjs` (use `stepDir`)
- `pipelines/video/visuals-flow/lib/run-log.mjs` (read the registry, not the raw dir)
- `pipelines/video/visuals-flow/scripts/test-run-sh.sh` (behaviour, not source text)
- `pipelines/video/visuals-flow/scripts/gen-pipeline-table.mjs` (new — generates the table)
- `pipelines/video/visuals-flow/PIPELINE.md` (table region replaced by generated content)

**Out of scope** — looks related, do not touch:
- `pipelines/video/intro-studio/` — a DIFFERENT, standalone flow the owner is
  not using. Do not touch it, do not import from it, do not share code with it.
  visuals-flow is already independent of it.
- `board-ui/` — the board's tab derivation is plan 193. Leave
  `board-ui/src/lib/router.ts` alone; this plan only makes the data available.
- The 8 `introOwnedByFilm` / `filmSpanFor` branch sites — that is plan 192.
  This plan adds the `requires.intro` FIELD and uses it only for the `status`
  next-hint; it does not refactor the consumers.
- `lib/renderer-constants.mjs` and the two new test files from `b5a60bda`.
- `card-library/` — a separate folder with its own gate.

## Git workflow

- Branch: `advisor/191-visuals-flow-step-registry`
- Commit per step, message `refactor(vf): <what>` — no AI footers. Do NOT push.

## Steps

### Step 1: Author the registry schema module

Create `lib/steps.mjs`. This is the load-bearing artifact; the exact schema is
specified here so no decision is left open.

```js
import fs from 'node:fs';
import path from 'node:path';

// THE step registry. One step.json per steps/<slug>/ folder is the single
// declaration of the pipeline's shape. run.sh's usage list, verb dispatch and
// status next-hint, PIPELINE.md's table, and (plan 193) the board's tabs all
// DERIVE from this. Before it, the list was hand-encoded in six places and two
// lib modules resolved step FOLDER NAMES at runtime, so renumbering a step
// broke running code with nothing to catch it (PIPELINE.md records a rename
// sweep that already destroyed a mapping table).
//
// decisions.md 2026-08-06: "A NEW STEP ADDS NO CODE HERE."

export const STEPS_DIR = path.resolve(import.meta.dirname, '..', 'steps');

const ACTORS = ['run', 'llm', 'human', 'opus', 'owner-live'];
const VERB_KINDS = ['meta', 'helper', 'stage', 'composite'];

// Every field is REQUIRED unless marked optional, so a half-declared step fails
// loudly at load instead of behaving oddly at dispatch.
//
//   number    "030"                     — ordering key, unique, matches the folder prefix
//   slug      "030-pick-or-propose-…"   — the folder name; run-log.json keys on this
//   title     "pick or propose graphics" — for the generated PIPELINE.md table
//   actor     one of ACTORS             — who performs it
//   verbs     ["cue-pass"]              — run.sh verbs that execute it (may be [])
//   consumes  ["transcript.json"]       — artifacts read, relative to videos/<slug>/
//   produces  ["cues.json"]             — artifacts written, same base
//   gate      null | {file, field, label} — a human approval gate
//   tab       null | "storyboard"       — the board tab that reviews it (plan 193)
//   waivable  bool                      — run-config review=express waives this gate
//   requires  { intro: null|"cards"|"film" } — step applies only for this intro mode
export function loadSteps({ dir = STEPS_DIR } = {}) {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name, 'step.json');
    if (!fs.existsSync(p)) continue;
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      throw new Error(`E-REG ${name}/step.json is not valid JSON: ${e.message}`);
    }
    out.push(validateStep(raw, name));
  }
  if (!out.length) throw new Error(`E-REG no step.json found under ${dir}`);
  return out;
}

export function validateStep(s, folderName) {
  const die = (msg) => { throw new Error(`E-REG ${folderName}: ${msg}`); };
  if (s.slug !== folderName) die(`slug "${s.slug}" must equal its folder name`);
  if (!/^\d{3}$/.test(String(s.number ?? ''))) die(`number must be a 3-digit string`);
  if (!folderName.startsWith(`${s.number}-`)) die(`folder must start with "${s.number}-"`);
  if (typeof s.title !== 'string' || !s.title.trim()) die(`title is required`);
  if (!ACTORS.includes(s.actor)) die(`actor must be one of ${ACTORS.join('|')}`);
  for (const k of ['verbs', 'consumes', 'produces']) {
    if (!Array.isArray(s[k])) die(`${k} must be an array (use [] for none)`);
    if (s[k].some((v) => typeof v !== 'string' || !v)) die(`${k} must hold non-empty strings`);
  }
  if (s.gate !== null) {
    if (typeof s.gate !== 'object') die(`gate must be null or an object`);
    for (const k of ['file', 'field', 'label']) {
      if (typeof s.gate[k] !== 'string' || !s.gate[k]) die(`gate.${k} is required`);
    }
  }
  if (s.tab !== null && (typeof s.tab !== 'string' || !s.tab)) die(`tab must be null or a string`);
  if (typeof s.waivable !== 'boolean') die(`waivable must be a boolean`);
  if (!s.requires || typeof s.requires !== 'object') die(`requires is required`);
  if (![null, 'cards', 'film'].includes(s.requires.intro ?? null)) {
    die(`requires.intro must be null, "cards" or "film"`);
  }
  // A gate with no tab cannot be approved anywhere; a waivable non-gate is
  // meaningless. Both are declaration bugs, not runtime conditions.
  if (s.waivable && s.gate === null) die(`waivable is set but there is no gate`);
  return s;
}

export function loadVerbs({ dir = STEPS_DIR } = {}) {
  const p = path.join(dir, '_verbs.json');
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const [verb, def] of Object.entries(raw)) {
    if (!VERB_KINDS.includes(def.kind)) {
      throw new Error(`E-REG _verbs.json ${verb}: kind must be one of ${VERB_KINDS.join('|')}`);
    }
  }
  return raw;
}

// Resolve a step FOLDER by number or verb. This is what replaces every
// hardcoded path.resolve(..., 'steps', '<literal folder name>') — those made a
// renumber a code-breaking change.
export function stepDir(ref, { dir = STEPS_DIR, steps = null } = {}) {
  const all = steps ?? loadSteps({ dir });
  const hit = all.find((s) => s.number === ref || s.slug === ref || s.verbs.includes(ref));
  if (!hit) throw new Error(`E-REG no step matches "${ref}"`);
  return path.join(dir, hit.slug);
}

// Every verb the driver accepts, steps and non-steps together, for usage output.
export function allVerbs({ dir = STEPS_DIR } = {}) {
  const fromSteps = loadSteps({ dir }).flatMap((s) => s.verbs);
  const fromFile = Object.keys(loadVerbs({ dir }));
  return [...new Set([...fromSteps, ...fromFile])];
}
```

**Verify**: `node -e "import('./lib/steps.mjs').then(m=>console.log(typeof m.loadSteps))"` → `function`

### Step 2: Create the missing 027 folder, then one step.json per step

First create `steps/027-approve-intro-film-human/README.md` describing the gate
(content: it is the owner's Intro Film approval, reviewed on the board's Intro
tab, output `intro-film/screenplay.json` `approved: true`; cite
`lib/board.mjs:1228` which already records it). The folder is missing today
while the board records the gate.

Then write a `step.json` in each of the 21 folders. Use the verb→step table in
"Current state" for `verbs`, and these `gate` values:

| step | gate | tab | waivable |
|---|---|---|---|
| 027 | `{"file":"intro-film/screenplay.json","field":"approved","label":"Intro Film"}` | `intro` | `false` |
| 037 | `{"file":"card-plan.json","field":"approved","label":"Card Plan"}` | `card-plan` | `true` |
| 080 | `{"file":"cues.json","field":"approved","label":"Storyboard"}` | `storyboard` | `true` |
| 120 | `{"file":"final-cut.json","field":"approved","label":"Final Cut"}` | `final-cut` | `false` |

Every other step: `gate: null`, `tab: null`, `waivable: false`.

`requires.intro`: `"film"` for 025 and 027; `null` for every other step. Do NOT
set `"cards"` on 035 — the zone pass runs for both intro modes today, and
changing that is plan 192's business.

`consumes`/`produces` come from the `PIPELINE.md` table's In → Out column and
the `videos/<slug>/` layout section. Example for 030:

```json
{
  "number": "030",
  "slug": "030-pick-or-propose-graphics-llm",
  "title": "pick or propose graphics",
  "actor": "llm",
  "verbs": ["cue-pass"],
  "consumes": ["transcript.json", "concept.json", "segments.json"],
  "produces": ["cues.json"],
  "gate": null,
  "tab": null,
  "waivable": false,
  "requires": { "intro": null }
}
```

**Verify**: `node -e "import('./lib/steps.mjs').then(m=>{const s=m.loadSteps();console.log(s.length)})"` → `21`

### Step 3: Write the data-driven guard tests

Create `lib/steps.test.mjs`. Follow `lib/renderer-constants.test.mjs` as the
exemplar. It must loop over ALL `step.json` files (the repo's mandatory rule for
a data-driven layer — a new step must not be able to break the driver silently):

- every folder matching `^\d{3}-` has a `step.json` (catches a step added without one)
- `loadSteps()` validates all 21 without throwing
- `number` is unique across steps; sorting by `number` matches folder sort order
- every `verbs` entry is unique across the whole registry (two steps cannot claim one verb)
- every `gate.file`/`produces`/`consumes` entry is a relative path (no leading `/`, no `..`)
- every step with a `gate` has a non-null `tab`, and vice versa
- `stepDir('030')`, `stepDir('cue-pass')` and `stepDir('030-pick-or-propose-graphics-llm')` all resolve to the same existing directory
- `stepDir('nope')` throws matching `/E-REG/`
- a malformed step object fails `validateStep` for each required field (loop the field list, delete one at a time, assert it throws `/E-REG/`)
- **`consumes`/`produces` form a DAG**: no step consumes an artifact that only a
  LATER step produces. Assert by walking steps in `number` order and tracking
  produced artifacts. This is the property the `status` next-hint depends on.

**Verify**: `node --test lib/steps.test.mjs` → exit 0, all tests pass

### Step 4: Add a dry-run mode to run.sh, then pin behaviour BEFORE refactoring

Add to `run.sh`, right before the `case`:

```bash
# VF_DRY_RUN=1 prints the command a verb WOULD run and exits 0 without running
# it. This is what lets scripts/test-run-sh.sh assert dispatch BEHAVIOUR instead
# of grepping this file's source text — the old grep-pins failed on any correct
# rename while catching nothing, and had already bent production code into
# "reading literally" for their benefit.
dry() {
  if [[ -n "${VF_DRY_RUN:-}" ]]; then
    echo "DRY: $*"
    return 0
  fi
  return 1
}
```

Then in EVERY verb branch, call `dry <the command> && exit 0` before executing.

Now rewrite `scripts/test-run-sh.sh` to assert the verb→dispatch table from
"Current state" using `VF_DRY_RUN=1`, replacing the three source-text greps at
lines 44, 46 and 64. Keep line 64's run-log CONTENT assertion (that one is
behavioural already). Also assert that `bash run.sh` with no args prints every
verb from `allVerbs()`.

Run it against the UNMODIFIED dispatch first — it must pass before you change
any dispatch logic. That is what makes the refactor provably behaviour-preserving.

**Verify**: `bash scripts/test-run-sh.sh` → exit 0 (against the old dispatch, before Step 5)

### Step 5: Derive usage and dispatch from the registry

Replace the hand-typed `usage()` verb list with a registry read:

```bash
usage() {
  echo "Usage: run.sh <slug> <step>"
  echo
  echo "Steps:"
  node -e "import('./lib/steps.mjs').then(m=>{for(const v of m.allVerbs())console.log('  '+v)})"
}
```

Keep the `--all` prohibition comment at the top of the file verbatim.

Replace the unknown-verb fallback so it validates against the registry and
suggests near-matches. Keep the `case` for the bodies themselves — the goal is
that the verb LIST and the step FOLDER PATHS come from the registry, not that
bash gains a dynamic dispatcher. Where a branch names a step folder literally
(`steps/010-transcribe-run/run.sh`, `steps/080-…/run.sh`,
`steps/025-…/AUTHORING.md`, `steps/090-…`, `steps/100-…`, `steps/110-…`,
`steps/140-…`, `steps/150-…`), resolve it through `stepDir` instead:

```bash
step_dir() { node -e "import('./lib/steps.mjs').then(m=>console.log(m.stepDir(process.argv[1])))" "$1"; }
```

**Verify**: `bash scripts/test-run-sh.sh` → exit 0 (same table, now registry-driven)

### Step 6: Derive the status next-hint from consumes/produces

Replace `run.sh:199-217`'s `if/elif` chain with a registry walk. Add to
`lib/steps.mjs`:

```js
// The next step to run, derived from the registry rather than a fixed if/elif
// chain. The old chain had no awareness of the intro film, so on a video with
// run-config intro:"film" the "next:" line never mentioned 025 or 027 — the
// driver grew a branch and its own guidance did not.
//
// A step is SATISFIED when every artifact it produces exists AND, if it has a
// gate, that gate's field is true (or the gate is waived by review=express).
// The next step is the first unsatisfied one whose requires.intro matches this
// video's mode.
export function nextStep({ workdir, steps = null, introMode = 'cards', express = false, exists, readFlag }) {
  for (const s of (steps ?? loadSteps())) {
    if (s.requires.intro !== null && s.requires.intro !== introMode) continue;
    if (s.produces.length && !s.produces.every((f) => exists(f))) return s;
    if (s.gate && !(express && s.waivable) && !readFlag(s.gate.file, s.gate.field)) return s;
  }
  return null;
}
```

`exists` and `readFlag` are injected so this is unit-testable without a real
workdir — add cases to `lib/steps.test.mjs` covering: a fresh workdir returns
the first step; `intro: "film"` reaches 025/027 while `intro: "cards"` skips
them; `express` skips a waivable gate but NOT 027 or 120.

Keep printing the existing artifact table verbatim — only the `next:` line changes.

**Verify**: `node --test lib/steps.test.mjs` → exit 0; `bash run.sh <a real slug> status` → the `next:` line names a step, and on an `intro: "film"` video it can name 025 or 027

### Step 7: Replace the runtime folder-name couplings

- `lib/build-prompt.mjs:12` — replace the literal `path.resolve` with
  `path.join(stepDir('030'), 'cue-pass-prompt.md')`.
- `lib/check-rulebook.mjs:51` — replace with `stepDir('030')`.
- `lib/run-log.mjs` — read valid keys from `loadSteps().map(s => s.slug)` instead
  of reading `steps/` directly, so the ledger and the registry cannot disagree.
  Preserve the existing refusal behaviour and its error message shape.

Then grep to prove none remain:

```bash
grep -rn "'steps'" lib/ --include='*.mjs' | grep -v '\.test\.' | grep -v 'steps.mjs'
```

**Verify**: that grep prints nothing; `node --test lib/check-rulebook.test.mjs lib/run-log.test.mjs` → exit 0

### Step 8: Generate the PIPELINE.md table

Create `scripts/gen-pipeline-table.mjs` that emits the markdown table from the
registry between sentinel comments. Add the sentinels to `PIPELINE.md` around
the existing step table:

```markdown
<!-- BEGIN GENERATED STEP TABLE — edit steps/*/step.json, then run: node scripts/gen-pipeline-table.mjs -->
<!-- END GENERATED STEP TABLE -->
```

The script rewrites only between the sentinels. Add a `--check` mode that exits
1 when the file is stale, and call `node scripts/gen-pipeline-table.mjs --check`
from `scripts/check.sh` so a registry edit without a regenerate fails the gate.

Keep the rest of `PIPELINE.md` (schemas, prose, step history) untouched — and
keep the warning about not reintroducing a hand-maintained mapping table.

**Verify**: `node scripts/gen-pipeline-table.mjs && node scripts/gen-pipeline-table.mjs --check` → exit 0; `git diff PIPELINE.md` shows only the table region changed

### Step 9: Full gate on a FRESH checkout

Registry loading touches file discovery, and crews verify in worktrees carrying
their own artifacts. Prove it on a pristine tree:

```bash
cd "$(mktemp -d)" && git clone --depth 1 --single-branch --branch advisor/191-visuals-flow-step-registry <repo path> fresh
cd fresh/pipelines/video/visuals-flow && bash scripts/check.sh
```

**Verify**: exit 0, prints `visuals-flow check OK`

## Test plan

- `lib/steps.test.mjs` (new) — the data-driven guards from Step 3 plus the
  `nextStep` cases from Step 6. Pattern: `lib/renderer-constants.test.mjs`.
- `scripts/test-run-sh.sh` (rewritten) — the full verb→dispatch table asserted
  behaviourally via `VF_DRY_RUN=1`, run BEFORE and AFTER the refactor.
- `scripts/check.sh` — gains `node scripts/gen-pipeline-table.mjs --check`. It
  already globs `lib` for `*.test.mjs`, so `steps.test.mjs` joins automatically.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0
- [ ] 21 `step.json` files exist and `loadSteps()` returns 21 validated steps
- [ ] `steps/027-approve-intro-film-human/` exists with a README
- [ ] `bash scripts/test-run-sh.sh` passes and asserts every verb in the table via `VF_DRY_RUN=1`, with zero `grep … run.sh` source-text assertions remaining
- [ ] `grep -rn "'steps'" lib/ --include='*.mjs' | grep -v '\.test\.' | grep -v 'steps.mjs'` prints nothing
- [ ] `bash run.sh <slug> status` on an `intro: "film"` video prints a `next:` line that can name 025 or 027
- [ ] `node scripts/gen-pipeline-table.mjs --check` exits 0 and is called from `check.sh`
- [ ] Corrupting one `step.json` makes `check.sh` fail printing `E-REG` (this is the mutation gate; boss runs it)
- [ ] `check.sh` exits 0 on a fresh clone of the branch

## STOP conditions

- **Any verb's dispatched command would change.** This plan is behaviour-preserving.
  If the table in "Current state" cannot be reproduced exactly, stop and report
  which verb and why.
- **A step folder cannot be described by the schema** (needs a field that is not
  there). Stop and report the folder and the missing concept — do not invent a
  field or stuff it into `requires`.
- **The `consumes`/`produces` DAG test fails** on the real registry, meaning the
  documented artifact flow has a cycle or a backward edge. Stop and report;
  do not "fix" it by editing `consumes` to make the test pass.
- **Gate integrity**: if a gate assertion fails, fix the code or the fixture.
  Weakening, swapping, or deleting the assertion is a STOP.
- **Do not touch `pipelines/video/intro-studio/`** for any reason. If something
  seems to require it, stop and report.
- **Do not refactor the 8 `introOwnedByFilm`/`filmSpanFor` call sites** — that is
  plan 192. Adding the `requires.intro` field is in scope; changing consumers is not.
- If `scripts/check.sh` runtime exceeds ~5 minutes, stop and report rather than
  trimming tests to fit.

## Maintenance notes

- After this lands, adding a step is: create `steps/<nnn>-<name>/`, write
  `step.json`, run `node scripts/gen-pipeline-table.mjs`. The driver, the ledger
  and the docs follow. That is the `decisions.md` 2026-08-06 principle
  ("A NEW STEP ADDS NO CODE HERE") applied to the step list.
- Plans 192 and 193 both consume this registry: 192 turns `requires.intro` into
  real slot dispatch, 193 derives the board's tabs from `tab`/`gate`.
- Reviewer should scrutinise: the three load-bearing bash constructs
  (`|| true` on `record`, `PIPESTATUS[0]`, `|| true` on the warning grep) — a
  refactor that drops any of them regresses a documented 2026-07-31 incident.
- `_verbs.json` is where non-step commands live. Resist the urge to invent a
  step folder for `validate`/`stillness`/`outline` just to make the registry
  uniform — they are helpers, and `lib/run-log.mjs` would then accept them as
  ledger keys, which is exactly the ambiguity the folder-validation prevents.
