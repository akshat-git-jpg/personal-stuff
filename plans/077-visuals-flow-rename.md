---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 077: Rename graphics-flow → visuals-flow (folder + live references)

## Summary

- **Problem statement**: `pipelines/video/graphics-flow/` is growing an avatar/shot-plan phase (design doc `docs/specs/2026-07-18-avatar-shot-plan-design.md`); the name "graphics-flow" undersells what the folder now owns (everything on screen, not just graphics cards). Owner picked `visuals-flow` on 2026-07-18.
- **Goals**:
  - `git mv pipelines/video/graphics-flow pipelines/video/visuals-flow` with history preserved.
  - Update every LIVE reference to the old path/name; leave historical records untouched.
  - Add a dated `decisions.md` entry recording the rename.
- **Executor proposed**: `agy` (Gemini 3.1 Pro High, agy default) — owner-directed for this batch; mechanical rename.
- **Done criteria** (terse): flow gate green from the new path; zero live-doc references to `graphics-flow` outside the historical-record allowlist.
- **Stop conditions** (terse): check.sh red BEFORE the rename; any reference file not in this plan's inventory that isn't clearly historical.
- **Test / verification for success**: `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0 + a repo-wide grep matching only the allowlist.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b40a207..HEAD -- pipelines/video/graphics-flow pipelines/video/visuals-flow pipelines/CLAUDE.md decisions.md plans/README.md pipelines/video/card-library tooling/cli/local-apps-dashboard/apps.json pipelines/youtube/tutorial-pipeline-1/PIPELINE.md pipelines/youtube/tutorial-pipeline-2`
> If the diff is non-empty, report what changed and ask before proceeding.

## Status

- **Priority**: P1 (all of 078–080 build on the new path)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Difficulty**: mechanical
- **Planned at**: commit `b40a207`, 2026-07-18

## Why this matters

The avatar shot-plan phase (GFX-07, plans 078–080) lands new steps inside this folder; renaming first means every new file, doc, and plan references the final name once instead of being renamed again later. The rename is also an owner decision (2026-07-18 brainstorm) that should be recorded before the folder grows.

## Current state

- `pipelines/video/graphics-flow/` — the beat-synced motion-graphics pipeline (PIPELINE.md, HANDOFF.md, INTEGRATION.md, EDITOR-STYLE-GUIDE.md, `lib/`, `steps/`, `scripts/`, `tests/`, `videos/`). All libs resolve their own paths relative to `import.meta.dirname` (e.g. `resolveWorkdir` in `lib/resolve.mjs:133-137` walks up to the pipeline root), and card-library is referenced as `path.resolve(import.meta.dirname, '..', '..', 'card-library')` — **no absolute or name-dependent paths inside `lib/`**, so the folder rename does not touch any `.mjs` logic.
- The flow gate: `scripts/check.sh` runs `node --test` on 7 lib test files + `node lib/check-rulebook.mjs` and prints `graphics-flow check OK` (update that string too).
- Live files referencing `graphics-flow` OUTSIDE the folder (verified by repo-wide grep 2026-07-18, node_modules/.git excluded):
  1. `pipelines/CLAUDE.md` — folder-map row for `video/graphics-flow/`.
  2. `plans/README.md` — the two backlog sections titled "graphics-flow backlog" / "graphics-flow PRODUCT backlog" (GFX-01..12 rows).
  3. `pipelines/video/card-library/README.md` and `DESIGN.md` — cross-links to the flow.
  4. `pipelines/youtube/tutorial-pipeline-1/PIPELINE.md`, `pipelines/youtube/tutorial-pipeline-2/PIPELINE.md`, `pipelines/youtube/tutorial-pipeline-2/5-visuals/135-build-graphics-sonnet/rulebook.md` — caller docs pointing at the flow.
  5. `tooling/cli/local-apps-dashboard/apps.json` — registered path for the board app.
  6. `docs/specs/2026-07-18-avatar-shot-plan-design.md` — the new design doc (already written in terms of the rename; only its `graphics-flow` mentions that denote the OLD path stay as-is — it explicitly documents the rename).
- Historical records that MUST NOT be edited (they describe the past): `plans/0NN-*.md` plan files, `plans/runs/`, `tooling/boss/state/*.brief.md`, past entries in `decisions.md`, `tests/TESTS.md` history lines INSIDE the flow folder (leave the log lines; update only forward-looking text if any heading references the folder name as a live path).
- Inside the folder itself, docs self-reference the name (PIPELINE.md title `# graphics-flow`, HANDOFF.md, INTEGRATION.md, step READMEs, `scripts/check.sh` echo line). Update these — they are live operative docs.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Flow gate (before + after) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` (before rename: run from `graphics-flow`) | exit 0, last line `visuals-flow check OK` (after) |
| Reference sweep | `grep -rln "graphics-flow" --include="*.md" --include="*.mjs" --include="*.json" --include="*.sh" . \| grep -v -e node_modules -e "^./plans/0" -e "plans/runs/" -e "boss/state/"` (repo root) | after Step 3: only historical files + `decisions.md` (past entries + the new rename entry's own mention of the old name) + `docs/specs/2026-07-18-avatar-shot-plan-design.md` |
| History preserved | `git log --oneline --follow pipelines/video/visuals-flow/PIPELINE.md \| head -3` | shows pre-rename commits |

## Scope

**In scope**:
- `pipelines/video/graphics-flow/` → `pipelines/video/visuals-flow/` (git mv) and name mentions inside the folder's own live docs (`PIPELINE.md`, `HANDOFF.md`, `INTEGRATION.md`, `EDITOR-STYLE-GUIDE.md`, step `README.md`s, `scripts/check.sh`, `.gitignore` comments if any).
- The 6 live external files listed in Current state.
- `decisions.md` — ONE new dated entry (see Step 4).
- `plans/README.md` — the backlog section headings + GFX row paths, plus this plan's status row.

**Out of scope**:
- Any `.mjs`/test logic changes — the rename requires none (paths are all relative); if a test fails after the rename, that's a STOP, not a fix-in-place.
- Historical records (old plans, run logs, boss briefs, past decisions.md entries, TESTS.md log lines).
- `videos/test-01/` data files — committed artifacts move with the folder; do not edit their contents.
- Anything in plans 078–080's scope (new steps, board, avatar render).

## Git workflow

- Branch: `advisor/077-visuals-flow-rename`
- Commit: `chore(visuals-flow): rename graphics-flow -> visuals-flow (folder + live refs)` — no AI footers. Do NOT push.

## Steps

### Step 1: Baseline gate

From `pipelines/video/graphics-flow`: `bash scripts/check.sh`.

**Verify**: exit 0, ends `graphics-flow check OK`. If red, STOP (pre-existing breakage — do not rename on a red baseline).

### Step 2: git mv + in-folder name updates

`git mv pipelines/video/graphics-flow pipelines/video/visuals-flow`. Then, inside `pipelines/video/visuals-flow/`, replace the name in live docs: title/body mentions in `PIPELINE.md`, `HANDOFF.md`, `INTEGRATION.md`, `EDITOR-STYLE-GUIDE.md`, every `steps/*/README.md`, and the `echo "graphics-flow check OK"` line in `scripts/check.sh` (→ `visuals-flow check OK`). In `tests/TESTS.md`, update only the document title/intro if it names the folder as a live path; leave dated log entries verbatim.

**Verify**: `grep -rn "graphics-flow" pipelines/video/visuals-flow --include="*.md" --include="*.sh" | grep -v "tests/TESTS.md"` → no hits (TESTS.md history lines may remain).

### Step 3: Update the live external references

Apply the name/path change in: `pipelines/CLAUDE.md` (folder-map row), `plans/README.md` (backlog headings + GFX row paths), `pipelines/video/card-library/README.md`, `pipelines/video/card-library/DESIGN.md`, `pipelines/youtube/tutorial-pipeline-1/PIPELINE.md`, `pipelines/youtube/tutorial-pipeline-2/PIPELINE.md`, `pipelines/youtube/tutorial-pipeline-2/5-visuals/135-build-graphics-sonnet/rulebook.md`, `tooling/cli/local-apps-dashboard/apps.json` (path value only — do not touch other fields).

**Verify**: the reference-sweep grep from "Commands you will need" → only the allowed historical files remain.

### Step 4: decisions.md entry + flow gate

Append to `decisions.md` (match the file's existing dated-entry format):
`2026-07-18 — Renamed pipelines/video/graphics-flow → visuals-flow: the folder now owns the avatar/screen-recording shot plan (GFX-07) as well as graphics, per docs/specs/2026-07-18-avatar-shot-plan-design.md. Old name in historical docs/plans left as-is.`

Then run the flow gate from the NEW path.

**Verify**: `cd pipelines/video/visuals-flow && bash scripts/check.sh` → exit 0, `visuals-flow check OK`.

## Test plan

No new tests — the existing 7-file `node --test` suite + `check-rulebook.mjs` running green from the new path IS the proof (all path resolution is relative; a rename regression would surface as a test failure or a missing-file crash).

## Done criteria

- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0 and prints `visuals-flow check OK`.
- [ ] Repo-wide `graphics-flow` grep (excluding node_modules, `plans/0*`, `plans/runs/`, `boss/state/`) matches only: `decisions.md`, `docs/specs/2026-07-18-avatar-shot-plan-design.md`, and `pipelines/video/visuals-flow/tests/TESTS.md` history lines.
- [ ] `git log --follow` shows pre-rename history on a moved file.
- [ ] `plans/README.md` row for 077 flipped to DONE.

## STOP conditions

- Step 1 baseline is red — the rename must start from green.
- The reference sweep reveals a live file NOT in this plan's inventory (something added after 2026-07-18) — report it, don't improvise a policy for it.
- Any test failure after the rename — do not patch lib code under this plan.

## Maintenance notes

- Plans 078–080 (and the boss briefs generated from them) reference `pipelines/video/visuals-flow/` — this plan must land FIRST.
- The `GFX-` backlog prefix is an id, not a path; it stays.
- `local-apps-dashboard` reads `apps.json` at runtime; a stale path there fails silently (app just won't launch the board) — that's why it's in the inventory.
