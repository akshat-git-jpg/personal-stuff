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

# --- one memory store for this repo, shared by both accounts -----------------
# A memory store's path is <config dir>/projects/<repo path with / as ->/memory,
# so two config dirs mean two stores for the same repo and nothing syncs them.
# By 2026-08-24 they had drifted into 22 files on work and 8 on personal, with
# the personal side still describing the deleted `captain` orchestrator. Pointing
# personal at work's directory makes drift impossible rather than merely fixed.
# Dual-account machines only: a bare `claude` reads ~/.claude and has one store.
link_shared_memory() {
  local main_root slug work_mem pers_proj pers_mem
  # The store is keyed by the SESSION's cwd, which is the main checkout - not a
  # pp-work workspace. `git worktree list` puts the main worktree first, so this
  # links the right slug even when relink is run from a leased workspace.
  main_root="$(git -C "$REPO_ROOT" worktree list 2>/dev/null | head -1 | awk '{print $1}')"
  [[ -n "$main_root" ]] || main_root="$REPO_ROOT"
  slug="$(printf '%s' "$main_root" | sed 's|/|-|g')"
  work_mem="${CLAUDE_WORK_CONFIG_DIR:-$HOME/.claude-work}/projects/$slug/memory"
  pers_proj="${CLAUDE_PERSONAL_CONFIG_DIR:-$HOME/.claude-personal}/projects/$slug"
  pers_mem="$pers_proj/memory"

  mkdir -p "$work_mem" "$pers_proj"

  if [[ -L "$pers_mem" ]]; then
    [[ "$(readlink "$pers_mem")" == "$work_mem" ]] && return 0
    rm "$pers_mem"
  elif [[ -d "$pers_mem" ]]; then
    # A real directory with memories in it is somebody's work. Never clobber it.
    if [[ -n "$(ls -A "$pers_mem")" ]]; then
      echo "memory: $pers_mem is a non-empty real directory." >&2
      echo "        Merge its files into $work_mem, then rerun." >&2
      return 1
    fi
    rmdir "$pers_mem"
  fi

  ln -s "$work_mem" "$pers_mem"
  echo "memory: personal store -> $work_mem"
}

if [[ "$USING_DUAL_ACCOUNT" -eq 1 ]]; then
  link_shared_memory || status=$?
fi

echo "done. Restart any running claude-work / claude-personal / default session to pick up changes."
exit "$status"
