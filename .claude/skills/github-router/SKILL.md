---
name: github-router
description: Pick the correct GitHub account (work / yt / personal) before any git commit, push, branch, or PR action, verifying the repo's author email and gh token match its remote. Triggers on "commit", "push", "open PR", "gh pr create", "create a branch and push", or any intent that writes to a git remote. Also use when a push 403s, a commit landed under the wrong author, or two parallel sessions seem to be fighting over the GitHub account.
user-invocable: true
metadata:
  author: kbtg
  version: 3.0.0
---

# GitHub Account Router

Three GitHub accounts, and often two Claude sessions running at once — one in a ZluriHQ work repo, one in `personal-stuff`. Both must be able to commit and push **at the same instant**, as different people, without either one disturbing the other.

Since 2026-09-18 that is enforced by configuration, not by discipline. This skill is now mostly a *verifier*: it tells you the routing is correct, or names the one thing that is wrong.

## The rule that replaced everything

**Route by the repo's git REMOTE, not its path.** Paths move — worktree pools live in `~/kb-scratch/workspaces/…`, `wt` clones live elsewhere. A remote does not move.

| Remote owner | `gh` login | Commit name | Commit email |
|---|---|---|---|
| `ZluriHQ` / `Zluri` | `kushal-zluri` | `Kushal Bakliwal` | `kushal.b@zluri.com` |
| `akshat-git-jpg` | `akshat-git-jpg` | `akshat-git-jpg` | `akshatparty17@gmail.com` |
| `koala25` | `koala25` | `Kushal Bakliwal` | `kushalbakliwal25@gmail.com` |

One resolver owns this table: `tooling/cli/gh-acct`. Do not re-implement it anywhere.

## Why two sessions no longer collide

Both halves of "who am I" resolve per repo, writing nothing shared:

| Half | Mechanism | Why it is parallel-safe |
|---|---|---|
| **Commit author** | `includeIf "hasconfig:remote.*.url:…"` blocks in `~/.gitconfig` | Git evaluates them per repo, at commit time. Nothing is written. |
| **Push / API auth** | `GH_TOKEN`, exported per shell by `gh-acct` | An env var lives inside one process. Invisible to every other session. |

`~/.zshrc` re-pins `GH_TOKEN` on every `cd`, and `boss_assert_gh` pins it for boss's process tree.

## Banned, and blocked by a hook

`.claude/hooks/no-global-gh-switch.sh` refuses these in any Bash tool call, on **both** accounts:

- `gh auth switch` — rewrites `~/.config/gh/hosts.yml`, which every concurrent session reads
- `gh auth login` — same, plus it needs a browser; it is the owner's command to run
- `git config --global user.email` / `user.name` — moves the author for every repo at once

This is not a style preference. `gh auth switch` is precisely how `kushal-zluri` (work) came to comment on the public `akshat-git-jpg/personal-stuff` repo on 2026-07-30 and 2026-08-01, routing GitHub notification mail to `kushal.b@zluri.com`. Switch-and-restore was tried and only narrowed the window.

Override for one command, only with the owner's say-so: `GUARD_OK=1 <command>`.

## Procedure

### Step 1 — Ask the resolver

```bash
gh-acct check          # or: gh-acct check -C "$(git rev-parse --show-toplevel)"
```

- **exit 0** — identity matches the remote. Go to Step 2.
- **exit 1** — mismatch. It prints the exact repo-scoped fix. Show the user, run it only after they confirm, never with `--global`.
- **exit 2** — it cannot tell which account owns this directory. **Stop and ask the user.** Do not guess. If the answer is a new remote owner, the fix is a new `includeIf` block in `~/.gitconfig` plus a row in `gh-acct`'s table — not a one-off `git config`.
- **exit 3** — that account has no stored `gh` token. Ask the owner to run `gh auth login -h github.com -p https -w` in their own terminal.

### Step 2 — Confirm the push token is pinned

```bash
gh api user -q .login      # must equal `gh-acct who`
```

If it does not match, the shell simply never pinned one (a crew shell, a script, a fresh subprocess):

```bash
eval "$(gh-acct export)"
```

That is the whole fix. Never reach for `gh auth switch`.

### Step 3 — Do the git action

Commit / push / PR as asked. Commit-message rules live in the repo's own commit skill (`commit-now` here, `commit-now-work` in ZluriHQ repos).

## Setting up a new repo

Clone it anywhere. If its remote owner is already in the table, both halves route themselves — there is nothing to configure.

If the remote owner is new:

1. Add an `includeIf "hasconfig:remote.*.url:https://github.com/<owner>/**"` block to `~/.gitconfig` (and the `git@` form).
2. Add the owner to `owner_to_acct` in `tooling/cli/gh-acct/gh-acct`.
3. `gh-acct check` to confirm.

A repo with no remote yet falls back to a path rule inside `gh-acct`; a path it does not recognise exits 2 and asks.

## Common symptoms

| Symptom | Cause | Fix |
|---|---|---|
| `git push` 403s | `GH_TOKEN` unset, so the call fell through to the global account | `eval "$(gh-acct export)"` |
| A commit landed under the wrong author | The repo has a stale repo-local `user.email` overriding the remote rule | `gh-acct check` prints the exact fix |
| `gh pr create` opened the PR as the wrong user | Same as the 403 | `eval "$(gh-acct export)"` |
| Two sessions keep flipping the account | Something still calls `gh auth switch` | Find it: `grep -rn "gh auth switch"`. The hook blocks tool calls, not scripts the owner runs directly |
| `gh-acct: command not found` | `~/.local/bin` symlink missing after a fresh clone | `scripts/relink.sh` |

## Notes

- This skill inspects and reports. It changes state only after the user confirms, and only ever with repo-scoped commands.
- The remote is ground truth. If a path rule and a remote disagree, the remote wins — surface the conflict, do not paper over it.
- `~/.gitconfig` keeps a global `[user]` of `kushal.b@zluri.com`. That is the safe default for the 28 ZluriHQ clones, not a statement that work owns an unmatched repo. An unmatched repo gets exit 2 and a question.
- This skill is duplicated into the private `work-skills` plugin. After editing, run `scripts/sync-shared-skills.sh`.
