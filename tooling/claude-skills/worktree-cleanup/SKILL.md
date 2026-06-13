---
name: worktree-cleanup
description: >
  Clean up git worktrees across multiple Zluri repositories by branch name, removing worktree directories
  and their associated .code-workspace file. Use this skill whenever the user wants to clean up worktrees,
  remove worktrees, delete worktrees, tear down a feature workspace, or says things like
  "clean up worktrees for <branch>", "remove worktrees for <feature>", "delete worktrees",
  "tear down <feature> workspace", "I'm done with <branch>", or "clean up <branch>".
  Also trigger when the user mentions worktree removal, worktree cleanup, or closing a multi-repo workspace.
user-invocable: true
metadata:
  author: faizal-zluri
  version: 1.0.0
---

# Worktree Cleanup

This skill removes git worktrees across multiple Zluri repositories for a given branch, and deletes the associated Cursor `.code-workspace` file. It is the reverse of the `worktree-manager` skill.

## Workflow

### Step 1: Get the branch name

The user will say something like "clean up worktrees for feature/single-signoffs" or "I'm done with pod5-1234." Extract the **branch name** (e.g., `feature/single-signoffs`).

If the branch name is ambiguous, ask the user to clarify.

### Step 2: Resolve the parent folder

All Zluri repos live under a single parent directory (e.g., `/home/user/repos/zluri`).

**Check memory first.** Look in the agent's memory for a saved "zluri repos parent folder" entry. If found, confirm it with the user: "Last time you told me your repos are in `<path>` — still correct?"

If not in memory, ask: "What's the parent folder where your cloned repos live?" Then **save it to memory** so you never have to ask again.

### Step 3: Discover all worktrees for the branch

Compute the **folder suffix** from the branch name — everything after the last `/`. For example:

```
branch = "feature/single-signoffs"
folder_suffix = "single-signoffs"
```

Search the parent folder for directories matching the worktree naming pattern `*.<folder_suffix>`:

```bash
find <parent_folder> -maxdepth 3 -type d -name "*.<folder_suffix>" -not -path '*node_modules*' -not -path '*.git/*' 2>/dev/null
```

This catches worktrees at any nesting depth (e.g., `zluri/dashboard-api2/dashboard-api.single-signoffs`).

For each discovered directory, verify it is actually a git worktree by checking for a `.git` file (not directory):

```bash
[ -f <path>/.git ] && echo "worktree" || echo "not a worktree"
```

Only include confirmed worktrees in the list. This prevents accidentally deleting directories that happen to match the naming pattern but aren't worktrees.

### Step 4: Check for the workspace file

Look for the `.code-workspace` file at:

```
<parent_folder>/<folder_suffix>.code-workspace
```

For example: `/home/user/repos/zluri/single-signoffs.code-workspace`

If it exists, include it in the cleanup list.

### Step 5: Confirm with the user

Present everything that will be removed:

```
I found these worktrees for branch feature/single-signoffs:

  1. /home/user/repos/zluri/dashboard-api2/dashboard-api.single-signoffs
  2. /home/user/repos/zluri/backend-libs.single-signoffs
  3. /home/user/repos/zluri/bull-scheduler.single-signoffs
  4. /home/user/repos/zluri/backend-scripts.single-signoffs

Workspace file: /home/user/repos/zluri/single-signoffs.code-workspace

Shall I remove all of these?
```

**Wait for confirmation before removing anything.**

### Step 6: Check for uncommitted changes

Before removing each worktree, check for uncommitted changes:

```bash
cd <worktree_path> && git status --porcelain
```

If there is any output (uncommitted changes exist), **stop and warn the user** for that specific worktree:

```
WARNING: <worktree_path> has uncommitted changes:
  M src/some-file.ts
  ?? new-file.ts

Force remove anyway? (This will discard those changes)
```

- If the user confirms, force-remove: `git worktree remove --force <worktree_path>`
- If the user declines, skip that worktree and continue with the others

For clean worktrees (no uncommitted changes), proceed directly to removal without extra prompts.

### Step 7: Remove worktrees

For each worktree, `cd` into the **main repo directory** (not the worktree) and remove it.

To find the main repo for a worktree, read the `.git` file inside the worktree — it contains a `gitdir:` pointer back to the main repo's `.git/worktrees/` directory:

```bash
cat <worktree_path>/.git
# Output: gitdir: /path/to/main-repo/.git/worktrees/<worktree-name>
```

Extract the main repo path from this (everything before `/.git/worktrees/`).

Then remove the worktree:

```bash
cd <main_repo_path> && git worktree remove <worktree_path>
```

If the worktree has uncommitted changes and the user confirmed force removal:

```bash
cd <main_repo_path> && git worktree remove --force <worktree_path>
```

### Step 8: Delete the workspace file

If the `.code-workspace` file was found in Step 4, delete it:

```bash
rm <parent_folder>/<folder_suffix>.code-workspace
```

### Step 9: Summary

Print a summary of what was done:

```
Cleaned up worktrees for branch: feature/single-signoffs

  Removed:
    dashboard-api    <- /home/user/repos/zluri/dashboard-api2/dashboard-api.single-signoffs
    backend-libs     <- /home/user/repos/zluri/backend-libs.single-signoffs
    bull-scheduler   <- /home/user/repos/zluri/bull-scheduler.single-signoffs
    backend-scripts  <- /home/user/repos/zluri/backend-scripts.single-signoffs

  Skipped (uncommitted changes):
    (none)

  Workspace file deleted: /home/user/repos/zluri/single-signoffs.code-workspace
```

If any worktrees were skipped, list them under the "Skipped" section so the user knows what's left.

## Edge Cases

- **No worktrees found**: Tell the user no worktrees were found for that branch. Suggest they double-check the branch name.
- **Worktree directory already deleted manually**: `git worktree remove` will fail. Run `git worktree prune` in the main repo to clean up stale references, then inform the user.
- **Branch name without prefix**: If the user says "clean up single-signoffs" without the `feature/` prefix, use it as-is for the folder suffix search. The discovery is based on the folder suffix pattern, not the branch name directly.
