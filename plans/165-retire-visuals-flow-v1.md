---
executor: agy
model:
test_cmd: cd pipelines/video/card-library && bash scripts/check-cards.sh && cd ../visuals-flow && bash scripts/check.sh
ui: false
deploy:
needs: [plan 163 also edits check-catalog.mjs — land 163 first to avoid a conflict on the same file]
---

# Plan 165: Retire visuals-flow v1

## Summary

- **Problem statement**: `pipelines/video/visuals-flow/` (v1) is superseded by v2, which now runs every video. It is 5.9 GB on disk and 149 tracked files, and it is not inert — **two live gates in `card-library` still import from it**, so it cannot simply be deleted.
- **Goals**:
  - Repoint the two hard dependencies at v2 (verified equivalent, see below).
  - Delete the v1 folder, its skill, and its symlink.
  - Update the routing docs that still point at it.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — mechanical, but with two gates that must stay green.
- **Done criteria** (terse): both gates exit 0 with v1 deleted; no tracked file references a v1 path except historical records.
- **Stop conditions** (terse): either gate changes behaviour; a v1 path remains in live code.
- **Test / verification for success**: `check-cards.sh` + `check.sh` both green after deletion.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c37f2aa..HEAD -- pipelines/video/card-library/scripts pipelines/CLAUDE.md`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: plan 163 (edits the same `check-catalog.mjs`)
- **Category**: tech-debt
- **Difficulty**: mechanical
- **Planned at**: commit `c37f2aa`, 2026-07-28

## Why this matters

Owner, 2026-07-28: *"I want to remove visual flow… I don't think it's required because visual flow 2 is already doing things."* Correct — v2 has run every recent video, and `docs/specs/2026-07-24-visuals-flow-v2-design.md` recorded v1 as *"frozen as fallback once v2 is proven, not deleted"*. It is proven; the fallback can go.

The reason this needs a plan rather than an `rm -rf` is that v1 is **load-bearing for the card-library gate boss runs on every card PR**. Deleting it blind turns `check-cards.sh` red and parks every card merge — the same misleading-attribution failure recorded in `decisions.md` on 2026-07-28, where a card-library break parked an unrelated PR.

## Current state

**Two hard dependencies — both live code, not docs.**

`pipelines/video/card-library/scripts/check-catalog.mjs`, line 2, verbatim:

```js
import { validateVariable } from '../../visuals-flow/lib/resolve.mjs';
```

`pipelines/video/card-library/scripts/check-cards.sh`, line 130, verbatim:

```bash
for hex in $(grep -o '#[0-9A-Fa-f]\{6\}' ../visuals-flow/EDITOR-STYLE-GUIDE.md | sort -u); do
```

**Both are satisfiable by v2 — verified, not assumed:**

- `pipelines/video/visuals-flow/lib/resolve.mjs` line 37 exports `validateVariable`.
- `pipelines/video/visuals-flow/EDITOR-STYLE-GUIDE.md` exists, and its palette is **identical** to v1's:
  ```
  diff <(grep -o '#[0-9A-Fa-f]\{6\}' visuals-flow/EDITOR-STYLE-GUIDE.md | sort -u) \
       <(grep -o '#[0-9A-Fa-f]\{6\}' visuals-flow/EDITOR-STYLE-GUIDE.md | sort -u)
  ```
  produced no output. Repointing is therefore behaviour-neutral for the palette gate — re-run this diff yourself before trusting it.

**Skill wiring:**

```
.claude/skills/visuals-flow -> ../../pipelines/.claude/skills/visuals-flow
```

The v1 skill is a repo symlink only — `tooling/claude-skills/` has no manifest entry for it, so `scripts/relink.sh` needs no change.

**Doc references to v1 paths** (tracked): `pipelines/CLAUDE.md` (folder-map row), `pipelines/video/card-library/DESIGN.md` (line 3), `pipelines/video/card-library/README.md` (line 8), `pipelines/youtube/tutorial-pipeline-3/PIPELINE.md` (line 27) and its `steps/070-handoff-visuals/README.md` (line 7), `pipelines/youtube/tutorial-pipeline-2/5-visuals/135-build-graphics-sonnet/rulebook.md` (line 16), and `pipelines/video/loop-studio/*` handoff notes.

**Size**: 5.9 GB on disk, 149 tracked files — so the bulk is gitignored media under `videos/` (`opusclip-tutorial`, `test-01`, `test-02`).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Card gate | `cd pipelines/video/card-library && bash scripts/check-cards.sh` | exit 0, `card check OK` |
| visuals-flow gate | `cd pipelines/video/visuals-flow && bash scripts/check.sh` | exit 0 |
| Find v1 refs | `git grep -n "visuals-flow/" -- . ':(exclude)pipelines/video/visuals-flow/*' \| grep -v "visuals-flow/"` | see Step 5 |

## Scope

**In scope**:
- `pipelines/video/card-library/scripts/check-catalog.mjs` (import path)
- `pipelines/video/card-library/scripts/check-cards.sh` (style-guide path)
- `pipelines/video/card-library/DESIGN.md`, `README.md` (references)
- `pipelines/CLAUDE.md` (folder map)
- `pipelines/youtube/tutorial-pipeline-3/PIPELINE.md` + `steps/070-handoff-visuals/README.md`
- `pipelines/youtube/tutorial-pipeline-2/5-visuals/135-build-graphics-sonnet/rulebook.md`
- delete `pipelines/video/visuals-flow/`
- delete `pipelines/.claude/skills/visuals-flow/` and `.claude/skills/visuals-flow` (symlink)

**Out of scope**:
- **`decisions.md` and everything under `docs/specs/`.** Those are historical records of decisions made at a time when v1 existed. Rewriting them falsifies the record. Leave every v1 mention there untouched.
- `pipelines/video/loop-studio/*` — study notes describing v1 as it was; historical, leave alone.
- `plans/077-visuals-flow-rename.md` — a completed plan, historical.
- v2 itself. No behaviour change anywhere in `visuals-flow`.
- `tooling/claude-skills/` and `scripts/relink.sh` — no manifest entry exists for the v1 skill.

## Git workflow

- Branch: `advisor/165-retire-visuals-flow-v1`
- Commit: `chore: retire visuals-flow v1 (superseded by v2)` — no AI footers. Do NOT push.

## Steps

### Step 1: Confirm the palettes still match

```bash
cd pipelines/video
diff <(grep -o '#[0-9A-Fa-f]\{6\}' visuals-flow/EDITOR-STYLE-GUIDE.md | sort -u) \
     <(grep -o '#[0-9A-Fa-f]\{6\}' visuals-flow/EDITOR-STYLE-GUIDE.md | sort -u) && echo IDENTICAL
```

**Verify**: prints `IDENTICAL`. If it does not, STOP — repointing would silently change the palette gate.

### Step 2: Repoint the two hard dependencies

In `check-catalog.mjs`, change the import to `'../../visuals-flow/lib/resolve.mjs'`.
In `check-cards.sh`, change the path to `../visuals-flow/EDITOR-STYLE-GUIDE.md`.

**Verify (BEFORE deleting anything)**: `cd pipelines/video/card-library && bash scripts/check-cards.sh` -> exit 0, `card check OK`. This proves the gate runs off v2 while v1 is still present — do not proceed until it does.

### Step 3: Delete v1

```bash
cd /Users/kbtg/codebase/personal-stuff
git rm -r -q pipelines/video/visuals-flow
git rm -r -q pipelines/.claude/skills/visuals-flow
git rm -q .claude/skills/visuals-flow
rm -rf pipelines/video/visuals-flow
```

(`git rm` removes tracked files; the trailing `rm -rf` clears the gitignored media — that is the 5.9 GB.)

**Verify**: `ls pipelines/video/ | grep -c "^visuals-flow$"` -> `0`, and `ls pipelines/video/ | grep -c "^visuals-flow$"` -> `1`

### Step 4: Update the routing docs

- `pipelines/CLAUDE.md`: delete the `video/visuals-flow/` map row. Leave the `visuals-flow` row.
- `pipelines/video/card-library/DESIGN.md` line 3 and `README.md` line 8: repoint `../visuals-flow/` to `../visuals-flow/`.
- `tutorial-pipeline-3` `PIPELINE.md` + `steps/070-handoff-visuals/README.md`: handoff artifacts now target `pipelines/video/visuals-flow/videos/<slug>/`.
- `tutorial-pipeline-2` rulebook line 16: repoint to `pipelines/video/visuals-flow/steps/020-cue-pass-llm/RULEBOOK.md`.

**Verify**: `cd /Users/kbtg/codebase/personal-stuff && git grep -n "visuals-flow/" -- pipelines ':(exclude)pipelines/video/visuals-flow/*' | grep -v "visuals-flow/" | grep -v loop-studio` -> no output

### Step 5: Confirm only historical records mention v1

```bash
cd /Users/kbtg/codebase/personal-stuff
git grep -l "visuals-flow/" -- . ':(exclude)pipelines/video/visuals-flow/*' | grep -v "visuals-flow"
```

**Verify**: the only files listed are `decisions.md`, files under `docs/`, `pipelines/video/loop-studio/*`, and `plans/*` — all deliberately historical. No file under `pipelines/video/card-library/scripts/` or `pipelines/CLAUDE.md` appears.

### Step 6: Both gates

**Verify**:
```bash
cd pipelines/video/card-library && bash scripts/check-cards.sh && cd ../visuals-flow && bash scripts/check.sh
```
-> both exit 0, ending `card check OK` and `visuals-flow check OK`

## Test plan

No new tests. The verification is that the two existing gates — one of which imported from v1 until Step 2 — stay green with v1 gone. Step 2's verify is the important one: it proves the repoint works *while v1 still exists*, so a failure there is unambiguous rather than being confused with the deletion.

## Done criteria

- [ ] `pipelines/video/visuals-flow/` does not exist
- [ ] `.claude/skills/visuals-flow` symlink and `pipelines/.claude/skills/visuals-flow/` are gone
- [ ] `cd pipelines/video/card-library && bash scripts/check-cards.sh` exits 0
- [ ] `cd pipelines/video/visuals-flow && bash scripts/check.sh` exits 0
- [ ] `git grep "visuals-flow/lib/resolve.mjs"` returns nothing
- [ ] no v1 path remains outside `decisions.md`, `docs/`, `loop-studio/`, `plans/`
- [ ] `git diff --stat` shows NO change under `pipelines/video/visuals-flow/`

## STOP conditions

- The Step 1 palette diff is not identical. Repointing would change what the palette gate enforces. Stop and report.
- `check-cards.sh` fails at Step 2, before any deletion. The repoint is wrong; fix it before deleting anything.
- You are about to edit `decisions.md` or anything under `docs/specs/` to remove a v1 mention. Those are historical records — leave them.
- Deleting v1 requires any change inside `visuals-flow/`. It should not; report what forced it.
- `git status` shows deletions under `pipelines/video/visuals-flow/videos/`. You deleted the wrong folder — stop immediately.

## Maintenance notes

- v1's three videos (`opusclip-tutorial`, `test-01`, `test-02`) are gitignored media; the tracked artifacts stay recoverable from git history. Nothing irreplaceable is lost, but the media itself is not recoverable after the `rm -rf` — that is intended (5.9 GB of superseded renders).
- The two card-library gates importing from a *sibling pipeline* is the coupling that made this a plan instead of a delete. If `validateVariable` is ever needed by a third consumer, it belongs in a shared module rather than being imported across pipeline folders again.
- `decisions.md` keeps the record that v1 existed and why it was frozen. That is the correct place for it; the folder is not.
