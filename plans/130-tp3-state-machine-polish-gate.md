---
executor: agy
model:
test_cmd: cd pipelines/youtube/tutorial-pipeline-3 && bash scripts/check.sh
ui:
deploy:
needs: [129]
---

# Plan 130: tutorial-pipeline-3 section state machine + polish/lint gate

## Summary

- **Problem statement**: after plan 129 the pipeline has a script contract but no
  state semantics: nothing encodes lock/invalidate rules (the anti-desync mechanism),
  no deterministic script.md render, no respell handling, and no hard gate between
  the tutorial maker's edits and TTS.
- **Goals**:
  - `lib/state.mjs`: the section state machine — text edit ⇒ version bump + lock
    clear + recording invalidation; lock preconditions; stage transitions.
  - `lib/render-script-md.mjs`: deterministic script.json → script.md render.
  - `lib/spoken.mjs`: respell-map application for spoken_text.
  - `lib/set-stage.mjs`: stage-transition CLI guarded by state.mjs.
  - Step 030 (tutorial-maker verification, process doc) and step 040 (polish
    rulebook — Appendix A — plus the hard lint gate).
- **Executor proposed**: agy (Gemini 3.1 Pro High — agy default). Rulebook text is
  authored in Appendix A; the executor places files and wires code.
- **Done criteria** (terse): `bash scripts/check.sh` exit 0 with the new suites
  appended; invalidation rules provably enforced by tests.
- **Stop conditions** (terse): drift check fails; check.sh already red before
  changes; anything needs network/LLM calls.
- **Test / verification for success**: node:test suites for state/render/spoken/
  set-stage appended to `scripts/check.sh`.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving on. If anything in the
> "STOP conditions" section occurs, stop and report. When done, update the status
> row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat ff940f0..HEAD -- pipelines/youtube/tutorial-pipeline-3/`
> Expected: only plan 129's files (see its in-scope list) plus WORKFLOW.md. If
> plan 129 has not landed (no `lib/schema.mjs` present) → STOP: dependency missing.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 129
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `ff940f0`, 2026-07-23

## Why this matters

The whole VO-first design rests on one invariant: a recording is only ever performed
against locked audio, and any text change after lock invalidates everything derived
from it. If that rule lives in people's heads it will be violated; this plan puts it
in code (`state.mjs`) that the UI (plan 132) and intake QC (plan 133) both import.
The polish gate is the last line before TTS: after it, freelancer-visible text is
final and clean.

## Current state

After plan 129, `pipelines/youtube/tutorial-pipeline-3/` has: `PIPELINE.md` (the
script.json contract — read its contract section first), `lib/{schema,flags,
lint-script,init-video}.mjs` + tests, `steps/010-inputs/`, `steps/020-script-gen/`,
`run.sh` (verbs: status, 010, lint), `scripts/check.sh` (explicit `node --test`
file list — APPEND to it, never rewrite). Key existing exports you will import:

- `lib/schema.mjs`: `validateScript(obj, { stage })` → `{ ok, errors, warnings }`.
- `lib/flags.mjs`: `scanFlags(text)`, `stripFlags(text)`.

The contract's per-section shape (from PIPELINE.md):
`{ id, demo, display_text, spoken_text, flags, notes, version,
tts: { regens_used, locked, take }, recording: { status } }` and top-level
`stage: "generated" | "verified" | "polished" | "tts" | "locked" | "recorded" | "qc-passed"`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Baseline before changes | `cd pipelines/youtube/tutorial-pipeline-3 && bash scripts/check.sh` | exit 0 (else STOP) |
| Full gate after changes | same | exit 0, `tutorial-pipeline-3 check OK` |
| One suite | `node --test lib/state.test.mjs` | exit 0 |

## Scope

**In scope** (create unless marked edit):
- `lib/state.mjs` + `lib/state.test.mjs`
- `lib/render-script-md.mjs` + `lib/render-script-md.test.mjs`
- `lib/spoken.mjs` + `lib/spoken.test.mjs`
- `lib/set-stage.mjs` + `lib/set-stage.test.mjs`
- `steps/030-verify-tm/README.md`
- `steps/040-polish-lint/README.md`
- `steps/040-polish-lint/rulebook.md` (Appendix A, verbatim)
- EDIT `scripts/check.sh` — append the four new test files to the `node --test` line.
- EDIT `run.sh` — add verbs `render` and `gate` to the existing `case`.
- EDIT `PIPELINE.md` — add the "Section state machine" section (given verbatim in
  Step 1 below) under the script.json contract.

**Out of scope**: everything else — in particular `lib/schema.mjs` (the validator
does not change), `WORKFLOW.md`, `steps/020-script-gen/*`, visuals-flow, apps/.

## Git workflow

- Branch: `advisor/130-tp3-state-machine-polish-gate`
- Commit per step, single-line messages (e.g. `tp3: section state machine`). Do NOT push.

## Steps

### Step 1: PIPELINE.md — the state-machine section (single home)

Append this section to PIPELINE.md immediately after the script.json contract
(verbatim — it is the spec `state.mjs` implements):

```markdown
## Section state machine

Stage order (top-level `stage`): generated → verified → polished → tts → locked
→ recorded → qc-passed. `set-stage` may only move one step forward, except the
edit rule below which moves the file backward automatically.

Per-section invariants:

1. **Text edit invalidates everything derived from the text.** Changing a
   section's `display_text` or `spoken_text` bumps `section.version`, resets
   `tts` to `{ regens_used: 0, locked: false, take: null }`, and sets
   `recording.status` to `"re-record"` if a recording was already
   `"received"`/`"qc-passed"`, else `"pending"` (demo) / `"none"` (non-demo).
2. **Lock preconditions.** A section may lock only when: `flags` is empty,
   `spoken_text` is non-empty, and `tts.take` is non-null. Locking sets
   `tts.locked = true`. There is no unlock operation — only a text edit (rule 1)
   clears a lock.
3. **Stage gates.** `stage: "tts"` requires lint `--stage polished` to pass.
   `stage: "locked"` requires every section locked. `stage: "recorded"` requires
   every demo section `recording.status` ∈ {"received","qc-passed"}.
   `stage: "qc-passed"` requires every demo section `"qc-passed"`.
```

**Verify**: `grep -c "Section state machine" PIPELINE.md` → 1.

### Step 2: `lib/state.mjs` + tests

Implement exactly the spec above as pure functions (no I/O):

```js
// lib/state.mjs
export const STAGES = ["generated","verified","polished","tts","locked","recorded","qc-passed"];

// Returns a NEW section object; never mutates the input.
export function applyTextEdit(section, { display_text, spoken_text }) { /* rule 1 */ }

// Throws Error with a message naming the failed precondition; else returns new section.
export function lockSection(section) { /* rule 2 */ }

// Returns { ok, errors: string[] } for a proposed stage move on a whole script obj.
export function checkStageMove(script, toStage) { /* stage order + rule 3 gates */ }
```

Tests must cover, minimum: edit on a locked+recorded demo section → version+1,
lock cleared, take null, regens 0, status "re-record"; edit on a never-recorded
demo section → "pending"; edit on non-demo → "none"; lock with leftover flag →
throws naming flags; lock with empty spoken_text → throws; lock with null take →
throws; valid lock → locked true; checkStageMove skipping a stage → error;
"locked" with one unlocked section → error naming the section id; happy path per
gate. Inputs never mutated (assert deep-equal on the original after each call).

**Verify**: `node --test lib/state.test.mjs` → pass.

### Step 3: `lib/render-script-md.mjs` + tests

`node lib/render-script-md.mjs <slug> [--root <dir>]` reads
`videos/<slug>/script.json`, writes `videos/<slug>/script.md` in exactly the format
plan 129's rulebook promised the tutorial maker:

```markdown
# <video slug> — script v<top-level version>  (stage: <stage>)

## s01 [no demo]

<display_text>

## s02 [demo]

<display_text>

> notes: <notes>
> FLAG (VERIFY): exact upgrade button label
```

Rules: `[demo]` / `[no demo]` from the flag; a `> notes:` line only when notes is
non-empty; one `> FLAG (KIND): note` line per flags[] entry; sections in id order.
Export the pure renderer `renderScriptMd(script)` and keep the CLI a thin wrapper,
so tests call the pure function on fixtures.

**Verify**: `node --test lib/render-script-md.test.mjs` → pass.

### Step 4: `lib/spoken.mjs` + tests

Respell map lives at `videos/<slug>/respellings.json`, shape
`{ "HeyGen": "Hey Jen", "OpenArt": "Open Art" }` (optional file).

```js
// lib/spoken.mjs
// Word-boundary, case-sensitive replacement of each map key in order of
// DESCENDING key length (so "IndexTTS-2" wins over "IndexTTS").
export function deriveSpoken(displayText, respellMap = {}) { /* ... */ }
```

`deriveSpoken` must also throw if the input still contains flag markers (import
`scanFlags`) — spoken text is only derivable post-polish. Tests: basic replace,
longer-key precedence, no partial-word replacement (`Notion` must not fire inside
`Notional`), throws on flagged input, empty map = identity.

**Verify**: `node --test lib/spoken.test.mjs` → pass.

### Step 5: `lib/set-stage.mjs` + tests

`node lib/set-stage.mjs <slug> <toStage> [--root <dir>]`: loads script.json, runs
`checkStageMove`, and for `toStage === "tts"` additionally runs
`validateScript(script, { stage: "polished" })`; on success writes the file with
the new stage, else prints the errors and exits 1. Tests via temp-dir fixtures
(same `execFileSync` pattern as `lib/lint-script.test.mjs`).

**Verify**: `node --test lib/set-stage.test.mjs` → pass.

### Step 6: step docs 030 + 040 (rulebook verbatim)

`steps/030-verify-tm/README.md` — the human verification pass, documented as a
process (no code): owner sends `script.md` to the tutorial maker (Drive doc);
the tutorial maker resolves every FLAG line and corrects anything the live tool
contradicts, writing rough notes inline; a Claude session applies the returned
edits into `script.json` **using `applyTextEdit` semantics** (never hand-editing
version/tts fields), re-runs `node lib/render-script-md.mjs <slug>`, then
`node lib/set-stage.mjs <slug> verified`. In UI v2 this step moves into the web
UI (plan 132's successor), which is why it stays deliberately thin here.

`steps/040-polish-lint/README.md` — run order: (1) Claude session executes
`rulebook.md` on the verified script; (2) `node lib/lint-script.mjs
videos/<slug>/script.json --stage polished` must exit 0; (3)
`node lib/set-stage.mjs <slug> polished`; (4) `node lib/set-stage.mjs <slug> tts`
when the owner is ready to publish to the UI (plan 132's step 050 consumes stage
"tts").

`steps/040-polish-lint/rulebook.md`: **Appendix A below, byte-for-byte.**

**Verify**: files exist; first/last lines of rulebook.md match Appendix A.

### Step 7: run.sh verbs + check.sh append

- `run.sh`: add `render` → `node lib/render-script-md.mjs "$SLUG"`, and `gate` →
  `node lib/lint-script.mjs "videos/$SLUG/script.json" --stage polished`.
- `scripts/check.sh`: append `lib/state.test.mjs lib/render-script-md.test.mjs
  lib/spoken.test.mjs lib/set-stage.test.mjs` to the existing `node --test` line
  (do not reorder existing entries).

**Verify**: `bash scripts/check.sh` → exit 0, `tutorial-pipeline-3 check OK`.

## Test plan

Four new node:test suites (state, render, spoken, set-stage) + existing suites,
all via `scripts/check.sh`. Pure functions tested directly; CLIs tested via
`execFileSync` on `fs.mkdtempSync` fixtures. No network, no LLM.

## Done criteria

- [ ] `cd pipelines/youtube/tutorial-pipeline-3 && bash scripts/check.sh` → exit 0.
- [ ] `state.test.mjs` proves: edit-after-lock clears the lock and marks re-record;
      lock refuses flags/empty-spoken/null-take; stage gates enforced.
- [ ] PIPELINE.md contains the "Section state machine" section verbatim.
- [ ] `steps/040-polish-lint/rulebook.md` matches Appendix A.
- [ ] No out-of-scope file changed (`git diff --stat` vs the in-scope list).

## STOP conditions

- Dependency missing: `lib/schema.mjs` absent (plan 129 not landed).
- Baseline `scripts/check.sh` already red BEFORE your changes — report, don't fix
  someone else's breakage.
- Any step appears to need a network call or an LLM call.

## Maintenance notes

- `state.mjs` is imported by plan 132 (Worker logic mirrors rule 1 + 2 in TS) and
  plan 133 (intake). If invariants change, change PIPELINE.md's state-machine
  section and all three consumers together.
- The polish rulebook is owner-taste content; executor never edits it beyond
  placement.

---

### Appendix A — steps/040-polish-lint/rulebook.md (place verbatim)

```markdown
# Polish pass rulebook (step 040)

Input: `videos/<slug>/script.json` at stage "verified" — the tutorial maker has
resolved every flag, often as rough notes. Your job is to make the script
TTS-ready without changing what it says.

## What you do

1. Rewrite any rough tutorial-maker phrasing into the channel voice (match the
   same Style DNA pack step 020 used). Preserve their facts exactly: button
   labels, menu paths, prices, and step order they verified are ground truth —
   you polish wording around them, never "correct" them from memory.
2. Confirm zero flag markers remain in any display_text. If you find one, STOP
   and report it — resolving flags is the tutorial maker's job, not yours.
3. Fill `spoken_text` for every section: start from display_text, apply
   `videos/<slug>/respellings.json` (if present) via
   `node -e` on `lib/spoken.mjs`'s deriveSpoken, then fix anything a TTS engine
   would stumble on: expand awkward abbreviations, spell out numbers under
   thirteen, break sentences longer than ~25 words. display_text stays clean
   for captions; spoken_text is what the engine reads.
4. Do not add, remove, merge, or reorder sections. Do not change `demo` flags,
   `notes`, or ids. Word-count limits from the contract still apply.

## Finish

- `node lib/lint-script.mjs videos/<slug>/script.json --stage polished` → exit 0.
- `node lib/render-script-md.mjs <slug>` to refresh script.md.
- Report per section: unchanged / wording-polished / spoken-only, so the owner
  can diff-review in seconds.
```
