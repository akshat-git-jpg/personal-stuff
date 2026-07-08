# worktree-tracker — Design

**Date:** 2026-07-08
**Author:** Kushal Bakliwal
**Status:** Approved (pending spec review)

## Purpose

A Claude Code skill that creates and **persistently tracks** git worktrees for
ZluriHQ repositories on the user's Desktop. Worktrees are organized into named
**sets**, where each repo in a set is pinned to its own branch (different repos
in the same set can be on different branches). A JSON registry is the source of
truth so the user can ask "what worktrees do I have?" at any time.

This is a **new standalone skill**. It does not modify or replace the existing
`worktree-manager` / `worktree-cleanup` skills.

## Key concepts

- **Set** — a named group (e.g. `policy-platform`) of repo worktrees that belong
  together. A set spans one or more repos.
- **Member** — one repo's worktree inside a set, pinned to a specific branch.
- **Registry** — a JSON file that records all sets, their members, each member's
  branch + worktree path + creation time. Reconciled against real git state.

## Fixed conventions (already established by the user)

- **Base directory:** `~/Desktop/worktrees/`
- **Layout:** flat, `<set>.<repo>/` per member (e.g. `policy-platform.dashboard-api/`)
- **Workspace file:** `~/Desktop/worktrees/<set>.code-workspace` (top level)
- **Registry file:** `~/Desktop/worktrees/.registry.json`
- **Source repos:** located under `/Users/kbtg/codebase/` (may be nested in
  subgroups). Resolve each repo by name via `find`.

## Hard constraints

1. **ZluriHQ repos only.** Before creating a worktree for a repo, verify its
   `origin` remote matches `github.com[:/]ZluriHQ/`. If it does not (e.g. a repo
   like `IT` whose origin is `akshat-git-jpg/IT`), refuse and tell the user. This
   is a dynamic check, not a hardcoded allowlist.
2. **User-supplied branches only.** The user always names the branch per repo.
   The skill checks out that branch into the worktree. If the branch does not
   exist (local or remote), the skill **stops and tells the user** — it does not
   auto-create branches.
3. **Plain `git worktree`, not `wt`.** Even though `worktrunk` (`wt`) is
   installed, use plain `git worktree add` for exact control over the flat
   Desktop path/naming convention.

## Registry schema

`~/Desktop/worktrees/.registry.json`

```json
{
  "version": 1,
  "sets": {
    "policy-platform": {
      "createdAt": "2026-07-08T10:00:00Z",
      "workspaceFile": "/Users/kbtg/Desktop/worktrees/policy-platform.code-workspace",
      "members": {
        "dashboard-api": {
          "branch": "feature/pod5-policy",
          "worktreePath": "/Users/kbtg/Desktop/worktrees/policy-platform.dashboard-api",
          "sourceRepo": "/Users/kbtg/codebase/dashboard-api",
          "createdAt": "2026-07-08T10:00:00Z"
        },
        "backend-scripts": {
          "branch": "fix/policy-hotfix",
          "worktreePath": "/Users/kbtg/Desktop/worktrees/policy-platform.backend-scripts",
          "sourceRepo": "/Users/kbtg/codebase/backend-scripts",
          "createdAt": "2026-07-08T10:00:00Z"
        }
      }
    }
  }
}
```

The registry is created on first use if absent. Every operation reads it, mutates
it in memory, and writes it back atomically.

## Reconciliation (self-healing)

Git is the ultimate source of truth for what exists on disk. On any **list** or
**status** operation — and before any mutating op — reconcile:

1. For each member in the registry, check the worktree path exists and is a valid
   worktree (`.git` file present). If missing → flag as `missing` (user likely
   deleted it manually); offer to prune from the registry.
2. For each member, run `git -C <worktree> rev-parse --abbrev-ref HEAD` to confirm
   the actual branch matches the recorded branch. If drifted → update the registry
   to reflect reality and note it.
3. Report any drift to the user rather than silently hiding it.

## Operations

### 1. Create a set

Trigger: *"make a worktree set `policy-platform` with dashboard-api on
`feature/x` and backend-scripts on `fix/y`."*

Steps:
1. Parse set name + `(repo, branch)` pairs from the request.
2. For each repo:
   a. Resolve source path under `/Users/kbtg/codebase/` via
      `find <base> -type d -name <repo> -not -path '*node_modules*' -not -path '*.git/*'`.
      Multiple matches → ask which; no match → error.
   b. **ZluriHQ guard:** `git -C <src> remote get-url origin` must match ZluriHQ.
   c. Verify the named branch exists (`git -C <src> rev-parse --verify` for local,
      or check `git -C <src> ls-remote --heads origin <branch>`). If not → stop.
   d. `git -C <src> worktree add ~/Desktop/worktrees/<set>.<repo> <branch>`.
   e. Copy `.env` if present. Special case dashboard-api: also copy
      `postgres/.env` → `<worktree>/postgres/.env`.
3. Write the set into the registry.
4. Generate `<set>.code-workspace` listing all member worktree paths (for
   dashboard-api, point at the `postgres` subdir per existing convention).
5. Offer to open in Cursor (`cursor <workspace>`).
6. Print a summary.

If the set already exists → do not silently merge. Warn the user that the set
exists and direct them to the **add** operation (op 3) for any new repos. Only
proceed to create members that are genuinely new to the set, after confirmation.

### 2. List / status

Trigger: *"what worktrees do I have?"* / *"show set policy-platform."*

- Read registry, run reconciliation, print a tree:

```
policy-platform
  dashboard-api    feature/pod5-policy   clean
  backend-scripts  fix/policy-hotfix     2 uncommitted, ahead 1

payments-x
  dashboard-api    feature/pay-123       clean
```

- Status per member: clean/dirty (`git status --porcelain`) + ahead/behind vs
  upstream when available.
- Show drift/missing flags from reconciliation.

### 3. Add a repo to a set

Trigger: *"add rules-engine on `feature/x` to policy-platform."*

- Same per-repo flow as create (resolve, ZluriHQ guard, branch check, worktree
  add, env copy), then update the registry and regenerate the workspace file.

### 4. Remove

Trigger: *"remove backend-scripts from policy-platform"* / *"tear down policy-platform."*

- For each member being removed: check `git status --porcelain`. If uncommitted
  changes exist → warn and require explicit confirmation before force-removing.
- Remove via `git -C <source_repo> worktree remove <path>` (force if confirmed).
- Update the registry. If removing the whole set → delete the `.code-workspace`
  file. If a member dir was already deleted manually → `git worktree prune` and
  reconcile.

## Error handling

- Repo not found under codebase → report, ask for exact path.
- Repo not a ZluriHQ repo → refuse with the detected remote shown.
- Branch does not exist → stop, tell the user (do not auto-create).
- Branch already checked out in another worktree → git will refuse; surface the
  error clearly.
- Worktree path already exists → do not overwrite; inform the user.
- `cursor` CLI missing → print the workspace path so the user opens it manually.

## Out of scope (YAGNI)

- Auto-creating branches.
- Non-ZluriHQ repos.
- `wt`/worktrunk integration.
- Editing individual member branches in place (remove + re-add instead).

## Distribution

- Author once. Place in **both**:
  - `personal-stuff/tooling/claude-skills/worktree-tracker/` (immediate personal use)
  - `zluri-skills/skills/dev-utils/worktree-tracker/` on a branch + PR (share with org)
