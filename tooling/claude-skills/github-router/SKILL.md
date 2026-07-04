---
name: github-router
description: Pick the correct GitHub account (work / yt / personal) before any git commit, push, branch, or PR action. Verifies the current repo's `git config user.email` and `gh` active account match the path-based rule. Triggers on "commit", "push", "open PR", "make a PR", "gh pr create", "create a branch and push", or any user intent that writes to a git remote. Also runs before authoring commits so the wrong author isn't attached.
user-invocable: true
metadata:
  author: kbtg
  version: 2.1.0
---

# GitHub Account Router

The user has three GitHub accounts. Picking the wrong one means commits land under the wrong author or pushes fail. Use this skill BEFORE any git write action.

## The three accounts

| Account | GitHub username | Commit name | Commit email | `gh` login name |
|---|---|---|---|---|
| **Work** | (Zluri SSO) | `Kushal Bakliwal` | `kushal.b@zluri.com` | `kushal-zluri` |
| **YT** | `akshat-git-jpg` | `akshat-git-jpg` | `akshatparty17@gmail.com` | `akshat-git-jpg` |
| **Personal** | `koala25` | `Kushal Bakliwal` | `kushalbakliwal25@gmail.com` | `koala25` |

## Path → account rule

Apply these in order. First match wins.

1. Repo path starts with `/Users/kbtg/codebase/personal-stuff/ty` → **YT**
2. Repo path starts with `/Users/kbtg/codebase/personal-stuff/` → **YT**
3. Repo path starts with `/Users/kbtg/codebase/IT` → **YT**
4. Repo path starts with `/Users/kbtg/codebase/personal projects/` → **Personal**
5. Repo path starts with `/Users/kbtg/codebase/` (anything else) → **Work**
6. Anywhere else → **ask the user**, do not guess

## Claude account per folder

| Folder | Claude account |
|---|---|
| `/Users/kbtg/codebase/personal-stuff/ty` | `claude-personal` |
| `/Users/kbtg/codebase/personal-stuff/` | `claude-personal` |
| `/Users/kbtg/codebase/IT` | `claude-personal` |
| `/Users/kbtg/codebase/personal projects/` | `claude-personal` |
| `/Users/kbtg/codebase/` (everything else) | `claude-work` |

## When to run this skill

Trigger before any of:

- `git commit` / `git commit --amend`
- `git push` / `git push --force`
- `git pull --rebase` immediately followed by a push
- `gh pr create` / `gh pr edit` / branch creation that will be pushed
- `git rebase` if rewriting commits that will be pushed
- Any user prompt with intent to publish, push, open a PR, or merge

If the user says *"commit and push X"*, run this skill before producing the commit.

## Procedure

### Step 1 — Find the repo root and look up the expected account

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
```

Apply the path → account rule above to choose **work / yt / personal**.

If the repo is outside `/Users/kbtg/codebase/`, stop and ask the user which account this repo belongs to before proceeding.

### Step 2 — Check current `git config` matches expected

```bash
CURRENT_EMAIL="$(git -C "$REPO_ROOT" config user.email)"
CURRENT_NAME="$(git -C "$REPO_ROOT" config user.name)"
```

Compare against the expected values from the table. If both match → continue to Step 3.

If they don't match, **do not silently fix it**. Show the user the mismatch and propose the exact fix:

```bash
# Example fix for a personal repo currently set to work:
git -C "$REPO_ROOT" config user.email "kushalbakliwal25@gmail.com"
git -C "$REPO_ROOT" config user.name "Kushal Bakliwal"
```

Run the fix only after the user confirms. (The global git config is `kushal.b@zluri.com` / work — that's intentional; per-repo overrides are how non-work repos get the right author.)

### Step 3 — Check `gh` active account matches expected

```bash
gh auth status 2>&1 | grep -E '^\s*(Active|Logged in)'
```

Look for "Active account: true" on the expected `gh` login name from the table.

If the active account is wrong, propose:

```bash
gh auth switch -u <expected-gh-login-name>
```

If the expected account is not logged in at all (e.g., `koala25` not yet authenticated), tell the user:

> *"`gh` isn't logged into `koala25` yet. Run this in a terminal (browser flow):*
> ```
> gh auth login --hostname github.com --git-protocol https --web
> ```
> *Pick the right account when the browser opens. Then re-run the push."*

Do not attempt `gh auth login` from a tool call — it requires an interactive browser flow.

### Step 4 — Verify the remote matches the account (sanity check)

```bash
git -C "$REPO_ROOT" remote get-url origin
```

- Work account → expect `github.com/ZluriHQ/*` or `github.com/Zluri/*`
- YT account → expect `github.com/akshat-git-jpg/*`
- Personal account → expect `github.com/koala25/*`

If the remote doesn't match the expected account, **stop and ask**. Could be:
- A repo placed in the wrong folder
- A fork
- A repo that legitimately belongs to a different account than its location suggests

### Step 5 — Proceed with the requested git action

Once Steps 2–4 are clean (or the user has confirmed any fixes), perform the commit / push / PR.

## Setting up a new repo

When the user clones or creates a new repo under `/Users/kbtg/codebase/`:

1. Identify the target account from the path rule (or ask if ambiguous).
2. If the account is **not work**, set per-repo author:
   ```bash
   git -C "$REPO_ROOT" config user.email "<expected-email>"
   git -C "$REPO_ROOT" config user.name "<expected-name>"
   ```
   Work repos don't need this — the global config already matches.
3. Confirm `gh` is logged into the right account (Step 3 above).

## Common mismatches and fixes

| Symptom | Cause | Fix |
|---|---|---|
| Commit shows `kushal.b@zluri.com` on a personal repo | No per-repo override set | `git config user.email kushalbakliwal25@gmail.com` (and name) |
| `gh pr create` opens PR under `kushal-zluri` on a YT repo | Wrong active `gh` account | `gh auth switch -u akshat-git-jpg` |
| `git push` fails 403 on personal repo | `gh` not logged into `koala25` | Run interactive `gh auth login` first |
| Repo lives in `~/codebase/foo/` but remote is `akshat-git-jpg/foo` | Repo in wrong folder | Move to `~/codebase/personal-stuff/ty/` or `~/codebase/personal-stuff/` if YT account, or set explicit per-repo override |

## Notes

- This skill is read-only on its own — it inspects and tells you what to do. It only modifies state (via `git config` or `gh auth switch`) after you confirm.
- The path map is a heuristic. The git remote URL is the ground truth — if the path says one account but the remote says another, the remote wins. Surface the conflict, don't paper over it.
- This skill is duplicated at `~/.claude-work/skills/github-router/` and `~/.claude-personal/skills/github-router/`. To update: edit one copy, then `cp` to the other.
