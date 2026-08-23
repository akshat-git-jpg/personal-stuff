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

`gh auth status` shows three keyring accounts — `kushal-zluri` (active), `akshat-git-jpg`, and `koala25`. Since `akshat-git-jpg` is already in the keyring, `boss_assert_gh`'s own `gh auth switch --hostname github.com --user akshat-git-jpg` fallback can authenticate boss without any env var. 

Trade-off: `gh auth switch` changes the **global** active account, so a Zluri work session in another terminal would find `gh` acting as the personal account. That is why the env var exists, and it is why Step 1's .gitignore fix — not deletion — is the actual security fix.

## Scopes to recreate

`delete_repo`, `gist`, `read:org`, `repo`, `workflow`

## Verification after rotating

1. `gh api user -q .login` prints `akshat-git-jpg`
2. `bash tooling/boss/test-boss.sh` still passes
3. `gh pr list --limit 1` works

## Open Decision

37 rendered media files are tracked under `pipelines/archive/hyperframes-vs+remotion/yt-visuals/cutaways/`. Untracking them reclaims no space without a history rewrite. Left for the owner to decide later.
