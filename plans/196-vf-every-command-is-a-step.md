---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: []
needs_prs: [154, 155]
touches: [pipelines/video/visuals-flow/lib/resolve.mjs, pipelines/video/visuals-flow/lib/stillness.mjs, pipelines/video/visuals-flow/lib/audit-gate.mjs, pipelines/video/visuals-flow/lib/lint-shots.mjs, pipelines/video/visuals-flow/lib/checks.mjs, pipelines/video/visuals-flow/lib/checks.test.mjs, pipelines/video/visuals-flow/lib/steps.mjs, pipelines/video/visuals-flow/run.sh, pipelines/video/visuals-flow/steps/_verbs.json, pipelines/video/visuals-flow/steps, pipelines/video/visuals-flow/PIPELINE.md]

mutation_apply: python3 -c "import base64;exec(base64.b64decode('cD0ncGlwZWxpbmVzL3ZpZGVvL3Zpc3VhbHMtZmxvdy9saWIvY2hlY2tzLm1qcycKcz1vcGVuKHApLnJlYWQoKQptYXJrZXI9J3dyaXRlQ2hlY2tSZXBvcnQnCmFzc2VydCBtYXJrZXIgaW4gcywgJ21hcmtlciBtaXNzaW5nIOKAlCBwbGFuIDE5NiBTdGVwIDIgZGlkIG5vdCBsYW5kJwojIE1ha2UgdGhlIHJlcG9ydCB3cml0ZXIgYSBuby1vcDogdGhlIGNoZWNrIHN0aWxsIHByaW50cywgYnV0IGxlYXZlcyBubyBhcnRpZmFjdCwKIyB3aGljaCBpcyBleGFjdGx5IHRoZSBpbnZpc2libGUtcmV2aWV3IHN0YXRlIHRoaXMgcGxhbiBleGlzdHMgdG8gZW5kLgpzID0gcy5yZXBsYWNlKCdmcy53cml0ZUZpbGVTeW5jKG91dCwgSlNPTi5zdHJpbmdpZnkocmVwb3J0LCBudWxsLCAyKSArIFwnXFxuXCcpOycsICd2b2lkIHJlcG9ydDsnKQpvcGVuKHAsJ3cnKS53cml0ZShzKQ=='))"
mutation_command: cd pipelines/video/visuals-flow && node --test lib/checks.test.mjs
mutation_expect: REVIEW-LEAVES-NO-ARTIFACT
mutation_cwd:
mutation_timeout:
---

# Plan 196: visuals-flow — every command is a step, and every review leaves an artifact

## Summary

- **Problem statement**: the pipeline has 21 steps and **10 loose verbs**
  (`validate`, `stillness`, `outline`, `audit-gate`, `shots`, `sound`, `mix`,
  `qc`, `cut`, `status`). Eight of them do real work, but because they are not in
  the step registry the run ledger cannot record them, `PIPELINE.md` does not
  list them, and `run.sh <slug> status` never parks its next-hint on one. The
  three cheap review commands are the worst case: `validate`, `stillness` and
  `audit-gate` write **nothing at all**, so their result exists only in terminal
  scrollback — which is also why they cannot be declared as steps today
  (`lib/steps.mjs` refuses a step that declares no effect).
- **Goals**:
  - Give every cheap review a **written report** (`checks/<name>.json`), so the
    review is an artifact the ledger, the registry and the next-hint can see.
  - Promote the eight working verbs into real steps, consolidating the scattered
    storyboard checks (`shots` + `stillness` + `audit-gate` + the optional 050
    audit) into ONE review step.
  - Leave `status` (meta) and `cut` (composite) as the only loose commands, plus
    `outline` as a display flag on an existing step.
  - Gate it: `REVIEW-LEAVES-NO-ARTIFACT` fails if a review stops writing.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — the new module is written
  out in full below; the rest is declaration files and `run.sh` dispatch.
- **Done criteria** (terse — full list below): `check.sh` exits 0; `_verbs.json`
  contains only `status` and `cut`; each new step declares an artifact and appears
  in the regenerated `PIPELINE.md`.
- **Stop conditions** (terse — full list below): a promoted verb has no artifact
  and no honest `external: true`; any step renumbering; any assertion weakened.
- **Test / verification for success**: `scripts/check.sh`, plus a new
  `lib/checks.test.mjs` and a mutation proving the report writer can fail.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2e2dd69d..HEAD -- pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/steps pipelines/video/visuals-flow/run.sh`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: 194 (removes `requires`/`waivable` from every `step.json`; new declarations here must match the reduced schema), 195 (037 loses its gate; this plan renumbers nothing but adds neighbours)
- **Category**: dx
- **Difficulty**: standard
- **Planned at**: commit `2e2dd69d`, 2026-08-07

## Why this matters

`decisions.md` 2026-08-06 states the registry's purpose: *"A NEW STEP ADDS NO
CODE HERE."* One `step.json` per folder is meant to be the single declaration
the driver, the ledger and the docs all derive from. Eight commands sit outside
that contract, so for those eight the guarantee is void — and they are not
marginal commands. `sound` and `mix` produce the audio the cut ships with.
`shots` resolves the avatar spans. `qc` builds the review pack.

The three cheap checks are a sharper problem. A review whose only output is
stdout cannot be pointed at, cannot be re-read, and cannot be required. That is
how `audit-gate` ended up as a *helper that blocks the storyboard* while the 050
audit step that produces its input is marked `optional: true` — a gate whose
input is optional. Making each review write `checks/<name>.json` fixes the
registry problem and the reviewability problem with the same change.

`qc` is the illustration of what invisibility costs: it is declared
`after: "deliver"` in `steps/_verbs.json`, so the filmstrip QC pack is built
**after** the video has shipped. Nothing enforces an order for a loose verb.

## Current state

All paths relative to `pipelines/video/visuals-flow/`.

### The loose verbs, and what each actually does

`steps/_verbs.json` declares all ten with a `kind` and an `after`:

| Verb | kind | after | Dispatches (run.sh) | Writes |
|---|---|---|---|---|
| `status` | meta | — | ledger + next-hint | nothing (stays loose) |
| `validate` | helper | cue-pass | `node lib/resolve.mjs $slug --validate-only` | **nothing** |
| `stillness` | helper | zone-pass | `node lib/stillness.mjs $slug` | **nothing** |
| `outline` | helper | card-plan | `node lib/card-plan.mjs $slug --outline` | nothing (display flag — stays) |
| `audit-gate` | helper | audit | `node lib/audit-gate.mjs $slug` | **nothing** |
| `shots` | helper | shot-pass | `node lib/resolve-shots.mjs $slug && node lib/lint-shots.mjs $slug` | `shots.resolved.json` |
| `sound` | stage | render | `node lib/sound/sfx-plan.mjs $slug` | `sound.json` |
| `mix` | stage | sound | `node lib/sound/build-mix.mjs $slug` | `music-ducked.wav`, `sfx-bus.wav` |
| `cut` | composite | avatar-download | render+effects+sound+mix+assemble | — (stays loose) |
| `qc` | helper | **deliver** | `bash scripts/qc-video.sh $slug` | `$MEDIA/qc/` (outside the workdir) |

Verified line numbers in `run.sh`: `validate` 304, `stillness` 317, `audit-gate`
336, `outline` 346, `sound` 372, `mix` 377, `shots` 396, `cut` 413, `qc` 490.

`scripts/qc-video.sh` writes into `$MEDIA/qc` (line 14/17), i.e. **outside**
`videos/<slug>/` — that is what `external: true` exists for.

### Why the three checks cannot be steps today

`lib/steps.mjs` `validateStep()` ends with:

```js
  if (!s.produces.length && s.gate === null && s.external !== true) {
    die(
      'declares no effect — a step must write at least one artifact into produces, ' +
        'hold a gate, or set "external": true when its real output lands outside videos/<slug>/',
    );
  }
```

`lib/resolve.mjs`'s `--validate-only` branch (line 634) collects errors and
`console.error`s them. `lib/stillness.mjs` contains no `writeFileSync` at all.
`lib/audit-gate.mjs` reads `audit.json` + `resolved.json` and prints.

So promoting them requires giving them an artifact. That is the point, not a
workaround.

### The existing 050 audit step

`steps/050-review-graphics-llm/step.json` is `optional: true`, produces
`audit.json`, and its output is what the `audit-gate` helper reads. An optional
producer feeding a blocking check is backwards.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Full gate (merge gate) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exits 0, `visuals-flow check OK` |
| One test file | `cd pipelines/video/visuals-flow && node --test lib/checks.test.mjs` | exits 0 |
| Registry doc check | `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs --check` | exits 0 |
| Regenerate the doc | `cd pipelines/video/visuals-flow && node scripts/gen-pipeline-table.mjs` | rewrites `PIPELINE.md` |
| Verb list | `cd pipelines/video/visuals-flow && node lib/steps.mjs verbs` | one verb per line |
| run.sh self-test | `cd pipelines/video/visuals-flow && bash scripts/test-run-sh.sh` | `run.sh test OK` |

Never `node --test <dir>` — a directory argument fails on node 22.14.

## Scope

**In scope** (under `pipelines/video/visuals-flow/`):
- New `lib/checks.mjs` + `lib/checks.test.mjs`
- `lib/resolve.mjs` (validate-only branch), `lib/stillness.mjs`, `lib/audit-gate.mjs`, `lib/lint-shots.mjs` — each gains a report write
- New step folders (numbers chosen from free slots; **plan 197 renumbers them**):
  `036-review-cue-plan-run`, `070-review-storyboard-run`, `105-plan-sound-run`,
  `107-mix-audio-run`, `115-review-cut-run`
- `steps/050-review-graphics-llm/` — folded into 070 and deleted
- `steps/_verbs.json`, `run.sh`, `lib/steps.mjs` (only if a validation message needs updating)
- `PIPELINE.md` (regenerated)

**Out of scope** — looks related, do not touch:
- **Renumbering existing steps.** Plan 197 owns every number and every rename,
  in one pass, with the ledger migration. This plan only ADDS folders at free
  numbers and deletes one.
- **The new intro-idea / avatar-proposal steps and the static-avatar stand-in.**
  Plan 197.
- **`cut` and `status`.** They stay loose by design — `cut` is a convenience
  composite over other steps, `status` is the meta view.
- **`outline`.** A `--outline` display flag on `card-plan.mjs`, not a step. It
  writes nothing and is not meant to.
- **The gates themselves** (080, 120). Unchanged.
- **`videos/`.** No workdir data is edited; `checks/` appears on the next run.

## Git workflow

- Branch: `advisor/196-vf-every-command-is-a-step`
- Commit per step, message `plan 196 step N: <what>` — no AI footers. Do NOT push.

## Steps

### Step 1: Confirm a green baseline

```bash
cd pipelines/video/visuals-flow && bash scripts/check.sh
```

**Verify**: exits 0. If red before you change anything, STOP.

### Step 2: `lib/checks.mjs` — one report writer for every cheap review

Create `lib/checks.mjs` with exactly this content:

```js
import fs from 'node:fs';
import path from 'node:path';

// Every cheap review in this pipeline used to print to stdout and write nothing
// (plan 196). Three consequences, all bad: lib/steps.mjs refuses to declare a
// step with no artifact, so the reviews could not join the registry; the run
// ledger could not record that a review happened; and a result you cannot
// re-read is a result you cannot be asked to act on.
//
// One shape for all of them: videos/<slug>/checks/<name>.json.
export const CHECKS_DIR = 'checks';

export function checkReportPath(workdir, name) {
  return path.join(workdir, CHECKS_DIR, `${name}.json`);
}

// `errors` blocks; `warnings` inform. `ok` is derived, never passed in — a
// caller that computes its own ok can disagree with its own error list.
export function writeCheckReport(workdir, name, { errors = [], warnings = [], notes = {} } = {}) {
  const report = {
    check: name,
    ok: errors.length === 0,
    errors,
    warnings,
    notes,
  };
  const out = checkReportPath(workdir, name);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  return report;
}

export function readCheckReport(workdir, name) {
  const p = checkReportPath(workdir, name);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}
```

**Verify**: `node -e "import('./lib/checks.mjs').then(m=>console.log(Object.keys(m).sort().join(',')))"`
→ `CHECKS_DIR,checkReportPath,readCheckReport,writeCheckReport`

### Step 3: `lib/checks.test.mjs`

Create it with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeCheckReport, readCheckReport, checkReportPath } from './checks.mjs';

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'vf-checks-')); }

test('a review writes an artifact', () => {
  const w = tmp();
  writeCheckReport(w, 'cue-plan', { errors: [], warnings: ['W1 something'] });
  assert.ok(fs.existsSync(checkReportPath(w, 'cue-plan')),
    'REVIEW-LEAVES-NO-ARTIFACT: a review must write checks/<name>.json — a result that exists only in terminal scrollback cannot be recorded, re-read, or required');
  fs.rmSync(w, { recursive: true, force: true });
});

test('ok is derived from errors, never asserted by the caller', () => {
  const w = tmp();
  writeCheckReport(w, 'a', { errors: ['E1'], warnings: [] });
  assert.equal(readCheckReport(w, 'a').ok, false,
    'REVIEW-LEAVES-NO-ARTIFACT: a report with errors must not be ok');
  writeCheckReport(w, 'b', { errors: [], warnings: ['W1'] });
  assert.equal(readCheckReport(w, 'b').ok, true,
    'REVIEW-LEAVES-NO-ARTIFACT: warnings alone must not fail a review');
  fs.rmSync(w, { recursive: true, force: true });
});

test('readCheckReport returns null rather than throwing when absent or corrupt', () => {
  const w = tmp();
  assert.equal(readCheckReport(w, 'missing'), null);
  fs.mkdirSync(path.join(w, 'checks'), { recursive: true });
  fs.writeFileSync(checkReportPath(w, 'corrupt'), '{not json');
  assert.equal(readCheckReport(w, 'corrupt'), null);
  fs.rmSync(w, { recursive: true, force: true });
});
```

**Verify**: `node --test lib/checks.test.mjs` → exits 0, 3 tests pass

### Step 4: the three silent checks now write

Each keeps its existing stdout output — do not remove the printing; add the write.

**`lib/resolve.mjs`**, in the `--validate-only` branch (line ~634): after the
errors and the unbuilt-card list are computed, call

```js
    writeCheckReport(workdir, 'cue-plan', {
      errors: errs,
      warnings: [],
      notes: { unbuilt: unbuilt.map((c) => ({ id: c.id, card: c.card })) },
    });
```

adding `import { writeCheckReport } from './checks.mjs';` at the top.

**`lib/stillness.mjs`**: collect whatever it currently prints into an array and
write `writeCheckReport(workdir, 'stillness', { errors, warnings, notes })`.
Read the file and map its existing output faithfully — W18 findings are
**warnings**, and a "not applicable" result (no `screen.mp4`) is a note, not an
error.

**`lib/audit-gate.mjs`**: same shape, `name: 'audit-gate'`. Its blocking
findings are `errors`.

Keep each module's exit code exactly as it is today. The report is additive.

**Verify**: `grep -lc "writeCheckReport" lib/resolve.mjs lib/stillness.mjs lib/audit-gate.mjs | wc -l` → `3`

### Step 5: `036-review-cue-plan-run` — promote `validate`

Create `steps/036-review-cue-plan-run/step.json`:

```json
{
  "number": "036",
  "slug": "036-review-cue-plan-run",
  "title": "review the cue plan",
  "actor": "run",
  "actorLabel": "[RUN]",
  "verbs": ["validate"],
  "consumes": ["cues.json", "transcript.json"],
  "produces": ["checks/cue-plan.json"],
  "gate": null,
  "tab": null,
  "external": false,
  "optional": false,
  "summary": "`cues.json` + `transcript.json` + `catalog.json` -> `checks/cue-plan.json`. Everything checkable BEFORE any card exists: anchors that do not resolve, cues naming a card that is not in the catalog, timing collisions. Cheap, writes no cue data."
}
```

Add `steps/036-review-cue-plan-run/README.md` describing the check and pointing
at the fix loop (`node lib/resolve.mjs <slug> --validate-only`).

**Verify**: `node scripts/gen-pipeline-table.mjs --check` fails (the doc is
stale), then `node scripts/gen-pipeline-table.mjs && node scripts/gen-pipeline-table.mjs --check` exits 0

### Step 6: `070-review-storyboard-run` — consolidate four checks into one

This step absorbs `shots`, `stillness`, `audit-gate` **and** the optional 050
audit step.

Create `steps/070-review-storyboard-run/step.json`:

```json
{
  "number": "070",
  "slug": "070-review-storyboard-run",
  "title": "review the storyboard",
  "actor": "run",
  "actorLabel": "[RUN]",
  "verbs": ["storyboard-check"],
  "consumes": ["resolved.json", "shots.json", "transcript.json"],
  "produces": ["shots.resolved.json", "checks/storyboard.json"],
  "gate": null,
  "tab": null,
  "external": false,
  "optional": false,
  "nextHint": "run.sh <slug> storyboard-check  (the last cheap check before rendering costs time)",
  "summary": "`resolved.json` + `shots.json` -> `shots.resolved.json` + `checks/storyboard.json`. Resolves the shot spans and runs every pre-render check in one pass: shot lint, W18 stillness, and the audit gate. Replaces four separate commands (`shots`, `stillness`, `audit-gate`, and the optional 050 audit step), three of which wrote nothing and one of which was optional while a gate depended on it."
}
```

In `run.sh`, add a `storyboard-check)` case that runs the four in order and stops
at the first non-zero:

```bash
  storyboard-check)
    dry "node lib/resolve-shots.mjs $slug && node lib/lint-shots.mjs $slug && node lib/stillness.mjs $slug && node lib/audit-gate.mjs $slug" && exit 0
    node lib/resolve-shots.mjs "$slug" \
      && node lib/lint-shots.mjs "$slug" \
      && node lib/stillness.mjs "$slug" \
      && node lib/audit-gate.mjs "$slug"
    ;;
```

Then delete the `shots)`, `stillness)` and `audit-gate)` cases from `run.sh`, and
delete `steps/050-review-graphics-llm/`.

> `audit.json` was 050's artifact and `audit-gate.mjs` reads it. After this step
> `audit-gate.mjs` must treat a **missing** `audit.json` as "not applicable" —
> a note in the report, not an error — exactly as `stillness` treats a missing
> `screen.mp4`. If it currently hard-errors on the missing file, change that.

Write `lib/lint-shots.mjs`'s findings into `checks/storyboard.json` via
`writeCheckReport(workdir, 'storyboard', ...)`, merging the stillness and
audit-gate findings if they ran in the same invocation; simplest correct
approach is for **each** module to write its own section and for the last one to
merge — but if that is awkward, have each write its own `checks/<name>.json` and
declare all three in `produces`. **Pick the per-module files** if in doubt; the
step's `produces` then lists `checks/shots.json`, `checks/stillness.json`,
`checks/audit-gate.json` instead of `checks/storyboard.json`. Either is
acceptable; do not invent a third shape.

**Verify**: `node lib/steps.mjs verbs | grep -c "^shots$\|^stillness$\|^audit-gate$"` → `0`;
`node lib/steps.mjs verbs | grep -c "^storyboard-check$"` → `1`

### Step 7: `105-plan-sound-run` and `107-mix-audio-run`

`steps/105-plan-sound-run/step.json`:

```json
{
  "number": "105",
  "slug": "105-plan-sound-run",
  "title": "plan the sound",
  "actor": "run",
  "actorLabel": "[RUN]",
  "verbs": ["sound"],
  "consumes": ["resolved.json", "segments.json"],
  "produces": ["sound.json"],
  "gate": null,
  "tab": null,
  "external": false,
  "optional": true,
  "summary": "`resolved.json` + `effects.json` + `segments.json` -> `sound.json`: the semantic SFX placement plan — sound tied to what is happening on screen rather than sprinkled."
}
```

`steps/107-mix-audio-run/step.json`:

```json
{
  "number": "107",
  "slug": "107-mix-audio-run",
  "title": "mix the audio",
  "actor": "run",
  "actorLabel": "[RUN]",
  "verbs": ["mix"],
  "consumes": ["sound.json", "vo.mp3"],
  "produces": ["sfx-bus.wav"],
  "gate": null,
  "tab": null,
  "external": false,
  "optional": true,
  "summary": "`sound.json` + `vo.mp3` -> the mastered -14 LUFS mix, frame-exact against the voiceover. Writes `sfx-bus.wav` (and `music-ducked.wav` when the plan carries music)."
}
```

Both are `optional: true` — a graphics-only video ships without them, and the
next-hint must not park on a step a video can finish without.

> `music-ducked.wav` is written **conditionally** (only when the plan has music),
> so it must NOT go in `produces` — the next-hint treats a missing declared
> artifact as "this step has not run". Only `sfx-bus.wav` is unconditional.

Add each step's `README.md`. Leave the `sound)` and `mix)` cases in `run.sh`
exactly as they are — they are now step verbs rather than loose ones, which is a
registry change, not a dispatch change.

**Verify**: `node -e "import('./lib/steps.mjs').then(m=>{const s=m.loadSteps();console.log(s.filter(x=>['105','107'].includes(x.number)).map(x=>x.verbs).flat().join(','))})"`
→ `sound,mix`

### Step 8: `115-review-cut-run` — move QC before the gate

`steps/115-review-cut-run/step.json`:

```json
{
  "number": "115",
  "slug": "115-review-cut-run",
  "title": "review the assembled cut",
  "actor": "run",
  "actorLabel": "[RUN]",
  "verbs": ["qc"],
  "consumes": ["assembly.md"],
  "produces": [],
  "gate": null,
  "tab": null,
  "external": true,
  "optional": false,
  "nextHint": "run.sh <slug> qc  (scan the cut before approving it at 120)",
  "summary": "the assembled cut -> a filmstrip QC pack (event sheets, overviews, waveform, checklist) under the media hub, so the cut can be scanned fast BEFORE the 120 approval. This ran `after: \"deliver\"` as a loose helper until plan 196 — the QC pack was built after the video shipped."
}
```

`external: true` is correct and load-bearing: `scripts/qc-video.sh` writes to
`$MEDIA/qc`, outside `videos/<slug>/`, so `produces` is empty **by design rather
than by omission** — which is exactly the distinction the `external` flag exists
to record.

Number 115 places it between 110 (assemble) and 120 (approve the final cut), so
the next-hint reaches it before the gate.

**Verify**: `node lib/steps.mjs next consistent-ai-influencer` runs without error

### Step 9: shrink `steps/_verbs.json` to two entries

Replace the whole file with:

```json
{
  "status": {
    "kind": "meta",
    "after": null,
    "summary": "the ledger, the artifact table, and the next step to run"
  },
  "cut": {
    "kind": "composite",
    "after": "avatar-download",
    "summary": "render + effects + sound + mix + collect avatars + assemble a draft — a convenience that runs several steps back to back"
  }
}
```

`outline` is not listed: it is a `--outline` flag on `card-plan.mjs`, not a verb.
If `run.sh` currently dispatches `outline)` as a top-level verb, **keep the
dispatch case** but remove the `_verbs.json` entry only if `lib/steps.mjs`'s verb
validation permits an undeclared dispatch case; if it does not, keep `outline` in
`_verbs.json` as a third `helper` entry and note it in the plan's README row.
Do not delete the ability to print the outline.

**Verify**: `node lib/steps.mjs verbs` lists every step verb plus `status` and
`cut`, and `bash scripts/test-run-sh.sh` → `run.sh test OK`

### Step 10: regenerate the docs and run the whole gate

```bash
cd pipelines/video/visuals-flow
node scripts/gen-pipeline-table.mjs
bash scripts/check.sh
```

**Verify**: `check.sh` exits 0; `PIPELINE.md` lists 036, 070, 105, 107, 115 and
no longer lists 050.

### Step 11: prove a review cannot silently stop writing

Run this plan's frontmatter mutation by hand: neuter `writeCheckReport`'s write,
confirm `node --test lib/checks.test.mjs` **fails** printing
`REVIEW-LEAVES-NO-ARTIFACT`, revert, confirm green.

**Verify**: mutation fails with the expected string; revert restores green.

## Test plan

- `lib/checks.test.mjs` (3 tests) covers the report contract: an artifact is
  written, `ok` derives from errors, and a missing/corrupt report reads as `null`
  rather than throwing.
- The registry's own validation (`gen-pipeline-table.mjs --check` plus
  `lib/steps.test.mjs`) proves all five new declarations load and that every
  step folder has a `step.json`.
- `scripts/test-run-sh.sh` proves the new `storyboard-check` verb dispatches and
  the three deleted cases are gone.
- The mutation proves the report writer is load-bearing rather than decorative.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0
- [ ] `node -e "console.log(Object.keys(require('./steps/_verbs.json')).sort().join(','))"` → `cut,status` (or `cut,outline,status` if Step 9's fallback applied)
- [ ] `ls steps/ | grep -c "036-review-cue-plan-run\|070-review-storyboard-run\|105-plan-sound-run\|107-mix-audio-run\|115-review-cut-run"` → `5`
- [ ] `ls steps/050-review-graphics-llm 2>&1 | grep -c "No such file"` → `1`
- [ ] `grep -c "^  shots)\|^  stillness)\|^  audit-gate)" run.sh` → `0`
- [ ] `node --test lib/checks.test.mjs` exits 0 with 3 passing tests
- [ ] Every new step declares an effect — `node -e "import('./lib/steps.mjs').then(m=>m.loadSteps())"` exits 0 (the loader dies on a step with none)
- [ ] The frontmatter mutation makes `checks.test.mjs` fail printing `REVIEW-LEAVES-NO-ARTIFACT`; reverting restores green
- [ ] `node scripts/gen-pipeline-table.mjs --check` exits 0

## STOP conditions

- **Baseline red** at Step 1, before any change.
- **A promoted verb has no honest artifact.** If a verb cannot be given a real
  `produces` entry and is not genuinely `external`, STOP and report rather than
  inventing a placeholder file or setting `external: true` on something that
  writes inside the workdir. The `external` flag records a real fact; falsifying
  it defeats the check that reads it.
- **Any renumbering or renaming of an EXISTING step folder.** Plan 197 owns every
  rename, in one pass, with the ledger migration. Adding new folders is fine;
  touching an existing name is a STOP.
- **`audit-gate.mjs` cannot tolerate a missing `audit.json`.** If making it a note
  rather than an error changes what the storyboard blocks on, STOP and report —
  that is a real behaviour question, not a mechanical one.
- **Gate integrity.** If an assertion fails, fix the code or the fixture.
  Weakening, `skip`-ing or deleting an assertion is a STOP.

## Maintenance notes

- **Plan 3 of 4** (194 → 195 → **196** → 197). Plan 197 renumbers everything into
  `0xx`–`6xx` phase buckets and migrates the three `run-log.json` ledgers, so the
  numbers chosen here (036, 070, 105, 107, 115) are **temporary** — they were
  picked only because they are free slots that sort into the right place.
- **`checks/` is new under `videos/<slug>/`.** Confirm it is either gitignored or
  intentionally committed — decide once, here, and say which in the step READMEs.
  Generated review output is normally not repo content.
- **Step 6 offers two acceptable report shapes** (one merged `storyboard.json`
  vs three per-module files). Whichever lands, `produces` must match it exactly —
  a declared artifact that is never written makes the next-hint park forever on a
  step that already ran.
- **A reviewer should scrutinise**: that the three checks kept their original exit
  codes (the report is additive, and a check that stops failing is worse than one
  that stops writing), and that `105`/`107` are `optional: true` so a
  graphics-only video can still reach the final cut.
