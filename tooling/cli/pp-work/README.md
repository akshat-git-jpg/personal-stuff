# pp-work (Workspaces)

`pp-work` manages per-session and per-subject git worktrees that are **never reset**. It provides total isolation for interactive work (preventing cross-session bleeding) while guaranteeing that uncommitted work and generated media are never wiped away automatically.

## The Three Roots

Worktrees across this repo are separated into three distinct roots with opposite lifecycle rules. They never overlap.

- **`wt` pool**: `$HOME/kb-scratch/worktrees/<repo>-<hash8>/<n>/<repo>`
  - Reapable, reset on acquire.
- **`pp-work` workspaces**: `$HOME/kb-scratch/workspaces/<repo>-<hash8>/<slug>/<repo>`
  - NEVER reset. Reclaimed only once clean, merged AND idle — see Removal Rules.
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

Removal requires **all three**. There is no `--force` and no TTL.

1. **Clean**: no uncommitted work and no generated media (`.mp4`, `.wav`, …). Gitignored media blocks removal forever, because renders cannot be recovered from git.
2. **Merged**: the workspace branch is fully merged into `origin/main`.
3. **Idle**: the workspace has not been touched for `PPWORK_GRACE_SECS` (default 4h).

### Why the idle gate exists

A land is **not** the end of the owner's work. One session commits many times into one
workspace, and `pp-land` runs on every one of those commits. Without gate 3, the first
successful land of a clean workspace deleted the folder while the session was still
sitting in it — taking the session's working directory with it.

So landing no longer removes anything. `pp-land` calls `pp-work touch` after each land,
and reclaiming is a separate, later step: `pp-work reap`, run from
`boss-session-start.sh`. That placement makes it the catch-up path too — a workspace
whose session died is reclaimed the next time boss opens.

`touched` is **append-only** in the manifest (the same convention as `boss-lib.sh`'s
`meta_set`); every reader takes the last value. An in-place rewrite could strand the
manifest, and a stranded manifest reads as *untouched*, which is to say reapable.

`--now` is the explicit human override for gate 3 alone. Gates 1 and 2 have no override.
`reap` uses it, after making the idle check itself, so this tool keeps exactly one
deletion path and `reap` cannot drift away from `remove`'s gates.

### `list` never hides a workspace

`list` is the only screen showing which workspaces exist, their disk use, and the blocked
lands, so a partial list is worse than a crash. Each workspace is inspected in a subshell
whose failure prints `UNREADABLE` for that row and moves on.

This is not hypothetical. The media probe exits 1 when a workspace holds no renders,
because `grep` reports "no match" that way; under `set -euo pipefail` that killed `list`
mid-loop, so it silently reported a **subset** of the workspaces and exited 1. The same
line made `ws_is_clean` report every media-free workspace as dirty, so nothing could ever
be removed. Both call sites are now guarded, and `test-pp-work.sh` case 11 pins it with
two workspaces where the media-free one sorts first.

## Usage

```bash
# Create or attach to a workspace
wt_path=$(pp-work claim --kind subject --slug testing-video)
cd "$wt_path"

# Inventory across workspaces and the wt pool
pp-work list

# Remove a completed workspace (clean + merged + idle)
pp-work remove /Users/.../kb-scratch/workspaces/...

# Same, overriding the idle gate only
pp-work remove /Users/.../kb-scratch/workspaces/... --now

# Reclaim every finished, idle workspace. Runs from boss-session-start.
pp-work reap

# Mark a workspace as still in use. pp-land calls this after every land.
pp-work touch /Users/.../kb-scratch/workspaces/...
```
