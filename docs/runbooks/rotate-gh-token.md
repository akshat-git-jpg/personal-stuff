# Rotate GitHub Token

## Why

.claude/settings.local.json held a live `gho_… token in a directory inside a public repo, protected only by a machine-local exclude file. Treat it as exposed and rotate it, even though `git ls-files` confirms it was never committed.

## The Safe Order

1. Create the replacement token first.
2. Put it in place.
3. Verify `gh` authenticates correctly.
4. Revoke the old token.

Never revoke first — `boss_assert_gh` refuses to run without a working `akshat-git-jpg` login.

## Why removing it outright is not safe

Verified, `gh` currently authenticates as `akshat-git-jpg` via GH_TOKEN; with that variable unset, `gh`'s active keyring account is `kushal-zluri` — the Zluri work account — which `boss_assert_gh` rejects. So the variable must be replaced, not merely deleted.

## The fallback that already exists

`gh auth status` shows three keyring accounts — `kushal-zluri`, `akshat-git-jpg` and `koala25`. Since `akshat-git-jpg` is in the keyring, `gh-acct` mints a `GH_TOKEN` for it on demand, so no token needs storing in a file at all:

```
eval "$(gh-acct export)"
```

`boss_assert_gh` does exactly this. **Do not reach for `gh auth switch`** — since 2026-09-18 it is banned and hook-blocked. It rewrites the global `~/.config/gh/hosts.yml` that every concurrent shell and Claude session reads, so a Zluri work session in another terminal would silently start acting as the personal account. `GH_TOKEN` is process-local and has no such reach. Step 1's .gitignore fix — not deletion — remains the actual security fix.

## Scopes to recreate

`delete_repo`, `gist`, `read:org`, `repo`, `workflow`

## Verification after rotating

1. `gh api user -q .login` prints `akshat-git-jpg`
2. `bash tooling/boss/test-boss.sh` still passes
3. `gh pr list --limit 1` works

## Open Decision

37 rendered media files are tracked under `pipelines/archive/hyperframes-vs+remotion/yt-visuals/cutaways/`. Untracking them reclaims no space without a history rewrite. Left for the owner to decide later.
