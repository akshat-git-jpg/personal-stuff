#!/usr/bin/env bash
# Sourced by scripts/relink.sh and scripts/vps-sync.sh. Installs the push gate and
# arms the git hook, on the Mac and on the VPS alike.
#
# It must never abort its caller: both callers run `set -euo pipefail`, and
# `git config --unset` exits 5 when the key is already absent — an unguarded unset
# would silently stop the VPS skill relink on its 15-minute cron from the second run
# onward. So every path here returns 0.

# Portable sha256. macOS ships `shasum` (a perl script); Git Bash on Windows ships
# `sha256sum` (coreutils) and often NOT `shasum`. Both print `<hex>  <name>`, and both
# hash stdin when given no file argument, so one wrapper covers every call site here.
_sha256() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$@"
  elif command -v sha256sum >/dev/null 2>&1; then sha256sum "$@"
  else echo "no sha256 tool on PATH (need shasum or sha256sum)" >&2; return 1; fi
}

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
    _sha256 "$libexec/pp-push" > "$libexec/pp-push.sha256"
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

  # The lander's trigger. Its SILENCE is a requirement, not a style choice: this runs on
  # every commit the owner makes, so any echo here costs tokens in the session transcript
  # forever. It also launches detached, because a land takes minutes and a commit must
  # never block on one.
  cat > "$hooks/post-commit" <<'HOOK'
#!/usr/bin/env bash
# Fires the lander when a WORKSPACE commit lands. Writes nothing to STDOUT: this runs on
# every commit, and any output would enter the session transcript each time. It does append
# to the workspace's own land.log, which no session reads.
set -uo pipefail
{
  gd=$(git rev-parse --path-format=absolute --git-dir 2>/dev/null) || exit 0
  gcd=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
  # A LINKED worktree only. This is what stops boss's own main-checkout bookkeeping
  # commits (boss-merge.sh, boss-commit-main.sh) from each spawning a full
  # verify-and-push cycle, invisibly.
  [ "$gd" != "$gcd" ] || exit 0
  top=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
  slugdir=$(dirname "$top")
  [ -f "$slugdir/manifest" ] || exit 0                 # a pp-work workspace
  br=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
  # A branch outside work/*|subject/* never lands. This used to `exit 0` in SILENCE, which
  # made it a silent-loss path: measured 2026-08-23, the `script-desk-plans` workspace sat
  # on `boss/235-…` with one commit that no land.log even mentioned, while `reap` refused
  # the workspace forever as unmerged. Record the skip where `pp-work list` can find it.
  case "$br" in
    subject/*|work/*) ;;
    *)
      printf '[%s] post-commit: NOT LANDED — HEAD is %s, outside work/*|subject/*. No lander will carry this commit.\n' \
        "$(date +'%Y-%m-%d %H:%M:%S')" "$br" >> "$slugdir/land.log"
      exit 0 ;;
  esac
  LAND="$(dirname "$gcd")/tooling/cli/pp-land/pp-land"
  [ -x "$LAND" ] || exit 0
  nohup "$LAND" "$top" >>"$slugdir/land.log" 2>&1 &
} >/dev/null 2>&1
exit 0
HOOK
  chmod +x "$hooks/post-commit"
  echo "guard: armed post-commit at $hooks/post-commit"

  # The other half of the wall. `.claude/hooks/no-history-in-main.sh` is a PreToolUse hook,
  # so it only ever sees commands Claude runs — a human typing `git commit` in the main
  # checkout walks straight past it. This git hook closes that half, and git enforces it
  # regardless of who or what invoked the commit.
  #
  # It lives in the SHARED .git/hooks, so it fires from the main checkout and from every
  # linked worktree; the linked-worktree test below is what makes it a no-op in workspaces,
  # which are the sanctioned place to record history. `--no-verify` bypasses it, which is the
  # deliberate escape hatch and the analogue of GUARD_OK=1.
  cat > "$hooks/pre-commit" <<'PRECOMMIT'
#!/usr/bin/env bash
# Refuses a commit in the MAIN checkout of this repo. Silent in linked worktrees.
set -uo pipefail
read -r GD GCD < <(git rev-parse --path-format=absolute --git-dir --git-common-dir 2>/dev/null | tr '\n' ' ')
[ -n "${GD:-}" ] && [ -n "${GCD:-}" ] || exit 0
[ "$GD" = "$GCD" ] || exit 0            # a linked worktree — allowed, that is the whole point
MAIN_TOP="$(dirname "$GCD")"
[ -f "$MAIN_TOP/.claude/hooks/no-history-in-main.sh" ] || exit 0   # not the repo that ships the wall
cat >&2 <<MSG
BLOCKED: recording git history in the main checkout.

Two sessions share this working tree, so a commit here can capture another session's
uncommitted edits.

Do this instead:
  cd "\$(pp-work claim --kind code --slug <short-task-name>)"
and commit there. It lands on main by itself.

Deliberate one-off: git commit --no-verify
MSG
exit 1
PRECOMMIT
  chmod +x "$hooks/pre-commit"
  echo "guard: armed pre-commit at $hooks/pre-commit"
  return 0
}
