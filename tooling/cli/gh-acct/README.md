# gh-acct

The one place that answers **"which GitHub account owns this repo?"** — with zero global state, so two Claude sessions can commit and push as two different accounts at the same instant.

## Why this exists

`gh auth switch` writes the active account into `~/.config/gh/hosts.yml`. That file is **global**: every shell, every Claude session, every crew worktree on the machine reads it. Session A switching to `akshat-git-jpg` silently re-points session B, which is mid-push to a ZluriHQ repo. That is how `kushal-zluri` ended up commenting on the public `akshat-git-jpg/personal-stuff` repo on 2026-07-30 and 2026-08-01 (decisions.md 2026-08-03), and it is the bug this tool closes.

The fix has two halves, and neither writes anything shared:

| Half | Mechanism | Why it is parallel-safe |
|---|---|---|
| **Commit author** | `includeIf "hasconfig:remote.*.url:…"` in `~/.gitconfig` | Git reads it per repo, at commit time. Nothing is written. |
| **Push / API auth** | `GH_TOKEN` exported per shell, resolved by this tool | An env var lives inside one process. Invisible to every other. |

## Routing key: the remote, not the path

Paths move. Worktree pools live in `~/kb-scratch/workspaces/…`, `wt` clones live elsewhere, and the old path-only rule in `.zshrc` matched neither — so those shells unset `GH_TOKEN` and fell through to the global file. A git remote does not move. It is the only stable key.

| Remote owner | gh login | Commit identity |
|---|---|---|
| `ZluriHQ` / `Zluri` | `kushal-zluri` | Kushal Bakliwal `<kushal.b@zluri.com>` |
| `akshat-git-jpg` | `akshat-git-jpg` | akshat-git-jpg `<akshatparty17@gmail.com>` |
| `koala25` | `koala25` | Kushal Bakliwal `<kushalbakliwal25@gmail.com>` |

Path rules survive only as a fallback for a directory with no remote yet (a fresh `git init`). An unresolvable directory exits `2` and says so — it never guesses.

## Usage

```bash
gh-acct                       # gh login for $PWD
gh-acct who   -C <dir>
gh-acct email -C <dir>        # commit email for that account
gh-acct name  -C <dir>
gh-acct token -C <dir>        # that account's stored gh token
eval "$(gh-acct export)"      # pin GH_TOKEN for this shell only
gh-acct check -C <dir>        # git user.email matches the remote? exit 1 if not
```

Exit codes: `0` ok · `1` identity mismatch · `2` cannot resolve · `3` no stored token.

## Callers

- `~/.zshrc` → `_gh_auto_switch`, on every `cd`
- `tooling/boss/bin/boss-lib.sh` → `boss_assert_gh`
- `.claude/hooks/no-global-gh-switch.sh` → blocks the banned commands
- the `github-router` skill

## Rules this enforces

1. **Never `gh auth switch`.** Blocked by the hook. Use `eval "$(gh-acct export)"`.
2. **Never `git config --global user.email`.** Blocked by the hook. `~/.gitconfig` routes by remote already.
3. A repo whose remote is unknown gets a question, not a guess.

## If a push 403s

`gh-acct check` first, then `gh-acct who`. A `403` almost always means `GH_TOKEN` was unset and the call fell through to the global account. Fix: `eval "$(gh-acct export)"`.

If the account has no stored token (exit `3`), log in once — this is interactive and cannot be done from a tool call:

```bash
gh auth login -h github.com -p https -w
```
