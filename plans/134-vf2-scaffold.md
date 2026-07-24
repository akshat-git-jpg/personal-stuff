---
executor: agy
model:
test_cmd: cd pipelines/video/visuals-flow-2 && bash scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 134: visuals-flow-2 scaffold — copy the v1 spine, prove parity

## Summary

- **Problem statement**: visuals-flow v2 (spec `docs/specs/2026-07-24-visuals-flow-v2-design.md`) lives in a NEW folder `pipelines/video/visuals-flow-2/` per owner decision (decisions.md 2026-07-24), but that folder doesn't exist. Every later v2 plan (135–141) depends on this scaffold.
- **Goals**: copy the tracked v1 machinery into `visuals-flow-2/`, empty the `videos/` workdirs, retarget kb-scratch output paths to `visuals-flow-2`, and prove the copy is healthy by its own test gate.
- **Executor proposed**: agy (Gemini 3.1 Pro High, agy default) — mechanical.
- **Done criteria**: `bash scripts/check.sh` exits 0 inside the new folder; no `kb-scratch/video/visuals-flow` (without `-2`) path string remains; `videos/` contains only `.gitkeep`.
- **Stop conditions**: v1's own check.sh already red before copying; any file needing changes outside the two in-scope roots.
- **Test / verification for success**: the copied suite's `scripts/check.sh` (unit tests + rulebook consistency + run.sh smoke).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md` — NO: plan branches never
> edit `plans/README.md` (boss rule); report status in your run summary instead.
>
> **Drift check (run first)**: `git diff --stat 3bbaa6c..HEAD -- pipelines/video/visuals-flow pipelines/video/visuals-flow-2`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Difficulty**: mechanical
- **Planned at**: commit `3bbaa6c`, 2026-07-24

## Why this matters

Owner decision (decisions.md 2026-07-24): v2 evolves in a new folder so v1 stays a working fallback; v2 keeps v1's proven deterministic spine (transcribe → cue pass → resolve/lint → board → render → shot pass → HeyGen → assemble → FCPXML export) and the later plans add the Loop Studio quality layers. This plan is pure placement: a faithful copy that passes its own gates, with output paths separated so v1 and v2 never write into each other's kb-scratch folders.

## Current state

- Source: `pipelines/video/visuals-flow/` — driver `run.sh` (verbs: status/transcribe/cue-pass/resolve/board/render/fold/shot-pass/shots/avatar/assemble/export/qc), `lib/` (~55 .mjs files incl. per-file tests + `effects/` + `fixtures/`), `scripts/` (check.sh, qc-video.sh, analyze-reference.sh, test-run-sh.sh, measure-bubble-ring.py), `steps/NNN-*/` READMEs + prompts, docs (`PIPELINE.md`, `HANDOFF.md`, `EFFECTS.md`, `INTEGRATION.md`, `EDITOR-STYLE-GUIDE.md`), `references/`, `videos/` (committed per-video data for test-01, test-02, opusclip-tutorial — do NOT copy these), `.gitignore`, `.npmrc`.
- `scripts/check.sh` (the gate) runs an explicit `node --test` file list, then `node lib/check-rulebook.mjs`, `node lib/check-shot-rulebook.mjs`, `bash scripts/test-run-sh.sh`, prints `visuals-flow check OK`. Unit suites never touch `videos/` data (decisions.md 2026-07-20) — so an empty `videos/` cannot break them.
- Cards live in the SIBLING `../card-library/` and lib code reaches it relatively, e.g. `lib/resolve.mjs`:
  ```js
  const cardLibraryRoot = path.resolve(import.meta.dirname, '..', '..', 'card-library');
  ```
  `visuals-flow-2/` sits at the same depth, so relative paths keep working unchanged.
- Generated media goes to kb-scratch; `lib/assemble.mjs` (near line 39) roots it at:
  ```js
  ?? path.join(os.homedir(), 'kb-scratch', 'video', 'visuals-flow');
  ```
  Other kb-scratch mentions exist across lib/scripts/steps (find them with grep in Step 3).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Baseline gate (v1) | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0, `visuals-flow check OK` |
| List tracked v1 files | `git -C pipelines/video/visuals-flow ls-files` | file list |
| New gate (v2) | `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` | exit 0 |

## Scope

**In scope**:
- `pipelines/video/visuals-flow-2/**` (new)
- reading `pipelines/video/visuals-flow/**` (never modified)

**Out of scope**:
- `pipelines/video/visuals-flow/**` — v1 stays byte-identical (looks related; it's the fallback)
- `pipelines/video/card-library/**`, `pipelines/CLAUDE.md`, any skill folder (later plans)

## Git workflow

- Branch: `advisor/134-vf2-scaffold`
- Commit per step, conventional single-line messages, no AI footers. Do NOT push.

## Steps

### Step 1: Baseline — prove v1 green before copying

`cd pipelines/video/visuals-flow && bash scripts/check.sh`

**Verify**: exit 0 and final line `visuals-flow check OK`. If red → STOP condition 1.

### Step 2: Copy tracked files, excluding videos/ data

From `pipelines/video/`:

```bash
mkdir -p visuals-flow-2
git -C visuals-flow ls-files | grep -v '^videos/' | while IFS= read -r f; do
  mkdir -p "visuals-flow-2/$(dirname "$f")"; cp "visuals-flow/$f" "visuals-flow-2/$f";
done
mkdir -p visuals-flow-2/videos && touch visuals-flow-2/videos/.gitkeep
```

**Verify**: `diff <(git -C visuals-flow ls-files | grep -v '^videos/') <(cd visuals-flow-2 && find . -type f ! -path './videos/*' | sed 's|^\./||' | sort)` → empty output (plus `videos/.gitkeep` existing).

### Step 3: Retarget kb-scratch paths to visuals-flow-2

In `visuals-flow-2/` only: `grep -rn "kb-scratch" lib scripts steps *.md run.sh` and change every path whose subfolder is `video/visuals-flow` to `video/visuals-flow-2` (e.g. the `lib/assemble.mjs` OUT_ROOT line quoted above). Leave `video/heygen/visuals-flow/...` avatar-clip paths AS-IS in this plan only if they appear — actually change those too, to `video/heygen/visuals-flow-2/`, so v2 avatar clips are also separated. Do NOT touch `../card-library` relative imports.

**Verify**: `grep -rn "video/visuals-flow'" visuals-flow-2/lib | grep -v "visuals-flow-2"` → no output; same grep for `"video/visuals-flow\"` and `video/visuals-flow/` → no v1-pathed hits.

### Step 4: Run the v2 gate

`cd pipelines/video/visuals-flow-2 && bash scripts/check.sh`

**Verify**: exit 0, `visuals-flow check OK`. Also `bash run.sh nosuchslug status` → prints `no workdir: videos/nosuchslug`, exit 1.

## Test plan

No new tests — the copied suite IS the test. The gate proves lib integrity, rulebook/prompt consistency, and run.sh dispatch in the new location.

## Done criteria

- [ ] `cd pipelines/video/visuals-flow-2 && bash scripts/check.sh` → exit 0
- [ ] `git status --short pipelines/video/visuals-flow` → empty (v1 untouched)
- [ ] `ls pipelines/video/visuals-flow-2/videos/` → only `.gitkeep`
- [ ] Step 3's greps show no un-suffixed kb-scratch visuals-flow paths

## STOP conditions

- v1's `scripts/check.sh` fails at Step 1 (pre-existing red — not yours to fix).
- Any needed edit outside `pipelines/video/visuals-flow-2/`.
- A copied test fails and the fix would change test semantics rather than a path string.

## Maintenance notes

- Plans 135–141 all build on this folder; they assume the file layout copied here.
- v1 fixes made after 2026-07-24 do NOT auto-propagate; if v1 gets a critical fix while v2 plans are in flight, port it manually.
