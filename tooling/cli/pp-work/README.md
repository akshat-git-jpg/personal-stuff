# pp-work (Workspaces)

`pp-work` manages per-session and per-subject git worktrees that are **never reset**. It provides total isolation for interactive work (preventing cross-session bleeding) while guaranteeing that uncommitted work and generated media are never wiped away automatically.

## The Three Roots

Worktrees across this repo are separated into three distinct roots with opposite lifecycle rules. They never overlap.

- **`wt` pool**: `$HOME/kb-scratch/worktrees/<repo>-<hash8>/<n>/<repo>`
  - Reapable, reset on acquire.
- **`pp-work` workspaces**: `$HOME/kb-scratch/workspaces/<repo>-<hash8>/<slug>/<repo>`
  - NEVER reset, NEVER reaped.
- **landing tree**: `$HOME/kb-scratch/landing/<repo>-<hash8>`
  - Always reset on use (a later plan).

## Why not `wt`?

The `wt` tool explicitly excludes interactive work: *"Owner interactive sessions, deploys, VPS/cron ops, and skill edits stay on the main checkout. The `wt` tool is strictly for parallel agent runs."*

Mechanically, `wt` manages a fixed pool of 8 slots and calls `reset_worktree` (`checkout --detach` + `reset --hard` + `clean -fd`) on both `wt get` and `wt return`. A session's interactive work must survive exactly that. Placing workspaces inside `wt`'s root would expose them to being wiped by `wt return`'s own wildcard guard.

## Branches are not enough

In a shared checkout, session B switching to its own branch moves HEAD for session A as well. Even without switching, if session A is working on a file and session B commits a subset of changes from the same working tree, the uncommitted work of one can easily be swallowed by the other. This was reproduced: one working tree holds one copy of each file, and only separate working trees prevent concurrent sessions from tripping over each other's dirty files.

## The Slug Mutex

`pp-work claim` pins a subject workspace to branch `subject/<slug>` (or `work/<slug>` for code). Because `git worktree add` refuses to check out a branch that is already checked out elsewhere, the slug mutex comes for free from git. A second live claim of the same slug simply fails with the path to the holding worktree — no lock file, no PID tracking, no races.

## Two Kinds of Workspaces

- `--kind subject`: For persistent topical exploration. Branch prefix is `subject/`.
- `--kind code`: For discrete feature work. Branch prefix is `work/`.

## Removal Rules

A workspace is only removed via an explicit `pp-work remove <path>` call. There is no `--force`, no TTL, and no automatic reclaim.
Removal requires **both**:
1. **Clean**: No uncommitted work and no generated media (e.g. `.mp4`, `.wav`). Gitignored media blocks removal forever, because renders cannot be recovered from git.
2. **Merged**: The workspace branch must be fully merged into `origin/main`.

## Usage

```bash
# Create or attach to a workspace
wt_path=$(pp-work claim --kind subject --slug testing-video)
cd "$wt_path"

# Inventory across workspaces and the wt pool
pp-work list

# Remove a completed, clean, and merged workspace
pp-work remove /Users/.../kb-scratch/workspaces/...
```
