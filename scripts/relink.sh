#!/usr/bin/env bash
# Machine-local setup for this repo's skills. Run it after a fresh clone and after
# any change to what Codex should see.
#
# SKILLS ARE REPO-SCOPED. Claude Code reads `<repo>/.claude/skills/` automatically
# for whoever opens the repo, so there is nothing to link for Claude and nothing
# that depends on which account is logged in. That is the whole point: a session
# in this repo gets this repo's skills, on any account, on any machine.
# (2026-08-25 — replaced the per-account manifest+symlink scheme; see decisions.md.)
#
# What still needs a machine-local step:
#   1. Codex has NO per-repo skill path. It reads only $CODEX_HOME/skills, which is
#      global. `.claude/codex-skills.txt` lists the few skills worth paying for in
#      every Codex session; mirror-codex-skills.sh symlinks exactly those.
#   2. The push gate is a copy that must live outside every working tree.
#   3. Every Claude memory store for this repo points at one canonical directory.
#   4. Five person-level skills are duplicated into the private work-skills plugin.
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPTS_DIR/.." && pwd)"
status=0

# Refuse to publish over-cap descriptions. Every skill now lives in .claude/skills,
# so this one guard covers the lot (COST-01).
if [[ "${SKIP_DESC_GUARD:-}" != "1" ]]; then
  "$REPO_ROOT/.claude/skills/personal-stuff-diagnostics-and-tooling/scripts/check-descriptions.sh" || {
    echo "relink aborted: a skill description exceeds the 700-char hard cap." >&2
    echo "Trim it (budget <=500) or rerun with SKIP_DESC_GUARD=1." >&2
    exit 1
  }
fi

# 1. Codex. Non-fatal: a broken mirror must not block the rest.
"$SCRIPTS_DIR/mirror-codex-skills.sh" || { echo "codex mirror had problems (non-fatal)" >&2; status=$?; }

# 2. Push gate + pre-push net. guard_install always returns 0.
source "$SCRIPTS_DIR/lib/guard-install.sh"
guard_install "$REPO_ROOT" || true

# --- ONE memory store for this repo, everywhere ------------------------------
# A memory store lives at <config dir>/projects/<cwd with / as ->/memory, keyed by
# the exact directory a session was launched in. So the same repo gets a SEPARATE
# store per account AND per subfolder AND per worktree:
#
#   ~/.claude-work/projects/-Users-kbtg-codebase-personal-stuff/            <- root
#   ~/.claude-work/projects/-Users-kbtg-codebase-personal-stuff-tooling-boss/
#   ~/.claude-personal/projects/-Users-kbtg-codebase-personal-stuff/
#   ~/.claude-work/projects/-Users-kbtg-kb-scratch-worktrees-...-personal-stuff/
#
# That is ~17 possible stores for one repo. Nothing syncs them: by 2026-08-24 the
# two account-level stores had already drifted to 22 files vs 8, with the personal
# side still describing the `captain` orchestrator deleted the day before. A boss
# session in tooling/boss/ writing a lesson is the same failure along another axis.
#
# So every store for this repo is symlinked to ONE canonical directory - the work
# account's root store. Drift stops being something to fix and becomes impossible.
#
# Dual-account machines only: a bare `claude` reads ~/.claude and has one store.
# Only directories that already exist are linked, so a brand-new worktree gets its
# own store until the next relink. Worktrees are short-lived and reaped, so that is
# accepted rather than solved.
link_shared_memory() {
  local main_root slug base canon acct proj name mem linked=0 refused=0

  # The slug is keyed off the MAIN checkout, not a pp-work workspace: `git worktree
  # list` puts the main worktree first, so this is right even when run from a lease.
  main_root="$(git -C "$REPO_ROOT" worktree list 2>/dev/null | head -1 | awk '{print $1}')"
  [[ -n "$main_root" ]] || main_root="$REPO_ROOT"
  slug="$(printf '%s' "$main_root" | sed 's|/|-|g')"
  base="$(basename "$main_root")"

  canon="${CLAUDE_WORK_CONFIG_DIR:-$HOME/.claude-work}/projects/$slug/memory"
  mkdir -p "$canon"

  for acct in "${CLAUDE_WORK_CONFIG_DIR:-$HOME/.claude-work}" \
              "${CLAUDE_PERSONAL_CONFIG_DIR:-$HOME/.claude-personal}"; do
    [[ -d "$acct/projects" ]] || continue

    for proj in "$acct"/projects/*; do
      [[ -d "$proj" ]] || continue
      name="$(basename "$proj")"

      # Does this project directory belong to this repo?
      case "$name" in
        "$slug")    : ;;   # the repo root itself
        "$slug"-*)  : ;;   # a subfolder of the repo (tooling-boss, apps-gym-app, ...)
        *-"$base")  : ;;   # another checkout of the same repo (wt slot, pp-work lease)
        *) continue ;;
      esac

      mem="$proj/memory"

      # The canonical store must never be linked to itself.
      [[ -d "$mem" && "$mem" -ef "$canon" ]] && continue

      if [[ -L "$mem" ]]; then
        [[ "$(readlink "$mem")" == "$canon" ]] && continue
        rm "$mem"
      elif [[ -d "$mem" ]]; then
        # A real directory with memories in it is somebody's work. Never clobber it.
        if [[ -n "$(ls -A "$mem")" ]]; then
          echo "memory: $mem is a non-empty real directory." >&2
          echo "        Merge its files into $canon, then rerun." >&2
          refused=1
          continue
        fi
        rmdir "$mem"
      fi

      ln -s "$canon" "$mem"
      linked=$((linked + 1))
    done
  done

  if [[ "$linked" -gt 0 ]]; then
    echo "memory: linked $linked store(s) -> $canon"
  else
    echo "memory: all stores already point at $canon"
  fi
  return "$refused"
}

if [[ -n "${CLAUDE_WORK_CONFIG_DIR:-}${CLAUDE_PERSONAL_CONFIG_DIR:-}" ]] \
   || [[ -d "$HOME/.claude-work" && -d "$HOME/.claude-personal" ]]; then
  link_shared_memory || status=$?
fi

# 4. Keep the private work-skills plugin in step with this repo's shared skills.
"$SCRIPTS_DIR/sync-shared-skills.sh" --check || {
  echo "shared skills differ from the work-skills plugin — run scripts/sync-shared-skills.sh" >&2
}

echo "done. Skills load from .claude/skills for any account; restart running sessions."
exit "$status"
