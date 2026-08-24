---
name: worktree-tracker
version: 1.0.0
description: >
  Create and persistently track git worktrees for ZluriHQ repositories on the
  Desktop, grouped into named sets where each repo is pinned to its own branch.
  Use when the user wants to spin up a tracked multi-repo worktree set, list what
  worktrees exist, add a repo to a set, or tear a set down. Triggers on
  "make a worktree set", "track my worktrees", "what worktrees do I have",
  "add <repo> to <set>", "tear down <set>", "worktree tracker".
metadata:
  author: kushal-zluri
---

# Worktree Tracker

Creates and tracks git worktrees for ZluriHQ repos under `~/Desktop/worktrees/`,
grouped into named **sets**. Each repo in a set is pinned to its own branch.
State lives in `~/Desktop/worktrees/.registry.json`, edited only via the bundled
helper `scripts/registry.mjs`.

## Conventions (fixed)

- Base dir: `~/Desktop/worktrees/`
- Member worktree: `~/Desktop/worktrees/<set>.<repo>/`
- Workspace file: `~/Desktop/worktrees/<set>.code-workspace`
- Registry: `~/Desktop/worktrees/.registry.json`
- Source repos: under `/Users/kbtg/codebase/` (may be nested).
- The helper: `node "<this-skill-dir>/scripts/registry.mjs" ~/Desktop/worktrees/.registry.json <cmd> [args]`.
  Run `... init` once before other commands; it is idempotent.

## Hard rules

1. **ZluriHQ repos only.** Before creating a worktree, run
   `git -C <source_repo> remote get-url origin`. If it does not match
   `github.com[:/]ZluriHQ/`, refuse and show the detected remote.
2. **Branches must already exist.** The user names the branch. Verify it exists
   (`git -C <src> show-ref --verify --quiet refs/heads/<branch>` OR
   `git -C <src> ls-remote --exit-code --heads origin <branch>`). If neither, STOP
   and tell the user — never auto-create a branch.
3. **Plain `git worktree` only** — never `wt`.

## Resolving a repo path

```bash
find /Users/kbtg/codebase -type d -name "<repo>" -not -path '*node_modules*' -not -path '*/.git/*' 2>/dev/null
```
- One match → use it. Multiple → ask which. None → tell the user, ask for exact path.

## Reconciliation (run on list/status and before mutations)

For each member in the registry:
- If `worktreePath` is missing or has no `.git` file → flag `missing`; offer to
  `remove-member` it from the registry.
- Else read actual branch: `git -C <worktreePath> rev-parse --abbrev-ref HEAD`.
  If it differs from the recorded branch → run `set-branch` to record reality and
  note the drift to the user.

## Operation: Create a set

User: "make a worktree set `policy-platform` with dashboard-api on `feature/x` and backend-scripts on `fix/y`".

1. Parse the set name and each `(repo, branch)` pair.
2. `... init` the registry.
3. If the set already exists (registry `get <set>` succeeds): do NOT merge silently.
   Tell the user it exists and route new repos through **Add a repo to a set**.
4. For each `(repo, branch)`:
   a. Resolve the source repo path (see above).
   b. ZluriHQ guard (hard rule 1).
   c. Branch-exists check (hard rule 2).
   d. `git -C <source_repo> worktree add ~/Desktop/worktrees/<set>.<repo> <branch>`
   e. Copy env if present: `cp <source_repo>/.env ~/Desktop/worktrees/<set>.<repo>/.env`.
      Special case `dashboard-api`: also
      `cp <source_repo>/postgres/.env ~/Desktop/worktrees/<set>.<repo>/postgres/.env` if it exists.
5. Register the set once: `... add-set <set> --workspace ~/Desktop/worktrees/<set>.code-workspace`.
6. For each created member:
   `... add-member <set> <repo> --branch <branch> --path ~/Desktop/worktrees/<set>.<repo> --source <source_repo>`.
7. Write `~/Desktop/worktrees/<set>.code-workspace`:
   ```json
   { "folders": [ { "path": "<worktreePath>" } ], "settings": {} }
   ```
   Include one `folders` entry per member. For `dashboard-api`, point at its
   `postgres` subdir: `{ "path": "<worktreePath>/postgres" }`.
8. Offer to open: `cursor ~/Desktop/worktrees/<set>.code-workspace` (if `cursor`
   is missing, print the path).
9. Print a summary of members, branches, paths, and env files copied.

## Operation: List / status

User: "what worktrees do I have?" / "show set <set>".

1. `... init`, then `... list` (or `... get <set>`).
2. Run reconciliation.
3. For each member: `git -C <worktreePath> status --porcelain` (dirty/clean) and,
   when an upstream exists, ahead/behind via `git -C <worktreePath> rev-list --left-right --count @{u}...HEAD`.
4. Print a tree: set → repo → branch → status, with any drift/missing flags.

## Operation: Add a repo to a set

User: "add rules-engine on `feature/x` to policy-platform".

1. `... get <set>` (error if the set does not exist — offer to create it instead).
2. Run create-steps 4a–4e for the one repo.
3. `... add-member <set> <repo> --branch <branch> --path <worktreePath> --source <source_repo>`.
4. Regenerate the `<set>.code-workspace` from the updated `... get <set>` members.

## Operation: Remove

User: "remove backend-scripts from policy-platform" / "tear down policy-platform".

1. Determine targets: one member, or all members of the set.
2. For each target: `git -C <worktreePath> status --porcelain`. If non-empty
   (uncommitted changes) → WARN and require explicit confirmation before force.
3. Remove: `git -C <source_repo> worktree remove <worktreePath>`
   (add `--force` only if the user confirmed discarding changes). If the dir was
   already deleted manually, run `git -C <source_repo> worktree prune`.
4. Update registry: `... remove-member <set> <repo>` per member, or
   `... remove-set <set>` for a full teardown.
5. On full teardown, delete the workspace file:
   `rm -f ~/Desktop/worktrees/<set>.code-workspace`. On partial removal, regenerate it.
6. Print a summary of removed / skipped members.

## Error handling

- Repo not found under codebase → report, ask for exact path.
- Non-ZluriHQ remote → refuse, show the remote.
- Branch missing → STOP, tell the user (no auto-create).
- Branch already checked out elsewhere / worktree path exists → surface git's error, do not overwrite.
- `cursor` missing → print the workspace path.
