#!/usr/bin/env bash
# Recreate the per-account skill symlinks for both Claude accounts from the
# manifests. Idempotent — safe to run any time; run it after any membership
# change and as the first step on a new laptop after cloning.
#
# Lives in scripts/; the skill store is tooling/claude-skills/ (resolved relative
# to this script, so it survives a repo rename/move).
#
#   tooling/claude-skills/manifest/work.txt     -> ~/.claude-work/skills/
#   tooling/claude-skills/manifest/personal.txt -> ~/.claude-personal/skills/
#   .claude/skills/                             -> ~/.codex/skills/ (Codex view)
#   a name in both = shared; in one = exclusive to that account.
#
# It also points the PERSONAL account's memory store for this repo at the WORK
# account's, so both accounts share one store instead of drifting apart.
#
# Machines NOT running the Mac dual-account scheme (no ~/.claude-work or
# ~/.claude-personal, e.g. a bare `claude` launch on Windows/Linux) instead get
# personal.txt linked straight into the default ~/.claude/skills — see the
# "default" sync below. This is what keeps a machine like that from silently
# missing every store skill (decisions.md 2026-08-11).
#
# Each skill's SOURCE is auto-resolved: the repo store if present, else
# ~/.agents/skills (printing-press pp-* skills). The manifest is the source of
# truth — a managed symlink (pointing into the store or ~/.agents/skills) that
# is NOT in that account's manifest gets PRUNED. Anything else is left alone.
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPTS_DIR/lib/skill-link.sh"

STORE="$(cd "$SCRIPTS_DIR/../tooling/claude-skills" && pwd)"

# Refuse to propagate over-cap descriptions to both accounts (COST-01 guard).
if [[ "${SKIP_DESC_GUARD:-}" != "1" ]]; then
  "$SCRIPTS_DIR/check-skill-descriptions.sh" || {
    echo "relink aborted: a skill description exceeds the 700-char hard cap." >&2
    echo "Trim it (budget ≤500) or rerun with SKIP_DESC_GUARD=1." >&2
    exit 1
  }
  # Same budget for the repo-level skills in .claude/skills/ (they load into
  # every repo-root session even though relink doesn't manage them).
  "$SCRIPTS_DIR/../.claude/skills/personal-stuff-diagnostics-and-tooling/scripts/check-descriptions.sh" || {
    echo "relink aborted: a .claude/skills description exceeds the 700-char hard cap." >&2
    echo "Trim it (budget ≤500) or rerun with SKIP_DESC_GUARD=1." >&2
    exit 1
  }
fi
WORK_DIR="${CLAUDE_WORK_CONFIG_DIR:-$HOME/.claude-work}/skills"
PERS_DIR="${CLAUDE_PERSONAL_CONFIG_DIR:-$HOME/.claude-personal}/skills"
AGENTS_DIR="$HOME/.agents/skills"   # printing-press pp-* skills

# Snapshot BEFORE either sync runs — sync_skills_dir mkdir -p's its target
# dir as a side effect, so checking this after the work/personal syncs would
# always see the dirs it just created and never detect a non-dual-account
# machine correctly.
USING_DUAL_ACCOUNT=1
if [[ -z "${CLAUDE_WORK_CONFIG_DIR:-}" && -z "${CLAUDE_PERSONAL_CONFIG_DIR:-}" \
      && ! -d "$HOME/.claude-work" && ! -d "$HOME/.claude-personal" ]]; then
  USING_DUAL_ACCOUNT=0
fi

echo "store:  $STORE"
echo "agents: $AGENTS_DIR"
status=0

if [[ "$USING_DUAL_ACCOUNT" -eq 1 ]]; then
  sync_skills_dir work     "$WORK_DIR" "$STORE/manifest/work.txt"     "$STORE" "$AGENTS_DIR" || status=$?
  sync_skills_dir personal "$PERS_DIR" "$STORE/manifest/personal.txt" "$STORE" "$AGENTS_DIR" || status=$?
else
  # Fallback for a machine not using the dual-account scheme at all (e.g. a
  # bare `claude` launch on Windows/Linux, which reads plain ~/.claude): link
  # personal.txt's skills straight in there instead of creating unused
  # ~/.claude-work and ~/.claude-personal dirs this machine will never read.
  DEFAULT_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"
  sync_skills_dir default "$DEFAULT_DIR" "$STORE/manifest/personal.txt" "$STORE" "$AGENTS_DIR" || status=$?
fi

# Publish this repo's skills to Codex. Codex 0.149 reads ONLY $CODEX_HOME/skills
# (default ~/.codex/skills) — NOT .agents/skills, which is the plugin root and is
# read by nothing. Symlinks only, so there is one copy on disk (see AGENTS.md).
# Non-fatal: a broken mirror must not block the Claude-side relink.
"$SCRIPTS_DIR/mirror-codex-skills.sh" || { echo "codex mirror had problems (non-fatal)" >&2; status=$?; }

# Install the push gate (a copy outside every working tree) and arm the shared
# .git/hooks pre-push net. Sourced, so it must not abort us: guard_install always
# returns 0, and the `|| true` is belt-and-braces under `set -e`.
REPO_ROOT="$(cd "$SCRIPTS_DIR/.." && pwd)"
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

if [[ "$USING_DUAL_ACCOUNT" -eq 1 ]]; then
  link_shared_memory || status=$?
fi

echo "done. Restart any running claude-work / claude-personal / default session to pick up changes."
exit "$status"
