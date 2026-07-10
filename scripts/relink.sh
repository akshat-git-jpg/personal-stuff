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
#   a name in both = shared; in one = exclusive to that account.
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
fi
WORK_DIR="${CLAUDE_WORK_CONFIG_DIR:-$HOME/.claude-work}/skills"
PERS_DIR="${CLAUDE_PERSONAL_CONFIG_DIR:-$HOME/.claude-personal}/skills"
AGENTS_DIR="$HOME/.agents/skills"   # printing-press pp-* skills

echo "store:  $STORE"
echo "agents: $AGENTS_DIR"
status=0
sync_skills_dir work     "$WORK_DIR" "$STORE/manifest/work.txt"     "$STORE" "$AGENTS_DIR" || status=$?
sync_skills_dir personal "$PERS_DIR" "$STORE/manifest/personal.txt" "$STORE" "$AGENTS_DIR" || status=$?
echo "done. Restart any running claude-work / claude-personal session to pick up changes."
exit "$status"
