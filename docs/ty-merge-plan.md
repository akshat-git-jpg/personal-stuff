# Migration plan: merge TY into personal-stuff

**Goal:** one repo so Claude never opens the "wrong" one and hunts across the boundary. Skills, pp-drive, the shortener, Pinterest, and Hyperframes stop being split.

**Decision:** `personal-stuff` is the survivor and stays at root, untouched. TY is nested under `ty/`. This keeps every load-bearing personal-stuff path working (the VPS pulls `personal-stuff` on every cron tick; its Cloudflare Workers deploy from `apps/*`). Only TY's paths move.

**Why this shape (not a symmetric `personal/` + `ty/`):** moving personal-stuff into a `personal/` subfolder would break the VPS crons, `vps-sync.sh`, the skill symlinks, `.mcp.json`, and every Worker deploy path — for zero benefit. Nesting only TY breaks only TY's handful of touchpoints.

## What actually breaks (the whole list)

Verified against the repos on 2026-07-03:

1. **`pp-drive` sibling-path resolver** — TY's YouTube pipeline guesses `ROOT.parents[2]/personal-stuff/tooling/cli/drive/pp-drive`. After nesting, personal-stuff's tooling is now a cousin *inside the same tree*. Files:
   - `ty/youtube/kushal-tutorial-pipeline-v2/lib/drive.py`
   - `ty/youtube/kushal-tutorial-pipeline-v2/steps/010-create-drive-folders/run.py`
   - `ty/youtube/kushal-tutorial-pipeline-v2/steps/170-package-for-handoff/run.py`
2. **Doc cross-references** — both READMEs/CLAUDE.mds point at each other as sibling repos (`TY/pinterest/...`, "the sibling personal-stuff repo"). Now in-tree relative paths.
3. **`.gitignore`** — TY's ignore rules must apply under `ty/`. `git subtree` brings `ty/.gitignore` along, which git honors for that subtree, so this is automatic. Verify no root-level rule fights it.

## What does NOT break (confirmed)

- **VPS crons** — pull `personal-stuff` only; its structure is unchanged. Untouched.
- **personal-stuff Cloudflare Workers** (`apps/*`) — paths unchanged.
- **TY Cloudflare Workers** (`ty/workers/redirector`, `ty/pinterest/landing-pages/{keto-kitchen,bridebestie}`) — wrangler deploys from the worker's own dir with relative config; D1/KV bindings are account-level. Deploy still works; only the `cd` path changes.
- **Skills** — stay at `tooling/claude-skills/`, path unchanged, so `relink.sh` symlinks and both accounts keep working.
- **`.mcp.json` / `google-shared` OAuth** — paths unchanged.
- **No submodules** in either repo.

## The one asset gotcha

`git subtree` moves **committed files only**. TY's working tree is ~21G, almost all **untracked/gitignored** video renders and pin images. Those do **not** come along. If you need them in the new location, `rsync` them manually after the merge (or regenerate). The git-tracked content is only ~49M.

## Execution (local, non-destructive — runs on a branch, nothing live is touched)

```bash
cd /Users/kbtg/codebase/personal-stuff
git checkout -b merge-ty

# Bring TY's tracked history under ty/ (reads local TY repo, does not modify it)
git subtree add --prefix=ty ../TY main

# Then: fix the 3 pp-drive resolver files to point at ../../.. within the tree,
# update doc cross-refs, and verify the pipeline can still find pp-drive.
```

Build/verify after:
- `ty/youtube/kushal-tutorial-pipeline-v2/lib/drive.py` resolves pp-drive.
- personal-stuff's own build/lint still passes (nothing there changed, sanity only).
- `git status` clean; branch not pushed.

## Manual cutover (you do these, after reviewing the branch — NOT part of the automated run)

1. `rsync` the 21G untracked assets from `../TY/` into `ty/` if you want them locally.
2. Merge `merge-ty` → `main`, push.
3. Archive the standalone `github.com/akshat-git-jpg/TY` repo (make it read-only / archived, don't delete — it's the fallback).
4. Re-clone or `git pull` on any machine that had TY checked out separately.
5. Add a thin routing section to the root `CLAUDE.md` pointing content/YouTube/Pinterest questions at `ty/`. Keep it thin — do **not** paste TY's full CLAUDE.md into root, or every session pays for it. TY's detail stays in `ty/CLAUDE.md` (subfolder, not auto-loaded).

## Rollback

The branch is isolated and TY is untouched until step 3. If anything looks wrong, `git checkout main && git branch -D merge-ty` and nothing was lost.
