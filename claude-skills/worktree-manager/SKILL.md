---
name: worktree-manager
description: >
  Create and manage git worktrees across multiple Zluri repositories, then optionally open them as a unified Cursor workspace.
  Use this skill whenever the user wants to create worktrees, set up a feature branch across repos,
  spin up a multi-repo workspace, or says things like "create worktrees for <feature>",
  "set up worktrees", "new worktree workspace", "switch to a new branch across repos",
  or "I need to work on <ticket> across multiple repos". Also trigger when the user mentions
  worktrunk, wt switch, or multi-repo branch setup.
user-invocable: true
metadata:
  author: faizal-zluri
  version: 1.0.0
---

# Worktree Manager

This skill creates git worktrees across multiple Zluri repositories and optionally opens them as a unified Cursor workspace. It uses [worktrunk](https://github.com/max-sixty/worktrunk) (`wt`) when available, falling back to plain `git worktree`.

## Known Zluri Repositories

These are the repositories the user may ask for. Use this list for fuzzy matching and suggestions:

```
bg-jobs-v1
dashboard-api
zluri-internal-portal
prefect-poc
backend-scripts
backend-triggers-v2
zluri-n8n
agenda-project
de-etl-pipeline
rules-engine
v1-dashboard
integration-queue-consumer
integrations-v1
bull-scheduler
kafka-microservice
zluri_triggers_consumer
zluri-webhook-listener
workflow-service
integration-argo-scripts
workflows-lambda
backend-libs
superset-poc
be-dbt
mobile-app-login
zluri-docs
```

## Workflow

### Step 1: Understand the request

The user will say something like "create worktrees for feature/pod5-1234-new-auth" or "I need to work on XYZ across a few repos." Extract:

- **Feature/branch name**: The branch they want to create (e.g., `feature/pod5-1234-new-auth`)
- **Which repos**: Ask "Which repos do you need worktrees for?" and present the known list above for reference. Accept partial matches and abbreviations.

### Step 2: Resolve the parent folder

All Zluri repos live under a single parent directory (e.g., `/home/user/repos/zluri`). 

**Check memory first.** Look in the agent's memory for a saved "zluri repos parent folder" entry. If found, confirm it with the user: "Last time you told me your repos are in `<path>` — still correct?"

If not in memory, ask: "What's the parent folder where your cloned repos live?" Then **save it to memory** so you never have to ask again.

### Step 3: Verify repo paths

Repos may not be directly under the parent folder — they could be nested at any depth (e.g., `<parent>/some-group/dashboard-api`). Use `find` to locate each repo by name:

```bash
find <parent_folder> -type d -name <repo_name> -not -path '*node_modules*' -not -path '*.git/*' 2>/dev/null
```

- If exactly one match: add to the resolved list
- If multiple matches: show all matches and ask the user which one to use
- If no match: tell the user the repo wasn't found anywhere under the parent folder and ask for the exact path

Present the final resolved list of absolute paths to the user for review before proceeding:

```
I'll create worktrees in these repos:
  1. /home/user/repos/zluri/dashboard-api
  2. /home/user/repos/zluri/backend-libs
  3. /home/user/repos/zluri/backend-scripts
  
Does this look right?
```

Wait for confirmation before creating anything.

### Step 4: Create worktrees

**Branch name handling:** If the branch name contains `/` (e.g., `feature/pod5-1234-new-auth`), the folder suffix must use only the last segment (e.g., `pod5-1234-new-auth`), since `/` is not valid in directory names.

```
branch = "feature/pod5-1234-new-auth"
folder_suffix = "pod5-1234-new-auth"   # everything after the last /
```

**Check if worktrunk is available:**

```bash
command -v wt >/dev/null 2>&1 && echo "worktrunk" || echo "git"
```

Note: `wt` may be a shell function (loaded from `.zshrc`), so `command -v` might not detect it. If it fails, also try:

```bash
type wt 2>/dev/null
```

If `wt` still isn't found, fall back to git.

**For each repo, `cd` into the repo's main working directory and create the worktree:**

If worktrunk is available:
```bash
cd <repo_path> && wt switch -c <branch_name>
```

If using plain git:
```bash
cd <repo_path> && git worktree add -b <branch_name> ../<repo_name>.<folder_suffix>
```

The worktree path for plain git is a sibling of the repo's actual directory: `<repo_parent_dir>/<repo_name>.<folder_suffix>` (where `<repo_parent_dir>` is the directory containing the repo, i.e., `dirname <repo_path>`). Since repos may be nested at various depths, do NOT assume they're directly under the top-level parent folder.

After creating each worktree, record the worktree's absolute path — you'll need it for the workspace file. For worktrunk, the worktree path is similarly a sibling of the repo; confirm by checking the output or running `git worktree list` in the repo.

### Step 5: Copy `.env` files

For each repo that has a `.env` in its main working directory, copy it to the worktree:

```bash
cp <repo_path>/.env <worktree_path>/.env
```

**Special case — `dashboard-api`:** This is a monorepo with two codebases (mongo and postgres). After creating the worktree, also copy the postgres-specific env:

```bash
cp <repo_path>/postgres/.env <worktree_path>/postgres/.env
```

Only copy files that exist — don't error if a repo has no `.env`.

### Step 6: Create Cursor workspace file (optional)

**Ask the user first:** "Would you like me to create a workspace file to open all these worktrees together in your IDE?"

Only proceed with this step if the user confirms.

Build a `.code-workspace` file with all the worktree paths:

```json
{
  "folders": [
    { "path": "<worktree_path_1>" },
    { "path": "<worktree_path_2>" }
  ],
  "settings": {}
}
```

**For `dashboard-api`**, add the `postgres` subdirectory specifically (matching existing convention):
```json
{ "path": "<dashboard-api-worktree>/postgres" }
```

Save the workspace file as:
```
<parent_folder>/<folder_suffix>.code-workspace
```

For example: `/home/user/repos/zluri/pod5-1234-new-auth.code-workspace`

### Step 7: Open in Cursor

If the workspace file was created, offer to open it:

```bash
cursor <workspace_file_path>
```

If `cursor` CLI is not available, tell the user where the workspace file is so they can open it manually.

### Summary

After everything is done, print a summary:

```
Worktrees created for branch: feature/pod5-1234-new-auth

  dashboard-api    -> /home/user/repos/zluri/subdir/dashboard-api.pod5-1234-new-auth
  backend-libs     -> /home/user/repos/zluri/backend-libs.pod5-1234-new-auth
  backend-scripts  -> /home/user/repos/zluri/backend-scripts.pod5-1234-new-auth

.env files copied: dashboard-api, dashboard-api/postgres, backend-libs
Workspace: /home/user/repos/zluri/pod5-1234-new-auth.code-workspace
Opened in Cursor.
```

## Error Handling

- If a branch already exists in a repo, inform the user and ask whether to switch to the existing branch or skip that repo.
- If a worktree already exists at the target path, inform the user rather than overwriting.
- If `cursor` CLI is not available, just tell the user where the workspace file is so they can open it manually.

## Cleanup (future enhancement)

If the user asks to "clean up worktrees" or "remove worktrees for <feature>", the reverse process is:
1. Close the Cursor workspace
2. For each repo: `cd <repo_path> && git worktree remove ../<repo_name>.<folder_suffix>`
3. Delete the `.code-workspace` file
