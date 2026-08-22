<!-- boss frontmatter -->
---
executor: claude-p
model: opus
test_cmd: bash tooling/cli/pp-push/test-pp-push.sh
ui:
deploy:
needs: []
needs_prs: [223]
touches: [tooling/cli/pp-push/pp-push, tooling/cli/pp-push/test-pp-push.sh, scripts/lib/guard-install.sh, scripts/relink.sh, scripts/vps-sync.sh, tooling/cli/greenlight/greenlight, tooling/boss/bin/boss-commit-main.sh, tooling/boss/bin/boss-merge.sh, INFRA.md]

mutation_apply: |
  python3 - <<'PY'
  p='tooling/cli/pp-push/pp-push'
  s=open(p).read()
  needle='PPPUSH-SECRET'
  assert needle in s, 'mutation target not found — the secret gate is missing or was reworded'
  # Reintroduce the real defect: the secret gate matches nothing, so a .env sails through
  # to a PUBLIC repo. The gate still "exists" — this is the silent-no-op failure class.
  s=s.replace('SECRET_GLOBS=(', 'SECRET_GLOBS=( "__never_matches_anything__" #', 1)
  open(p,'w').write(s)
  PY
mutation_command: bash tooling/cli/pp-push/test-pp-push.sh
mutation_expect: "FAIL: pp-push PUSHED a commit containing a secret-shaped file"
mutation_cwd:
mutation_timeout: 600
---

# Plan 225: `pp-push` — one chokepoint every push to this repo passes through

## Summary

- **Problem statement**: This repo is **PUBLIC**, `main` has **no branch protection**, and three
  separate places push to it with no gate of any kind: `greenlight:389`
  (`git push origin HEAD:main` — the real lander), `boss-commit-main.sh:46-48`
  (`git add -A` then `git push origin HEAD` on main, with two logged misfires including ~200 MB of
  media), and `boss-merge.sh:155` (`git add plans/README.md && git commit && git push origin
  main`, which also sits **outside** the lock `boss-merge.sh` takes for its verify). So nothing
  stops a secret or a large generated file reaching a world-readable repo, and two writers to
  `main` can race.
- **Goals**:
  - One script, `pp-push`, is the only way anything in this repo pushes. It refuses a push whose
    commits contain a secret-shaped path or an oversized file, and it holds a lock so two
    landings cannot race.
  - It is installed as a **copy** outside every working tree, so no branch can edit or delete
    the guard, and it refuses to run from inside a working tree.
  - `scripts/lib/guard-install.sh` installs it — sourced by **both** `relink.sh` and
    `vps-sync.sh`, so the Mac and the VPS both get it.
  - `core.hooksPath` is **unset** (it currently points at a path containing a space, so **no git
    hook in this repo has ever run**) and a `pre-push` dispatcher is installed in the shared
    `.git/hooks`, which fires from the main worktree and from every linked worktree.
- **Executor proposed**: `claude-p` / `opus`. `tooling/boss/data/rules.md` routes
  *security-sensitive* here, and this is the gate protecting a public repo; it also carries its own
  lock. The owner approved opus where the rules require it.
- **Done criteria** (terse — full list below): `bash tooling/cli/pp-push/test-pp-push.sh` passes;
  no bare `git push` remains in the three converted files; the mutation recipe fails with the
  expected marker.
- **Stop conditions** (terse — full list below): the executor is about to push anything to the
  real `origin`; `core.hooksPath` is set to a value rather than unset; a real secret is read,
  printed or committed.
- **Test / verification for success**: a new `tooling/cli/pp-push/test-pp-push.sh` that builds a
  throwaway repo **with a local bare remote** and performs real pushes against it. Every
  assertion is behavioural — a push that actually succeeds or actually fails — never a grep of
  `pp-push`'s own source.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If anything in the "STOP conditions" section
> occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 69042eb1..HEAD -- tooling/cli/greenlight/ tooling/boss/bin/ scripts/`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH — every push in the repo routes through new code. A bug here blocks all landing.
- **Depends on**: PR for plan 223 (it makes `test-boss.sh` green, which this plan's changes to
  `boss-commit-main.sh` and `boss-merge.sh` need as a regression net).
- **Category**: security
- **Difficulty**: tricky
- **Planned at**: commit `69042eb1`, 2026-08-23

## Why this matters

Three facts, each verified, that only matter together:

1. `gh repo view --json visibility` returns `PUBLIC`.
2. `gh api repos/:owner/:repo/branches/main/protection` returns `404 Branch not protected`.
3. `.gitignore` drifts. Lines 66-67 point at `pipelines/hyperframes-vs-remotion/...` while the
   real tree is under `pipelines/archive/`, so that rule matched nothing and **37 rendered media
   files are already tracked**. `boss-commit-main.sh`'s `git add -A` has misfired twice on exactly
   this class — once staging ~200 MB of `.mp4`/`.mov` when a glob missed a renamed directory, once
   sweeping a concurrent session's 29-file app deletion into an unrelated commit.

So the ignore surface cannot be trusted as the last line of defence before a world-readable
publish, and there is no second line today. `pp-push` is that second line.

The lock matters for a different reason: `boss-merge.sh` takes a lock around its verify but its
own registry push at line 155 sits outside it, so "landings are serialised" was never true.

## Current state

### The three pushers

`tooling/cli/greenlight/greenlight:389` — inside the land retry loop:

```bash
  if git -C "$WT_PATH" push origin HEAD:main >&2; then
    landed=1; break
  fi
```

`tooling/boss/bin/boss-commit-main.sh:46-48`:

```bash
git -C "$REPO_ROOT" add -A
git -C "$REPO_ROOT" commit -q -m "$msg"
if git -C "$REPO_ROOT" push -q origin HEAD 2>&1; then
```

`tooling/boss/bin/boss-merge.sh:155`:

```bash
  ( cd "$REPO_ROOT" && git add plans/README.md && git commit -q -m "boss: record $slug (PR#$pr) landed" && git push -q origin main )
```

### The hook situation

`.git/config` currently contains:

```
core.hooksPath = /Users/kbtg/codebase/personal stuff/.git/hooks
```

A **space** where the hyphen belongs. `test -d` on that path fails, so **no git hook in this
repository has ever run**; `.git/hooks/` holds only `*.sample` files.

Two facts settle how to fix it, both measured:
- `git config --unset core.hooksPath` exits **5** when the key is absent, and both `relink.sh:23`
  and `vps-sync.sh:16` use `set -euo pipefail` — so an unguarded unset would abort the caller on
  every run after the first, silently stopping the VPS skill relink on its 15-minute cron.
- With `core.hooksPath` **unset**, a hook in the shared `.git/hooks` fires from the main worktree
  **and** from a linked worktree. Verified in a scratch repo with a real push from both.
  `core.hooksPath` itself lives in `.git/config`, which is per-clone and untracked, so a tracked
  `.githooks/` directory would carry the *scripts* but never the *pointer* — a fresh clone reports
  it empty. Unsetting is therefore both the fix and the simpler mechanism.

Also verified: no tracked `package.json` has a `prepare`/`postinstall` script or a
`husky`/`simple-git-hooks` dependency, so nothing re-points `core.hooksPath` after it is unset.

### The install location

`scripts/link-clis.sh` installs managed CLIs as **symlinks in `~/.local/bin` whose targets are
inside the checkout** — confirmed on disk:
`~/.local/bin/wt -> /Users/kbtg/codebase/personal-stuff/tooling/cli/wt/wt`. `pp-push` must **not**
follow that convention: a symlink into the tree makes the gate editable by the branches it guards,
and makes it vanish on a checkout of any commit predating it. So it is installed as a **copy** to
`~/.local/libexec/pp-push`. That directory does not exist yet (verified) and `$HOME` is not inside
a git working tree (verified), so the self-location test below cannot misfire.

### The bootstrap seam

`scripts/vps-sync.sh` **never** calls `relink.sh` or `link-clis.sh` and never touches
`core.hooksPath` — it pulls, sources `scripts/lib/skill-link.sh`, calls `sync_skills_dir`, exits.
`scripts/lib/` exists and holds exactly `skill-link.sh`. That is the seam: a new
`scripts/lib/guard-install.sh` sourced by both.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| The gate | `bash tooling/cli/pp-push/test-pp-push.sh` | prints `ALL TESTS PASSED`, exit 0 |
| Syntax-check | `bash -n tooling/cli/pp-push/pp-push` | no output, exit 0 |
| Regression net for the boss edits | `bash tooling/boss/test-boss.sh` | all pass, exit 0 (needs plan 223) |
| Confirm the unset exit code | `git config --unset core.nonexistentkey; echo $?` | `5` |
| Confirm no bare push remains | see Done criteria | `0` |

## Scope

**In scope**:
- `tooling/cli/pp-push/pp-push` — new, the gate
- `tooling/cli/pp-push/test-pp-push.sh` — new, the harness
- `scripts/lib/guard-install.sh` — new, the installer
- `scripts/relink.sh`, `scripts/vps-sync.sh` — one sourcing line and one call each
- `tooling/cli/greenlight/greenlight` — line 389 only
- `tooling/boss/bin/boss-commit-main.sh` — lines 46-48 only
- `tooling/boss/bin/boss-merge.sh` — line 155 only
- `INFRA.md` — one short subsection

**Out of scope** — looks related, do not touch:
- **`scripts/link-clis.sh`.** Do not add `pp-push` to it. Its symlink-into-the-checkout model is
  exactly what this plan avoids.
- **Any `.githooks/` directory.** Do not create one. The pointer does not travel; unsetting is
  the fix.
- `boss_chrome_lock_*` — plan 223 owns it. `pp-push` takes its **own** lock, never boss's Chrome
  lock; they protect different things (browser contention vs. concurrent pushes).
- `wt` and `greenlight`'s worktree acquisition — later plans.
- The 37 tracked media files, and `.gitignore` — plan 224.

## Git workflow

- Branch: `advisor/225-pp-push-the-one-push-chokepoint`
- Commit per step, message style `feat(pp-push): <what>` — no AI footers. Do **NOT** push.

## Steps

### Step 1: Write `pp-push`

Create `tooling/cli/pp-push/pp-push` with **exactly** this content, then `chmod +x`.

```bash
#!/usr/bin/env bash
# pp-push — the ONE chokepoint every push to this repo passes through.
#
# Why it exists: the repo is PUBLIC, main has no branch protection, and .gitignore
# drifts (a rule pointing at a moved directory matched nothing for months and 37
# rendered files are already tracked). boss-commit-main.sh's `git add -A` misfired
# twice on that class. So the ignore surface is not a sufficient last line of defence
# before a world-readable publish.
#
# Why it lives outside the working tree: installed as a COPY to ~/.local/libexec, so
# no branch can edit the guard and no checkout of an older commit can make it vanish.
#
# Usage: pp-push --repo <worktree> <remote> <refspec> [git-push-args...]
set -euo pipefail

PPPUSH_SIZE_CAP=$((1024 * 1024))   # 1 MB per path

# Paths that must never reach a public repo. Extend this list, never narrow it.
SECRET_GLOBS=(
  '*.env' '.env' '.env.*'
  '*.local.json'
  'credentials.json' 'token.json' 'client_secret*.json'
  '*.pem' '*.key' '*.p12' '*.keystore'
  '.dev.vars' '.dev.vars.*'
  '*.gpg'
)

die() { echo "pp-push: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Self-checks. Each answers "is the guard really the guard?", and each FAILS
# CLOSED — a gate that cannot verify itself must not wave a push through.
# ---------------------------------------------------------------------------
self=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# (1) Never run from inside a git working tree.
if git -C "$self" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  die "refusing to run from inside a git working tree ($self).
  The tracked copy is a SOURCE, not the gate. Install it with scripts/lib/guard-install.sh,
  which copies it to ~/.local/libexec/pp-push."
fi

# (2) Self-integrity against the checksum recorded AT INSTALL TIME, in a sibling
#     file. Deliberately NOT a comparison against the repo: which content that would
#     be depends on the checked-out commit, so a branch that legitimately edits
#     pp-push (or an older branch) would refuse every push, including the custody
#     push. Divergence from the repo is a staleness warning, not a refusal.
sum_file="$self/pp-push.sha256"
if [ -f "$sum_file" ]; then
  want=$(cut -d' ' -f1 < "$sum_file")
  have=$(shasum -a 256 "${BASH_SOURCE[0]}" | cut -d' ' -f1)
  [ "$want" = "$have" ] || die "installed copy does not match its recorded checksum.
  Re-run scripts/lib/guard-install.sh. Refusing to push with an unverified gate."
else
  die "no recorded checksum beside the installed copy ($sum_file).
  Re-run scripts/lib/guard-install.sh."
fi

# (3) The pre-push dispatcher must be armed — it is the second, independent net that
#     catches a push made by hand or by a tool that does not call pp-push.
REPO=""; args=()
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    *) args+=("$1"); shift ;;
  esac
done
[ -n "$REPO" ] || die "usage: pp-push --repo <worktree> <remote> <refspec> [args...]"
[ "${#args[@]}" -ge 2 ] || die "usage: pp-push --repo <worktree> <remote> <refspec> [args...]"

common=$(git -C "$REPO" rev-parse --path-format=absolute --git-common-dir)
hook="$common/hooks/pre-push"
[ -x "$hook" ] || die "the pre-push dispatcher is not armed at $hook.
  Re-run scripts/lib/guard-install.sh. Refusing to push without the second net."
[ -z "$(git -C "$REPO" config --get core.hooksPath || true)" ] \
  || die "core.hooksPath is set; the shared .git/hooks dispatcher would be bypassed.
  Re-run scripts/lib/guard-install.sh, which unsets it."

remote="${args[0]}"; refspec="${args[1]}"

# ---------------------------------------------------------------------------
# What is being published. `local_ref:remote_ref`, or a bare ref meaning both.
# ---------------------------------------------------------------------------
case "$refspec" in
  *:*) local_ref="${refspec%%:*}"; remote_ref="${refspec##*:}" ;;
  *)   local_ref="$refspec";       remote_ref="$refspec" ;;
esac

# Base for the diff: the remote-tracking ref if we have one, else origin's default
# branch. A missing base would otherwise mean diffing against nothing and inspecting
# the entire tree.
base="refs/remotes/$remote/${remote_ref#refs/heads/}"
if ! git -C "$REPO" rev-parse --verify --quiet "$base" >/dev/null; then
  base="refs/remotes/$remote/main"
fi
git -C "$REPO" rev-parse --verify --quiet "$base" >/dev/null \
  || die "cannot resolve a base ref to diff against ($base). Refusing to push blind."

mapfile -t changed < <(git -C "$REPO" diff --name-only "$base".."$local_ref" 2>/dev/null || true)

# ---------------------------------------------------------------------------
# The gate.
# ---------------------------------------------------------------------------
for path in "${changed[@]:-}"; do
  [ -n "$path" ] || continue
  base_name=$(basename "$path")
  for g in "${SECRET_GLOBS[@]}"; do
    # shellcheck disable=SC2053
    if [[ "$base_name" == $g ]]; then
      die "PPPUSH-SECRET refusing to push: '$path' matches the secret pattern '$g'.
  This repo is PUBLIC and main has no branch protection, so a push here is irreversible.
  Remove it from the commit range ${base}..${local_ref} and try again."
    fi
  done
  size=$(git -C "$REPO" cat-file -s "$local_ref:$path" 2>/dev/null || echo 0)
  if [ "$size" -gt "$PPPUSH_SIZE_CAP" ]; then
    die "PPPUSH-SIZE refusing to push: '$path' is $size bytes, over the ${PPPUSH_SIZE_CAP}-byte cap.
  Generated media is rebuildable and must not enter a public repo. If this file genuinely
  belongs in git, raise PPPUSH_SIZE_CAP deliberately in pp-push, not per-push."
  fi
done

# ---------------------------------------------------------------------------
# Serialise. Its OWN lock, never boss's Chrome lock (that one guards browser
# contention, a different concern). Reentrancy-safe: a nested pp-push — including
# one reached via the pre-push dispatcher this very push triggers — must not
# deadlock against its own ancestor.
# ---------------------------------------------------------------------------
LOCK_DIR="${PPPUSH_LOCK_DIR:-$HOME/.local/state/pp-push}"
LOCK="$LOCK_DIR/push.lock"
held=0
if [ "${PPPUSH_LOCK_HELD:-}" != "$$" ] && [ -z "${PPPUSH_LOCK_HELD:-}" ]; then
  mkdir -p "$LOCK_DIR"
  waited=0; max=$((300 * 5))
  while ! mkdir "$LOCK" 2>/dev/null; do
    owner=$(cat "$LOCK/pid" 2>/dev/null || echo "")
    if [ -n "$owner" ] && ! kill -0 "$owner" 2>/dev/null; then
      echo "pp-push: breaking stale push lock (holder pid $owner is gone)" >&2
      rm -rf "$LOCK"; continue
    fi
    if [ -z "$owner" ]; then
      now=$(date +%s); mt=$(stat -f %m "$LOCK" 2>/dev/null || echo "$now")
      if [ $((now - mt)) -ge 300 ]; then
        echo "pp-push: breaking stale push lock (no pid, 300s+ old)" >&2
        rm -rf "$LOCK"; continue
      fi
    fi
    [ "$waited" -ge "$max" ] && die "push lock held >300s by live pid ${owner:-unknown}. Not breaking it."
    sleep 0.2; waited=$((waited + 1))
  done
  printf '%s\n' "$$" > "$LOCK/pid"
  held=1
  export PPPUSH_LOCK_HELD="$$"
fi
release() { [ "$held" -eq 1 ] && rm -rf "$LOCK" 2>/dev/null || true; }
trap release EXIT

git -C "$REPO" push "${args[@]}"
```

**Verify**: `bash -n tooling/cli/pp-push/pp-push` -> no output, exit 0
**Verify**: `test -x tooling/cli/pp-push/pp-push` -> exit 0

**Deliberate simplification, recorded here so it is not mistaken for an omission.** The design
this plan implements also listed a third rule — refuse a path that is not already tracked and does
not match an allowlist of expected source extensions. It is **dropped**. Under this system's
no-notifications rule a false refusal becomes a land that silently never arrives, and an
extension allowlist produces false refusals constantly (every new file type, every generated
artifact with an unusual suffix). The secret-pattern and size rules catch the irreversible cases;
an allowlist would mostly catch legitimate work.

Commit: `feat(pp-push): the one push chokepoint`

### Step 2: Write the installer

Create `scripts/lib/guard-install.sh` with **exactly** this content. It is *sourced*, so it must
define a function and must not run anything at source time, and **every function must return 0** —
both callers use `set -euo pipefail`.

```bash
#!/usr/bin/env bash
# Sourced by scripts/relink.sh and scripts/vps-sync.sh. Installs the push gate and
# arms the git hook, on the Mac and on the VPS alike.
#
# It must never abort its caller: both callers run `set -euo pipefail`, and
# `git config --unset` exits 5 when the key is already absent — an unguarded unset
# would silently stop the VPS skill relink on its 15-minute cron from the second run
# onward. So every path here returns 0.

guard_install() {
  local repo="${1:-}"
  [ -n "$repo" ] || { echo "guard_install: no repo path given" >&2; return 0; }
  git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0

  local libexec="$HOME/.local/libexec"
  local src="$repo/tooling/cli/pp-push/pp-push"
  mkdir -p "$libexec" || return 0

  # A COPY, never a symlink into the checkout: a symlinked gate is editable by the
  # branches it guards and vanishes on a checkout of an older commit.
  if [ -f "$src" ]; then
    cp -f "$src" "$libexec/pp-push" && chmod +x "$libexec/pp-push"
    shasum -a 256 "$libexec/pp-push" > "$libexec/pp-push.sha256"
    echo "guard: installed pp-push -> $libexec/pp-push"
  else
    echo "guard: WARNING $src missing; pp-push not installed" >&2
  fi

  # core.hooksPath is per-clone and untracked, so a tracked hooks dir would ship the
  # scripts but never the pointer. Unset it and use git's default lookup in the shared
  # .git/hooks, which fires from the main worktree AND from every linked worktree.
  # `|| true` is load-bearing: unset exits 5 when the key is absent.
  git -C "$repo" config --unset core.hooksPath 2>/dev/null || true

  local common hooks
  common=$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || return 0
  hooks="$common/hooks"
  mkdir -p "$hooks" || return 0

  cat > "$hooks/pre-push" <<'HOOK'
#!/usr/bin/env bash
# Second, independent net behind pp-push: catches a push made by hand or by a tool
# that does not call the gate. Untracked and in the SHARED .git/hooks, so it is
# present in every linked worktree regardless of which commit is checked out.
set -uo pipefail
GATE="$HOME/.local/libexec/pp-push"
[ -x "$GATE" ] || { echo "pre-push: $GATE missing — run scripts/relink.sh" >&2; exit 1; }
# pp-push itself sets PPPUSH_LOCK_HELD; if it is set, this push already came through
# the gate and re-running it would be a redundant round trip.
[ -n "${PPPUSH_LOCK_HELD:-}" ] && exit 0
echo "pre-push: this push did not go through pp-push. Refusing." >&2
echo "  Use: pp-push --repo <worktree> <remote> <refspec>" >&2
exit 1
HOOK
  chmod +x "$hooks/pre-push"
  echo "guard: armed pre-push at $hooks/pre-push"
  return 0
}
```

Then wire both callers.

In `scripts/relink.sh`, immediately before its final `echo "done. Restart any running ..."` line:

```bash
source "$SCRIPTS_DIR/lib/guard-install.sh"
guard_install "$REPO_ROOT" || true
```

Read the top of `relink.sh` first and use whatever it already calls the scripts directory and repo
root; if it has no such variables, derive them the same way `vps-sync.sh` does
(`SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"`).

In `scripts/vps-sync.sh`, immediately after its existing
`source "$SCRIPTS_DIR/lib/skill-link.sh"` line:

```bash
source "$SCRIPTS_DIR/lib/guard-install.sh"
guard_install "$REPO" || true
```

`vps-sync.sh` already defines `SCRIPTS_DIR` and `REPO`.

**Verify**: `bash -n scripts/lib/guard-install.sh scripts/relink.sh scripts/vps-sync.sh` ->
no output, exit 0
**Verify**: sourcing is side-effect free —
`bash -c 'set -euo pipefail; source scripts/lib/guard-install.sh; echo sourced-ok'` ->
prints `sourced-ok`

Commit: `feat(guard): install pp-push and arm pre-push from both bootstraps`

### Step 3: Convert the three pushers

**greenlight** — replace line 389's push with:

```bash
  if pp-push --repo "$WT_PATH" origin HEAD:main >&2; then
```

`pp-push` must be resolvable. greenlight already resolves `wt` via a `WT_BIN` variable; add the
same shape near it:

```bash
PP_PUSH_BIN="${PP_PUSH_BIN:-$HOME/.local/libexec/pp-push}"
```

and use `"$PP_PUSH_BIN"` rather than a bare `pp-push`, so the gate is found by absolute path and
cannot be shadowed by anything on `PATH`.

**boss-commit-main.sh** — this one needs a rule, not just a swap. Read lines 29-48 first. The
script has **no** explicit path list: `staged_preview` and `nfiles` are both derived from
`git add -A --dry-run`, so its staging set *is* `add -A`'s set. Replacing `add -A` with those same
paths would be cosmetic.

The real defect is blast radius. This script exists only to unblock a land by committing dirty
main, and boss's own dirt is always small — but on 2026-08-20 it swept a concurrent session's
29-file app deletion into a commit labelled "record PR#210 landed", **64 files total**. So the fix
is a size refusal with an explicit opt-in. Replace lines 46-48 with **exactly** this:

```bash
# Blast-radius guard. boss's own dirty-main is a handful of paths; on 2026-08-20 this
# staged 64 files because a concurrent session's 29-file app deletion was in the tree,
# and committed it under an unrelated message. boss cannot attribute dirt, so it refuses
# a sweep this large instead of guessing. pp-push's size gate covers the other logged
# misfire (~200 MB of .mp4/.mov when an ignore glob missed a renamed directory).
BOSS_COMMIT_MAIN_MAX="${BOSS_COMMIT_MAIN_MAX:-10}"
if [ "$nfiles" -gt "$BOSS_COMMIT_MAIN_MAX" ] && [ "${BOSS_COMMIT_MAIN_FORCE:-0}" != "1" ]; then
  echo "REFUSING: $nfiles dirty path(s) on main is more than boss should ever sweep (max $BOSS_COMMIT_MAIN_MAX)." >&2
  echo "  This is almost certainly another session's work. Inspect it, then either commit it" >&2
  echo "  yourself or re-run with BOSS_COMMIT_MAIN_FORCE=1 if it really is all boss's." >&2
  boss_notify "boss: REFUSED to auto-commit $nfiles dirty paths on main (needs a human look)"
  exit 2
fi
git -C "$REPO_ROOT" add -A
git -C "$REPO_ROOT" commit -q -m "$msg"
if "$HOME/.local/libexec/pp-push" --repo "$REPO_ROOT" origin HEAD 2>&1; then
```

`add -A` is deliberately kept: the guard above it is what makes it safe, and narrowing the
staging set without narrowing the *decision* would leave the same commit with a tidier command.

**boss-merge.sh** — replace line 155's subshell with:

```bash
  ( cd "$REPO_ROOT" && git add plans/README.md && git commit -q -m "boss: record $slug (PR#$pr) landed" \
      && "$HOME/.local/libexec/pp-push" --repo "$REPO_ROOT" origin main )
```

**Verify**: `bash -n` passes on all three files
**Verify**: no bare push remains —
`grep -cE '(^|[^-])git (-C [^ ]+ )?push' tooling/cli/greenlight/greenlight tooling/boss/bin/boss-commit-main.sh tooling/boss/bin/boss-merge.sh`
-> `0` for each file
**Verify**: `bash tooling/boss/test-boss.sh` -> all pass, exit 0

Commit: `fix: route every push through pp-push`

### Step 4: Write the harness

Create `tooling/cli/pp-push/test-pp-push.sh`. It must build a throwaway repo **with a local bare
remote** in `mktemp -d`, install the gate into a temp `libexec`, and perform **real** pushes. It
must never touch the real `origin` or the real `~/.local/libexec`.

Required structure and tests:

```bash
#!/usr/bin/env bash
set -euo pipefail
fail() { echo "FAIL: $1" >&2; exit 1; }
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

BASE=$(mktemp -d); trap 'rm -rf "$BASE"' EXIT
export HOME="$BASE/home"           # sandbox libexec, lock dir and the hook's $HOME
mkdir -p "$HOME"
git init --bare -q "$BASE/origin.git"
git clone -q "$BASE/origin.git" "$BASE/wt"
cd "$BASE/wt"
git config user.email t@t; git config user.name t
echo hello > README.md; git add README.md; git commit -qm init
git push -q origin HEAD:main 2>/dev/null || true   # seed main BEFORE the hook is armed

# install the gate into the sandbox HOME
source "$REPO_ROOT/scripts/lib/guard-install.sh"
guard_install "$BASE/wt"
GATE="$HOME/.local/libexec/pp-push"
[ -x "$GATE" ] || fail "guard_install did not install pp-push"
[ -f "$HOME/.local/libexec/pp-push.sha256" ] || fail "guard_install did not record a checksum"
[ -x "$BASE/wt/.git/hooks/pre-push" ] || fail "guard_install did not arm pre-push"
[ -z "$(git -C "$BASE/wt" config --get core.hooksPath || true)" ] || fail "guard_install left core.hooksPath set"

# 1. a clean push SUCCEEDS through the gate
git fetch -q origin
echo a >> README.md; git add README.md; git commit -qm "clean change"
"$GATE" --repo "$BASE/wt" origin HEAD:main >/dev/null 2>&1 || fail "pp-push refused a CLEAN push"

# 2. a secret-shaped file is REFUSED
git fetch -q origin
printf 'TOKEN=abc\n' > .env; git add -f .env; git commit -qm "add env"
set +e; "$GATE" --repo "$BASE/wt" origin HEAD:main >/dev/null 2>&1; rc=$?; set -e
[ "$rc" -ne 0 ] || fail "pp-push PUSHED a commit containing a secret-shaped file"
git reset -q --hard HEAD~1

# 3. an oversized file is REFUSED
git fetch -q origin
mkdir -p big; head -c 2000000 /dev/zero | tr '\0' 'x' > big/blob.bin
git add big/blob.bin; git commit -qm "add big"
set +e; "$GATE" --repo "$BASE/wt" origin HEAD:main >/dev/null 2>&1; rc=$?; set -e
[ "$rc" -ne 0 ] || fail "pp-push PUSHED an oversized file"
git reset -q --hard HEAD~1

# 4. the gate refuses to run from INSIDE a working tree
cp "$GATE" "$BASE/wt/pp-push-copy"; chmod +x "$BASE/wt/pp-push-copy"
set +e; "$BASE/wt/pp-push-copy" --repo "$BASE/wt" origin HEAD:main >/dev/null 2>&1; rc=$?; set -e
[ "$rc" -ne 0 ] || fail "pp-push ran from inside a git working tree"
rm -f "$BASE/wt/pp-push-copy"

# 5. a tampered installed copy is REFUSED (self-integrity)
printf '\n# tampered\n' >> "$GATE"
set +e; "$GATE" --repo "$BASE/wt" origin HEAD:main >/dev/null 2>&1; rc=$?; set -e
[ "$rc" -ne 0 ] || fail "pp-push ran with a checksum mismatch"
guard_install "$BASE/wt"   # restore

# 6. the pre-push net refuses a BARE git push
git fetch -q origin
echo b >> README.md; git add README.md; git commit -qm "bare push attempt"
set +e; git -C "$BASE/wt" push -q origin HEAD:main >/dev/null 2>&1; rc=$?; set -e
[ "$rc" -ne 0 ] || fail "a bare git push bypassed the pre-push net"

# 7. and the same change DOES land through the gate
"$GATE" --repo "$BASE/wt" origin HEAD:main >/dev/null 2>&1 || fail "pp-push refused a clean push after the bare attempt"

echo "ALL TESTS PASSED"
```

Test 6 is the important one: it proves the second net is real, not decorative.

**Verify**: `bash tooling/cli/pp-push/test-pp-push.sh` -> `ALL TESTS PASSED`, exit 0

Commit: `test(pp-push): real pushes against a local bare remote`

### Step 5: Document it

Add a short subsection to `INFRA.md` recording: the repo is public with no branch protection;
every push goes through `pp-push`; it is installed as a copy at `~/.local/libexec/pp-push` by
`scripts/lib/guard-install.sh`, which both `relink.sh` and `vps-sync.sh` call; `core.hooksPath` is
deliberately **unset** and must stay unset; and the `pre-push` net lives in the shared
`.git/hooks`, untracked by design.

**Verify**: `grep -c 'pp-push' INFRA.md` -> at least `2`

Commit: `docs(infra): record the push chokepoint`

## Test plan

`bash tooling/cli/pp-push/test-pp-push.sh` builds a real repo with a real bare remote and performs
real pushes. Seven behavioural assertions: a clean push succeeds; a secret is refused; an
oversized file is refused; the gate refuses to run inside a working tree; a tampered copy is
refused; a bare `git push` is refused by the net; and the same change then lands through the gate.

`bash tooling/boss/test-boss.sh` is the regression net for the two boss edits — which is why this
plan depends on 223, the plan that makes that suite green.

No assertion greps `pp-push`'s source. The mutation proves why: neutering `SECRET_GLOBS` leaves the
gate present, well-named and completely inert — the silent-no-op class this whole series exists to
eliminate.

## Done criteria

- [ ] `bash tooling/cli/pp-push/test-pp-push.sh` prints `ALL TESTS PASSED`, exit 0.
- [ ] `test -x tooling/cli/pp-push/pp-push` and `test -f tooling/cli/pp-push/test-pp-push.sh`
      both exit 0 — the files exist, not merely specified (LESSONS 2026-08-17).
- [ ] `bash tooling/boss/test-boss.sh` passes.
- [ ] `bash -n` passes on `pp-push`, `test-pp-push.sh`, `guard-install.sh`, `relink.sh`,
      `vps-sync.sh`, `greenlight`, `boss-commit-main.sh`, `boss-merge.sh`.
- [ ] No bare push remains: for each of `tooling/cli/greenlight/greenlight`,
      `tooling/boss/bin/boss-commit-main.sh`, `tooling/boss/bin/boss-merge.sh`,
      `grep -cE '(^|[^-])git (-C [^ ]+ )?push' <file>` returns `0`.
- [ ] `grep -c 'BOSS_COMMIT_MAIN_MAX' tooling/boss/bin/boss-commit-main.sh` returns at least `2`
      (the default and the comparison) — the blast-radius guard is present.
- [ ] The guard actually refuses: with 11 dirty paths in a throwaway checkout,
      `boss-commit-main.sh` exits 2 and prints `REFUSING`. Cover this in
      `test-pp-push.sh` or note in your report that it was verified by hand.
- [ ] `grep -c 'guard_install' scripts/relink.sh` and `... scripts/vps-sync.sh` each return
      at least `1`.
- [ ] `bash -c 'set -euo pipefail; source scripts/lib/guard-install.sh; echo ok'` prints `ok` —
      sourcing cannot abort a caller.
- [ ] `grep -c 'pp-push' INFRA.md` returns 2 or more.
- [ ] The mutation recipe behaves as specified: clean passes; applying it makes the harness fail
      printing `FAIL: pp-push PUSHED a commit containing a secret-shaped file`; reverting passes.
- [ ] `git diff --stat` against the branch point touches only the nine files in `touches`.

## STOP conditions

- **You are about to push to the real `origin`.** STOP. Every test uses a `mktemp -d` bare remote.
  There is no step in this plan that pushes this repo.
- **You are about to run `guard_install` against the real checkout**, or write to the real
  `~/.local/libexec`. STOP — the harness sandboxes `$HOME`. Installing for real is the owner's
  action via `scripts/relink.sh`.
- **You are about to set `core.hooksPath` to a value.** STOP. It must be **unset**; the pointer is
  per-clone and does not travel, which is the whole reason for the shared-hooks approach.
- **You are about to create a `.githooks/` directory** or add `pp-push` to `scripts/link-clis.sh`.
  STOP — both reintroduce a tree-editable gate.
- **You are tempted to remove `boss-commit-main.sh`'s `add -A`** rather than guard it. STOP and
  re-read Step 3: the script has no path list to narrow to, so the guard on `$nfiles` is the fix.
  Narrowing the command without narrowing the decision produces the same bad commit.
- **A test fails and the tempting fix is to relax `SECRET_GLOBS` or raise the size cap.** STOP.
  Fix the test's fixture or the code; widening the gate to pass a test is a STOP.
- **You are about to read or print the contents of a real secret** — `.env`,
  `credentials.json`, `.claude/settings.local.json`, `.dev.vars`. STOP. The harness creates its
  own fake `.env`; never touch a real one.

## Maintenance notes

- `SECRET_GLOBS` is append-only in spirit. Narrowing it is how a leak happens; a new
  credential-shaped filename gets a line.
- `PPPUSH_SIZE_CAP` is deliberately per-installation, not per-push. If a file genuinely belongs in
  git and exceeds it, raise the constant in a reviewed change rather than adding a bypass flag —
  a bypass flag becomes the default.
- Three locks now exist with the same shape: `wt`'s pool lock, boss's Chrome lock, and
  `pp-push`'s push lock. They guard different things and must stay separate — conflating the push
  lock with boss's Chrome lock would deadlock, because `boss-merge.sh` already holds the Chrome
  lock across the greenlight run that performs the push.
- The `pre-push` net is intentionally strict: it refuses **any** push that did not come through
  `pp-push`. If that ever becomes too blunt for a legitimate manual push, the answer is to call
  `pp-push` rather than to weaken the net.
- A reviewer should scrutinise: the dropped third rule (untracked-extension allowlist), recorded
  in Step 1 with its reasoning; and whether `PPPUSH_LOCK_HELD` survives every path that could
  re-enter the gate.
