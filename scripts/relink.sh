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
#   .claude/skills/                             -> .agents/skills/  (Codex view)
#   a name in both = shared; in one = exclusive to that account.
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

# Rebuild .agents/skills/ so a Codex session in this repo sees the same skills.
# Symlinks only, so there is one copy of each skill on disk (see AGENTS.md).
# Non-fatal: a broken mirror must not block the Claude-side relink.
"$SCRIPTS_DIR/mirror-codex-skills.sh" || { echo "codex mirror had problems (non-fatal)" >&2; status=$?; }

# Install the push gate (a copy outside every working tree) and arm the shared
# .git/hooks pre-push net. Sourced, so it must not abort us: guard_install always
# returns 0, and the `|| true` is belt-and-braces under `set -e`.
REPO_ROOT="$(cd "$SCRIPTS_DIR/.." && pwd)"
source "$SCRIPTS_DIR/lib/guard-install.sh"
guard_install "$REPO_ROOT" || true

echo "done. Restart any running claude-work / claude-personal / default session to pick up changes."
exit "$status"
