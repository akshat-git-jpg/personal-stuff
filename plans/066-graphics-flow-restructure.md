---
executor: claude-p
model: sonnet
test_cmd: cd pipelines/video/graphics-flow && bash scripts/check.sh
ui:
deploy:
needs: ["062-065 landed (they did, 2026-07-17)"]
---

# Plan 066: Restructure the graphics flow as a step-wise pipeline folder

## Summary

- **Problem statement**: The beat-sync graphics flow (plans 062–065) landed as a flat `flow/` dir inside `pipelines/video/card-library/`. Owner wants it as a self-contained, step-wise pipeline folder (modeled on `pipelines/youtube/tutorial-pipeline-1`) with per-video input/output stored inside the same folder, usable independently by other flows.
- **Goals**:
  - New `pipelines/video/graphics-flow/` with numbered `steps/`, `lib/`, `scripts/check.sh`, `PIPELINE.md`, per-video `videos/<slug>/`.
  - `git mv` everything out of `card-library/flow/` (cards + catalog.json + gallery + beat-smoke STAY in card-library — it remains the shared asset hub).
  - Per-video text artifacts committed; media gitignored (house media rule).
  - All existing tests green from the new layout; no stale `card-library/flow` references.
- **Executor proposed**: claude-p / sonnet (standard)
- **Done criteria** (terse): `scripts/check.sh` exit 0; card-library `beat-smoke.sh` still green; zero stale-path references under `pipelines/`.
- **Stop conditions** (terse): any change to card visuals/logic, catalog.json, serve.mjs, beat-smoke; any lib logic rewrite beyond the three specified changes.
- **Test / verification for success**: `bash scripts/check.sh` (all three test files + rulebook check from the new paths).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 03a0f9e..HEAD -- pipelines/video/` (must be empty)

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (mechanical moves + path constants; tests catch breakage)
- **Depends on**: 062–065 (landed)
- **Category**: tech-debt
- **Difficulty**: standard
- **Planned at**: commit `03a0f9e`, 2026-07-17

## Why this matters

The flow is a production pipeline, not a card-library feature: it will run per video, other flows (explainer pipeline, future channels) should be able to call it, and the owner wants each video's graphics data reviewable in one place. The house pattern for that is the step-wise pipeline folder (`tutorial-pipeline-1`: numbered `steps/NNN-<name>-<actor>/` each with README + thin runner, shared `lib/`, `scripts/check.sh`, gitignored regenerables). card-library stays what it already is for the editor: the shared card/asset hub with the gallery and render2 workflow.

## Current state

- `pipelines/video/card-library/flow/` (landed by 062–065): `README.md` (workdir contract + cues.json schema), `RULEBOOK.md`, `cue-pass-prompt.md`, `check-rulebook.mjs`, `resolve.mjs`, `render.mjs`, `board.mjs`, `resolve.test.mjs`, `render.test.mjs`, `board.test.mjs`, `fixtures/` (`cues-ok.json`, `cues-bad.json`, `transcript.json`, `board/`). Open each file before moving it — the path constants you must change are visible near the top of each `.mjs`.
- Scripts currently resolve card-library root as their own parent (e.g. `path.resolve(import.meta.dirname, '..')`) and expect workdirs under `~/kb-scratch/video/graphics/<slug>/`.
- `pipelines/video/card-library/.npmrc` pins the public npm registry — the global npm hits a work registry that 401s. Any folder running `npx hyperframes` needs this pin.
- Model layout (`pipelines/youtube/tutorial-pipeline-1/`): `PIPELINE.md` (flow table), `steps/NNN-<name>-run/` each `README.md` + runner, `lib/`, `scripts/check.sh`, `.gitignore` ignoring `steps/*/output/`.
- Registration surfaces that must reflect the move: `pipelines/CLAUDE.md` folder map (video section), `pipelines/video/card-library/README.md` (currently documents the flow), `pipelines/youtube/tutorial-pipeline-2/5-visuals/135-build-graphics-sonnet/rulebook.md` (last line points at `card-library/flow/RULEBOOK.md`).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| New gate | `cd pipelines/video/graphics-flow && bash scripts/check.sh` | `graphics-flow check OK`, exit 0 |
| card-library gate unchanged | `cd pipelines/video/card-library && bash scripts/beat-smoke.sh` | `beat-smoke OK`, exit 0 |
| Stale refs | `grep -rn "card-library/flow" pipelines/ --include='*.md' --include='*.mjs' --include='*.sh' | grep -v graphics-flow/PIPELINE.md` | no output |

## Scope

**In scope**:
- `pipelines/video/graphics-flow/` (new, incl. moved files)
- Deleting `pipelines/video/card-library/flow/` (via `git mv`)
- `pipelines/video/card-library/README.md` (replace flow docs with a pointer)
- `pipelines/video/card-library/.gitignore` (remove `flow/`-related lines)
- `pipelines/CLAUDE.md` (one folder-map row)
- `pipelines/youtube/tutorial-pipeline-2/5-visuals/135-build-graphics-sonnet/rulebook.md` (fix the pointer line)

**Out of scope**:
- Card `index.html` files, `catalog.json`, `serve.mjs`, `scripts/beat-smoke.sh`, `hyperframes.json`, `meta.json`, `gallery-order.json` — zero edits.
- Any behavior change in resolver/render/board beyond the three changes specified in Step 3.
- `decisions.md`, `plans/README.md` content beyond your own status row (registries are updated on main at landing).

## Git workflow

- Branch: `advisor/066-graphics-flow-restructure`
- Commit per step, e.g. `refactor(video): graphics-flow pipeline folder`. Use `git mv` for every move (preserve history). No AI footers. Do NOT push.

## Steps

### Step 1: Scaffold `pipelines/video/graphics-flow/`

Create exactly:

```
pipelines/video/graphics-flow/
  PIPELINE.md          # written in Step 4
  .gitignore
  .npmrc               # copy of card-library/.npmrc
  lib/                 # Step 2 moves files here
  steps/
    010-transcribe-run/
    020-cue-pass-llm/
    030-resolve-run/
    040-storyboard-review-owner/
    050-render-run/
  scripts/
  videos/.gitkeep
```

`.gitignore`:

```
# per-video media is regenerable / hub-bound — text artifacts ARE committed
videos/*/vo.mp3
videos/*/renders/
videos/*/slices/
# test artifacts
lib/.test-tmp/
lib/fixtures/board/vo.mp3
lib/fixtures/board/slices/
.DS_Store
```

**Verify**: `ls pipelines/video/graphics-flow/steps` -> the 5 step dirs

### Step 2: Move the files (`git mv`, no edits yet)

| From (`card-library/flow/`) | To (`graphics-flow/`) |
|---|---|
| `resolve.mjs`, `render.mjs`, `board.mjs`, `check-rulebook.mjs`, `resolve.test.mjs`, `render.test.mjs`, `board.test.mjs`, `fixtures/` | `lib/` (fixtures → `lib/fixtures/`) |
| `RULEBOOK.md`, `cue-pass-prompt.md` | `steps/020-cue-pass-llm/` |
| `README.md` | temporarily to `PIPELINE.md` (rewritten in Step 4) |

Then delete the now-empty `flow/` and remove any `flow/`-related lines from card-library's `.gitignore`.

**Verify**: `test ! -d pipelines/video/card-library/flow && ls pipelines/video/graphics-flow/lib/resolve.mjs` -> exists

### Step 3: Path + behavior updates in lib (exactly these three, nothing else)

1. **Card-library root constant** — in `resolve.mjs`, `render.mjs`, `board.mjs`, `check-rulebook.mjs`: resolve card-library as `path.resolve(import.meta.dirname, '..', '..', 'card-library')` (lib → video/ → card-library). `check-rulebook.mjs` additionally finds RULEBOOK.md/cue-pass-prompt.md at `path.resolve(import.meta.dirname, '..', 'steps', '020-cue-pass-llm', ...)`.
2. **Workdir argument resolution** — the three CLIs (`resolve.mjs`, `render.mjs`, `board.mjs`) accept `<slug-or-path>`: if the arg is an existing directory or contains `/`, treat it as a path; otherwise resolve to `<pipeline-root>/videos/<arg>`. Pipeline root = `path.resolve(import.meta.dirname, '..')`.
3. **Manifest location** — `render.mjs` writes `manifest.md` at the WORKDIR ROOT (not inside `renders/`), because `renders/` is gitignored and the manifest is a committed text artifact. Update `render.test.mjs`'s expectations accordingly. Clips stay in `renders/`.

Update the test files' fixture paths (`lib/fixtures/...`) and any `.test-tmp` path. Do not change matching, timing, injection, or route logic.

**Verify**: `cd pipelines/video/graphics-flow && node --test lib/resolve.test.mjs lib/render.test.mjs lib/board.test.mjs` -> all pass

### Step 4: Steps + PIPELINE.md + check.sh

Each `steps/NNN-*/` gets a `README.md` (purpose, exact command, in → out); the three `-run` steps and the board step also get a thin `run.sh` (`#!/usr/bin/env bash`, `set -euo pipefail`, cd to pipeline root, exec the underlying command with `"$@"`):

| Step | Actor | Command (in run.sh / README) | In → Out (within `videos/<slug>/`) |
|---|---|---|---|
| `010-transcribe-run` | RUN | `cd videos/<slug> && npx hyperframes@latest transcribe vo.mp3 --json -m small.en` | `vo.mp3` → `transcript.json` |
| `020-cue-pass-llm` | LLM (pluggable: Sonnet default; agy/Antigravity allowed as form-fillers) | per its README: load `RULEBOOK.md`, fill `cue-pass-prompt.md` with transcript + `card-library/catalog.json`, write `cues.json` | `transcript.json` → `cues.json` |
| `030-resolve-run` | RUN | `node lib/resolve.mjs <slug>` | `cues.json` → `resolved.json` |
| `040-storyboard-review-owner` | OWNER | `node lib/board.mjs <slug>` (localhost:4322; edit/flag/approve) | `resolved.json` → approved `cues.json` |
| `050-render-run` | RUN | `node lib/render.mjs <slug>` | `resolved.json` → `renders/*.mp4|mov` + `manifest.md` |

`PIPELINE.md`: rewrite from the moved README — keep the cues.json schema section VERBATIM (it is the contract 064's rulebook references), then: the step table above, the `videos/<slug>/` layout (which files are committed vs gitignored), the independence note ("any flow may call steps 010/030/050 directly with a path argument; card-library is the card source of truth"), and a pointer to `card-library/README.md` for the beat contract.

`scripts/check.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test lib/resolve.test.mjs lib/render.test.mjs lib/board.test.mjs
node lib/check-rulebook.mjs
echo "graphics-flow check OK"
```

**Verify**: `bash scripts/check.sh` -> `graphics-flow check OK`

### Step 5: Re-point the registration surfaces

1. `pipelines/CLAUDE.md` folder map, video section — add under the card-library row: `| [video/graphics-flow/](video/graphics-flow/PIPELINE.md) | Beat-synced motion-graphics pipeline — VO mp3 → cues → storyboard review → rendered clips + manifest (uses card-library cards) | Node + Claude steps |`
2. `pipelines/video/card-library/README.md` — replace any `flow/` documentation with one line: the graphics pipeline moved to `../graphics-flow/` (see its `PIPELINE.md`); card-library remains the card + catalog hub.
3. `135-build-graphics-sonnet/rulebook.md` — fix the pointer line to `pipelines/video/graphics-flow/steps/020-cue-pass-llm/RULEBOOK.md`.

**Verify**: the stale-refs grep from Commands table -> no output

## Test plan

Existing 062–065 test suites, re-run from the new layout via `check.sh`, are the regression net; `beat-smoke.sh` proves card-library is untouched. No new tests except the path updates inside existing ones.

## Done criteria

- [ ] `cd pipelines/video/graphics-flow && bash scripts/check.sh` exits 0
- [ ] `cd pipelines/video/card-library && bash scripts/beat-smoke.sh` exits 0
- [ ] `test ! -d pipelines/video/card-library/flow`
- [ ] Stale-refs grep returns nothing
- [ ] `git log --follow --oneline pipelines/video/graphics-flow/lib/resolve.mjs | wc -l` ≥ 2 (history preserved via git mv)

## STOP conditions

- Any edit to card index.html files, catalog.json, serve.mjs, or beat-smoke.sh.
- Any lib change beyond Step 3's three items (if a test fails and the fix isn't a path, STOP and report — logic regressions are not yours to solve here).
- The cues.json schema text changing in any way during the PIPELINE.md rewrite.

## Maintenance notes

- `videos/<slug>/` text artifacts (transcript.json, cues.json, resolved.json, manifest.md) are committed per video — expect the folder to grow; media never lands in git (`.gitignore` above). If per-video commits get noisy, revisit with the owner before changing the rule.
- Other flows integrate by calling `lib/resolve.mjs` / `lib/render.mjs` with a path argument — keep the slug-or-path resolution stable.
- `.npmrc` must exist in any folder that runs `npx hyperframes` (work-registry 401 otherwise).
