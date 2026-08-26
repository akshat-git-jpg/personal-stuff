---
executor: agy
model:
test_cmd: bash pipelines/youtube/tutorial-pipeline-3/scripts/check.sh && bash pipelines/video/tts/scripts/check.sh
ui:
deploy:
needs: []
needs_prs: []
touches: [pipelines/video/tts/lib/flags.mjs, pipelines/video/tts/lib/spoken.mjs, pipelines/video/tts/lib/env.mjs, pipelines/video/tts/lib/vo-state.mjs, pipelines/video/tts/lib/vo-synth.mjs, pipelines/video/tts/lib/vo-lock.mjs, pipelines/video/tts/scripts/check.sh, pipelines/youtube/tutorial-pipeline-3/lib/flags.mjs, pipelines/youtube/tutorial-pipeline-3/lib/spoken.mjs, pipelines/youtube/tutorial-pipeline-3/lib/env.mjs, pipelines/youtube/tutorial-pipeline-3/lib/state.mjs, pipelines/youtube/tutorial-pipeline-3/lib/vo-synth.mjs, pipelines/youtube/tutorial-pipeline-3/lib/vo-lock.mjs, pipelines/youtube/tutorial-pipeline-3/run.sh, pipelines/youtube/tutorial-pipeline-3/scripts/check.sh, pipelines/video/tts/CLAUDE.md]

mutation_apply: |
  perl -pi -e 's/^  return text;$/  return displayText;/' pipelines/video/tts/lib/spoken.mjs
mutation_command: bash pipelines/video/tts/scripts/check.sh
mutation_expect: "not ok"
mutation_cwd:
mutation_timeout: 600
---

# Plan 251: Extract the shared voiceover lib into the TTS hub

## Summary

- **Problem statement**: The IndexTTS-2 per-section voiceover engine code
  (`vo-synth.mjs`, `vo-lock.mjs`, `spoken.mjs`, `flags.mjs`, `env.mjs`, and
  `lockSection`) lives inside `pipelines/youtube/tutorial-pipeline-3/lib/`, but
  `pipelines/video/tts/` is the declared hub and source of truth for anything
  voice-related (`pipelines/.claude/skills/yt-vo/SKILL.md`). A second pipeline
  (`yt-script`, plan 252) now needs the same engine, and its only options today
  are importing tp3's internals or copying them.
- **Goals**:
  - Create `pipelines/video/tts/lib/` and move the six VO modules there verbatim.
  - Leave tp3 behaviour byte-identical, via thin re-export shims for the three
    modules other tp3 files import (`flags`, `spoken`, `env`) and a re-export of
    `lockSection` from `state.mjs`.
  - Move the five VO test files to the hub and give the hub its own `check.sh`.
  - Replace tp3's hand-enumerated `check.sh` test list with a glob, so a test
    file added later cannot be silently skipped (decisions.md 2026-08-02).
- **Decisions confirmed**:
  - Where the VO engine code lives -> extract into `pipelines/video/tts/lib/`,
    both pipelines import it (rejected: leave it in tp3 and have yt-script call
    `../tutorial-pipeline-3/lib/vo-synth.mjs`, which makes yt-script depend on
    tp3 internals).
  - Blast radius -> shims, not a call-site sweep. Only `state.mjs` changes its
    own body; `flags.mjs`, `spoken.mjs` and `env.mjs` become one-line re-exports
    so no other tp3 file needs editing.
  - `lockSection` moves; `applyTextEdit`, `checkStageMove` and `STAGES` stay in
    tp3. `lockSection` only reads `flags`, `spoken_text` and `tts.take` (all VO
    fields); the other three read `section.demo` and `section.recording`, which
    are tp3's recording model and not a VO concern.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High).
- **Done criteria** (terse): both `check.sh` gates green (tp3 68 tests, hub tests
  moved intact), and `git grep` finds no tp3-relative import of a moved module.
- **Stop conditions** (terse): any behaviour change, any test edit that weakens
  an assertion, any need to touch a tp3 file not listed in scope.
- **Test / verification for success**: the two `check.sh` scripts, plus an armed
  mutation gate proving the new hub gate can actually fail.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d923b178..HEAD -- pipelines/video/tts pipelines/youtube/tutorial-pipeline-3`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Difficulty**: standard
- **Planned at**: commit `d923b178`, 2026-08-26

## Why this matters

`pipelines/.claude/skills/yt-vo/SKILL.md` states the architecture plainly:
*"The engine, the voice and the reference clip live in `pipelines/video/tts/` —
that folder is the hub and the source of truth for anything voice-related"* and
*"Consuming pipelines own text and collect wavs. They never own a voice, a
reference clip, or an engine choice."* Right now the engine's client code lives
in a consuming pipeline, which inverts that. With one consumer nobody noticed.
Plan 252 adds a second consumer, and at that point the choice is: extract once,
or copy the engine into every pipeline that wants a voiceover.

This plan is a pure move. No behaviour changes, no new features. The tp3 test
suite is the proof.

## Current state

### The six modules to move

All paths below are relative to `pipelines/youtube/tutorial-pipeline-3/`.

| File | Lines | Role | Imported by |
|---|---|---|---|
| `lib/flags.mjs` | 15 | `scanFlags` / `stripFlags` over `[VERIFY: …]` / `[FILL: …]` markers | `schema.mjs`, `spoken.mjs`, `vo-synth.mjs` |
| `lib/spoken.mjs` | 22 | `deriveSpoken(displayText, respellMap)` — the respell substitution | `vo-synth.mjs` |
| `lib/env.mjs` | 21 | `loadEnv(rootDir)` reads `<rootDir>/../../.env` | `vo-synth.mjs` |
| `lib/state.mjs` | 105 | `STAGES`, `applyTextEdit`, `lockSection`, `checkStageMove` | `vo-lock.mjs`, `set-stage.mjs`, others |
| `lib/vo-synth.mjs` | ~150 | the `synth_section` HTTP client + CLI | `run.sh` verb `vo` |
| `lib/vo-lock.mjs` | ~55 | `lockScript` + CLI | `run.sh` verb `vo-lock` |

Only `lockSection` moves out of `state.mjs`. Its current body:

```js
// Throws Error with a message naming the failed precondition; else returns new section.
export function lockSection(section) {
  if (section.flags && section.flags.length > 0) {
    throw new Error("Cannot lock section with remaining flags");
  }
  if (!section.spoken_text) {
    throw new Error("Cannot lock section with empty spoken_text");
  }
  if (section.tts.take === null) {
    throw new Error("Cannot lock section with null take");
  }

  return {
    ...section,
    tts: {
      ...section.tts,
      locked: true
    }
  };
}
```

### Why `env.mjs` moves without an edit

```js
export function loadEnv(rootDir) {
  const envPath = path.join(rootDir, "../../.env");
  ...
}
```

The path is derived from the **caller's** `rootDir` argument, not from the
module's own location. Moving the file changes nothing. Both
`pipelines/youtube/tutorial-pipeline-3` and `pipelines/youtube/yt-script` sit two
levels under `pipelines/`, so both resolve to `pipelines/.env`.

### Relative depth, for the import paths

- tp3 lib: `pipelines/youtube/tutorial-pipeline-3/lib/` -> the hub lib is
  `../../../video/tts/lib/`.
- Hub lib: `pipelines/video/tts/lib/`.

### The current tp3 gate

`pipelines/youtube/tutorial-pipeline-3/scripts/check.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test lib/flags.test.mjs lib/schema.test.mjs lib/lint-script.test.mjs lib/init-video.test.mjs lib/state.test.mjs lib/render-script-md.test.mjs lib/spoken.test.mjs lib/set-stage.test.mjs lib/env.test.mjs lib/vo-synth.test.mjs lib/vo-lock.test.mjs \
  lib/exec.test.mjs lib/ffmeta.test.mjs lib/drive-pull.test.mjs \
  lib/intake-qc.test.mjs lib/filmstrip.test.mjs lib/concat-plan.test.mjs lib/handoff.integration.test.mjs
bash scripts/test-run-sh.sh
echo "tutorial-pipeline-3 check OK"
```

Measured on 2026-08-26 at `d923b178`: **68 tests, 68 pass, 0 fail**, then
`test-run-sh.sh` prints `tutorial-pipeline-3 check OK`.

That enumerated list is itself a known defect class — decisions.md 2026-08-02:
*"`scripts/check.sh` switched from a hand-kept test list to a glob, because an
enumerated gate silently skips every test added after it was written."* Step 6
fixes it here for the same reason.

### `pipelines/video/tts/` today

```
engines/  modal/  pipeline/  references/
CLAUDE.md  OUTPUTS.md  REFERENCES.md  SYNC-PROBLEM.md
SYSTEMS-COST-COMPARISON.md  summary-tts.md  .gitignore
```

No `lib/`, no `scripts/`, no test runner. This plan creates all three.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| tp3 gate | `bash pipelines/youtube/tutorial-pipeline-3/scripts/check.sh` | exit 0, `# pass 68`, then `tutorial-pipeline-3 check OK` |
| hub gate | `bash pipelines/video/tts/scripts/check.sh` | exit 0, `# fail 0`, then `video/tts check OK` |
| both (the merge gate) | `bash pipelines/youtube/tutorial-pipeline-3/scripts/check.sh && bash pipelines/video/tts/scripts/check.sh` | exit 0 |
| no stale imports | `git grep -n "from \"\./\(flags\|spoken\|env\)\.mjs\"" -- pipelines/video/tts/lib` | only hub-internal hits (see Step 5 verify) |

**Never** write a `test_cmd` as `node --test <dir>` — on node 22.14 that fails
with `Cannot find module '.../test'` (plans/runs/LESSONS.md, 2026-07-09). A shell
glob (`node --test lib/*.test.mjs`) is fine because the shell expands it into
explicit file arguments.

## Scope

**In scope**:
- `pipelines/video/tts/lib/` — new: `flags.mjs`, `spoken.mjs`, `env.mjs`,
  `vo-state.mjs`, `vo-synth.mjs`, `vo-lock.mjs` and their five moved test files.
- `pipelines/video/tts/scripts/check.sh` — new.
- `pipelines/video/tts/CLAUDE.md` — one new section documenting `lib/`.
- `pipelines/youtube/tutorial-pipeline-3/lib/` — `flags.mjs`, `spoken.mjs`,
  `env.mjs` become shims; `state.mjs` re-exports `lockSection`; `vo-synth.mjs`
  and `vo-lock.mjs` are deleted.
- `pipelines/youtube/tutorial-pipeline-3/run.sh` — the `vo` and `vo-lock` verbs
  repoint at the hub.
- `pipelines/youtube/tutorial-pipeline-3/scripts/check.sh` — glob.

**Out of scope**:
- `pipelines/video/tts/modal/indextts2_app.py` — the server side. Looks related;
  do not touch. This plan moves client code only.
- `lib/schema.mjs`, `lib/lint-script.mjs`, `lib/set-stage.mjs`,
  `lib/init-video.mjs`, `lib/render-script-md.mjs` and every other tp3 lib file.
  The shims exist precisely so these need no edit. If you find yourself editing
  one, that is a STOP.
- `pipelines/youtube/yt-script/` — plan 252 owns it. Nothing here touches it.
- `applyTextEdit`, `checkStageMove`, `STAGES` — they stay in tp3's `state.mjs`.
- Any change to what `vo-synth` sends, what it writes, or its CLI flags.

## Git workflow

- Branch: `advisor/251-extract-shared-vo-lib`
- Commit: one per step, `refactor(tts): <step>` — no AI footers. Do NOT push.

## Steps

### Step 1: Create the hub lib and move `flags.mjs`, `spoken.mjs`, `env.mjs`

```bash
mkdir -p pipelines/video/tts/lib pipelines/video/tts/scripts
cd pipelines/youtube/tutorial-pipeline-3
for f in flags spoken env; do
  git mv "lib/$f.mjs"      "../../video/tts/lib/$f.mjs"
  git mv "lib/$f.test.mjs" "../../video/tts/lib/$f.test.mjs"
done
```

The three moved modules import only each other (`spoken.mjs` imports
`./flags.mjs`), so their bodies need **no edit** — the relative import still
resolves inside the hub lib.

**Verify**: `ls pipelines/video/tts/lib/` -> lists exactly
`env.mjs env.test.mjs flags.mjs flags.test.mjs spoken.mjs spoken.test.mjs`

### Step 2: Add the three tp3 shims

Recreate each shim so no other tp3 file needs editing. Write these three files
verbatim.

`pipelines/youtube/tutorial-pipeline-3/lib/flags.mjs`:

```js
// Moved to the TTS hub (plan 251). Kept as a re-export so tp3's own modules —
// schema.mjs above all — keep their `./flags.mjs` import unchanged.
export * from "../../../video/tts/lib/flags.mjs";
```

`pipelines/youtube/tutorial-pipeline-3/lib/spoken.mjs`:

```js
// Moved to the TTS hub (plan 251). See lib/flags.mjs for why the shim exists.
export * from "../../../video/tts/lib/spoken.mjs";
```

`pipelines/youtube/tutorial-pipeline-3/lib/env.mjs`:

```js
// Moved to the TTS hub (plan 251). `loadEnv` derives its path from the rootDir
// ARGUMENT, not from this file's location, so the move is behaviour-preserving.
export * from "../../../video/tts/lib/env.mjs";
```

**Verify**: `cd pipelines/youtube/tutorial-pipeline-3 && node -e "import('./lib/flags.mjs').then(m => console.log(Object.keys(m).sort().join(',')))"`
-> `scanFlags,stripFlags`

### Step 3: Move `lockSection` into the hub as `vo-state.mjs`

Create `pipelines/video/tts/lib/vo-state.mjs` with the function copied verbatim
from tp3's `lib/state.mjs` (the body is quoted in full under "Current state"):

```js
// The VO half of tp3's old state.mjs, moved to the hub (plan 251).
// Only this function moved: it reads `flags`, `spoken_text` and `tts.take`,
// all of which are voiceover fields. `applyTextEdit`, `checkStageMove` and
// `STAGES` stayed in tp3 because they read `section.demo` and
// `section.recording` — that is tp3's recording model, not a VO concern.

// Throws Error with a message naming the failed precondition; else returns new section.
export function lockSection(section) {
  if (section.flags && section.flags.length > 0) {
    throw new Error("Cannot lock section with remaining flags");
  }
  if (!section.spoken_text) {
    throw new Error("Cannot lock section with empty spoken_text");
  }
  if (section.tts.take === null) {
    throw new Error("Cannot lock section with null take");
  }

  return {
    ...section,
    tts: {
      ...section.tts,
      locked: true
    }
  };
}
```

Then in `pipelines/youtube/tutorial-pipeline-3/lib/state.mjs`: **delete** the
`lockSection` function body and add this re-export at the top of the file,
immediately below any existing imports:

```js
// lockSection moved to the TTS hub (plan 251); re-exported so tp3 call sites and
// lib/state.test.mjs keep working unchanged.
export { lockSection } from "../../../video/tts/lib/vo-state.mjs";
```

`STAGES`, `applyTextEdit` and `checkStageMove` stay exactly as they are.

**Verify**: `cd pipelines/youtube/tutorial-pipeline-3 && node --test lib/state.test.mjs`
-> `# fail 0`

### Step 4: Move `vo-synth.mjs` and `vo-lock.mjs`

```bash
cd pipelines/youtube/tutorial-pipeline-3
git mv lib/vo-synth.mjs      ../../video/tts/lib/vo-synth.mjs
git mv lib/vo-synth.test.mjs ../../video/tts/lib/vo-synth.test.mjs
git mv lib/vo-lock.mjs       ../../video/tts/lib/vo-lock.mjs
git mv lib/vo-lock.test.mjs  ../../video/tts/lib/vo-lock.test.mjs
```

These are CLI entry points (they use an `isMain` guard), so they get **no shim** —
a shim cannot run as `process.argv[1]`.

Two import edits inside the moved files:

- `pipelines/video/tts/lib/vo-synth.mjs` — its `./env.mjs`, `./flags.mjs` and
  `./spoken.mjs` imports now resolve inside the hub lib. **No edit needed.**
- `pipelines/video/tts/lib/vo-lock.mjs` — change
  `import { lockSection } from "./state.mjs";`
  to
  `import { lockSection } from "./vo-state.mjs";`

Their test files import the module under test by relative path; if either test
imports `./state.mjs`, repoint it to `./vo-state.mjs` the same way. Change
nothing else in either test file.

**Verify**: `cd pipelines/video/tts && node --test lib/vo-synth.test.mjs lib/vo-lock.test.mjs`
-> `# fail 0`

### Step 5: Repoint tp3's `run.sh` at the hub

In `pipelines/youtube/tutorial-pipeline-3/run.sh`, the two verbs currently read:

```bash
  vo)
    node lib/vo-synth.mjs "$slug" --root "$TP3_ROOT" "${@:3}"
    ;;
  vo-lock)
    node lib/vo-lock.mjs "$slug" --root "$TP3_ROOT" "${@:3}"
    ;;
```

Replace with:

```bash
  vo)
    node ../../video/tts/lib/vo-synth.mjs "$slug" --root "$TP3_ROOT" "${@:3}"
    ;;
  vo-lock)
    node ../../video/tts/lib/vo-lock.mjs "$slug" --root "$TP3_ROOT" "${@:3}"
    ;;
```

`run.sh` starts with `cd "$(dirname "$0")"`, so the relative path resolves from
the tp3 directory. `--root "$TP3_ROOT"` is unchanged, which is what keeps the
`videos/<slug>/` layout and the `../../.env` lookup identical.

**Verify**: `git grep -n "lib/vo-\(synth\|lock\)\.mjs" -- pipelines/youtube/tutorial-pipeline-3`
-> only the two `../../video/tts/lib/...` lines in `run.sh`; no bare `lib/vo-*.mjs`

### Step 6: Give the hub a gate, and switch tp3's to a glob

Create `pipelines/video/tts/scripts/check.sh` (chmod +x):

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Glob, never an enumerated list: an enumerated gate silently skips every test
# file added after it was written (decisions.md 2026-08-02). Never `node --test
# lib/` either — a directory arg fails on node 22.14 (LESSONS 2026-07-09).
node --test lib/*.test.mjs
echo "video/tts check OK"
```

Then in `pipelines/youtube/tutorial-pipeline-3/scripts/check.sh`, replace the
whole enumerated `node --test …` invocation (the three continued lines) with:

```bash
node --test lib/*.test.mjs
```

Leave `bash scripts/test-run-sh.sh` and the final `echo` untouched.

**Verify**: `bash pipelines/youtube/tutorial-pipeline-3/scripts/check.sh && bash pipelines/video/tts/scripts/check.sh`
-> exit 0; the tp3 run still ends `tutorial-pipeline-3 check OK`, the hub run ends
`video/tts check OK`, and the two runs' `# pass` counts sum to **68** (the five
moved test files carry their tests with them; the total must not drop)

### Step 7: Document the hub lib

Append a section to `pipelines/video/tts/CLAUDE.md`:

```markdown
## `lib/` — the shared voiceover client (plan 251, 2026-08-26)

The per-section IndexTTS-2 client used to live in
`pipelines/youtube/tutorial-pipeline-3/lib/`. It moved here when a second
pipeline (`yt-script`) needed it, because this folder is the source of truth for
anything voice-related and a consuming pipeline must not own the engine.

| Module | What it does |
|---|---|
| `vo-synth.mjs` | CLI + client for the Modal `synth_section` endpoint. `node lib/vo-synth.mjs <slug> --root <dir> [--only sNN] [--force]` |
| `vo-lock.mjs` | CLI + `lockScript`. `node lib/vo-lock.mjs <slug> --root <dir> [--only sNN]` |
| `vo-state.mjs` | `lockSection` — the lock preconditions (no flags, non-empty `spoken_text`, a take on disk) |
| `spoken.mjs` | `deriveSpoken(display_text, respellMap)` — applies `respell.json` |
| `flags.mjs` | `scanFlags` / `stripFlags` over `[VERIFY: …]` / `[FILL: …]` |
| `env.mjs` | `loadEnv(rootDir)` — reads `<rootDir>/../../.env`, i.e. `pipelines/.env` |

**`--root` is the whole contract.** A consuming pipeline passes its own directory
and the client reads `<root>/videos/<slug>/script.json` plus optional
`<root>/videos/<slug>/respell.json`, and writes `<root>/videos/<slug>/audio/`.
That works for any pipeline sitting two levels under `pipelines/` — the depth
`env.mjs` assumes.

tp3 keeps one-line re-export shims at `lib/flags.mjs`, `lib/spoken.mjs` and
`lib/env.mjs`, and re-exports `lockSection` from `lib/state.mjs`, so its own
modules were not touched by the move.

Gate: `bash scripts/check.sh`.
```

**Verify**: `git grep -c "vo-synth.mjs" pipelines/video/tts/CLAUDE.md` -> `1` or more

## Test plan

No new tests are written. The five moved test files are the proof, and their
combined pass count must be unchanged:

- Before: tp3 `check.sh` -> `# pass 68`.
- After: tp3 `check.sh` + hub `check.sh` -> the two `# pass` numbers sum to 68.

A drop in the total means a test file was left behind or silently excluded, which
is exactly the failure the glob in Step 6 exists to prevent.

The mutation gate proves the **new** hub gate can fail: it breaks the respell
regex in `spoken.mjs` so `deriveSpoken` stops substituting, which must turn
`lib/spoken.test.mjs` red under `pipelines/video/tts/scripts/check.sh`.

## Done criteria

- [ ] `bash pipelines/youtube/tutorial-pipeline-3/scripts/check.sh` exits 0 and
      prints `tutorial-pipeline-3 check OK`.
- [ ] `bash pipelines/video/tts/scripts/check.sh` exits 0 and prints
      `video/tts check OK`.
- [ ] The two runs' `# pass` counts sum to 68.
- [ ] `ls pipelines/video/tts/lib/ | wc -l` -> `11`. Exactly these:
      `env.mjs env.test.mjs flags.mjs flags.test.mjs spoken.mjs spoken.test.mjs
      vo-lock.mjs vo-lock.test.mjs vo-state.mjs vo-synth.mjs vo-synth.test.mjs`.
      `vo-state.mjs` has no test file of its own on purpose — `lockSection` stays
      covered by tp3's `lib/state.test.mjs` through the re-export.
- [ ] `git grep -n "lib/vo-synth.mjs\|lib/vo-lock.mjs" -- pipelines/youtube/tutorial-pipeline-3`
      returns only the two `../../video/tts/lib/…` lines in `run.sh`.
- [ ] `git diff --stat d923b178..HEAD --name-only` lists no file outside this
      plan's in-scope list.
- [ ] `pipelines/video/tts/CLAUDE.md` documents `lib/` and the `--root` contract.

## STOP conditions

- **A gate assertion fails: fix the code or the fixture. Weakening, swapping,
  skipping or deleting an assertion is a STOP.** Every one of the 68 tests
  existed and passed before this refactor; a red test means the move is wrong,
  not the test.
- The combined `# pass` count comes out below 68. A test file went missing. Stop
  and report which one — do not "fix" it by editing `check.sh`.
- You need to edit any tp3 `lib/*.mjs` other than `flags.mjs`, `spoken.mjs`,
  `env.mjs` and `state.mjs`. The shims exist so that is unnecessary; needing it
  means an import you have not accounted for. Stop and report the file.
- `vo-synth.mjs` or `vo-lock.mjs` needs a behaviour change to work from the hub.
  This plan is a pure move; a required behaviour change is a different plan.
- You are tempted to also point `yt-script` at the new hub lib. That is plan 252.
  Out of scope here.

## Maintenance notes

- **The shims are load-bearing, not decoration.** `lib/schema.mjs` imports
  `./flags.mjs`; deleting the shim silently breaks the tp3 schema validator.
  Retire a shim only by sweeping its call sites in the same change.
- **The `env.mjs` depth assumption is now shared.** `loadEnv` resolves
  `<rootDir>/../../.env`. Every consuming pipeline must sit exactly two levels
  under `pipelines/`. A pipeline at a different depth silently loads no env and
  then fails with a confusing `MODAL_TTS_URL is not set`.
- A reviewer should scrutinise: that the combined test count is 68 and not 63,
  and that `state.mjs` kept `applyTextEdit`/`checkStageMove`/`STAGES` rather than
  moving them along for the ride.
- Follow-up, deliberately not done here: `pipelines/video/tts/` has no
  `package.json`, so the hub gate is a shell script. Fine today; revisit if the
  hub grows dependencies.
