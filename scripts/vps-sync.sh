#!/usr/bin/env bash
# VPS-only sync: keep the VPS clone of personal-stuff current and rebuild the
# Claude Code skill symlinks for the single root account (~/.claude on the VPS,
# which runs the personal Claude Pro plan via Remote Control / Claude mobile).
#
# This is the VPS counterpart to relink.sh (which targets the Mac's two
# accounts). Here there is ONE account: ~/.claude. Idempotent — safe to run by
# hand or from cron. A cron runs it every 15 min so interactive Claude on the
# VPS always sees the latest pushed code + skills without a manual pull.
#
#   git pull   /srv/projects/personal-stuff
#   manifest/personal.txt -> ~/.claude/skills   (source: tooling/claude-skills, else ~/.agents/skills)
#
# The manifest is the source of truth: a managed symlink (into the store or
# ~/.agents/skills) that is no longer in the manifest gets pruned.
set -euo pipefail

# Acquire file lock to prevent overlapping cron executions
exec 9>/tmp/vps-sync.lock
flock -n 9 || { echo "another run in progress"; exit 0; }

REPO="${PERSONAL_STUFF_DIR:-/srv/projects/personal-stuff}"
STORE="$REPO/tooling/claude-skills"
SKILLS_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"
AGENTS_DIR="$HOME/.agents/skills"          # printing-press pp-* skills, if installed
MANIFEST="$STORE/manifest/personal.txt"

echo "repo:   $REPO"

# 1) pull latest code (soft-fail: keep working with the existing checkout)
if [ -d "$REPO/.git" ]; then
  if git -C "$REPO" pull --quiet; then
    echo "git pull: ok"
    rm -f /tmp/vps-sync-pull-failed
  else
    echo "git pull: failed (network?); using existing checkout"
    date > /tmp/vps-sync-pull-failed
    if [ -n "${NTFY_TOPIC:-}" ]; then
      curl -fsS -d "vps-sync: git pull failed on $(hostname)" "http://localhost:8888/${NTFY_TOPIC}" || true
    fi
  fi
else
  echo "FATAL: $REPO is not a git repo" >&2; exit 1
fi

[ -f "$MANIFEST" ] || { echo "FATAL: manifest not found at $MANIFEST" >&2; exit 1; }

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPTS_DIR/lib/skill-link.sh"

status=0
sync_skills_dir personal "$SKILLS_DIR" "$MANIFEST" "$STORE" "$AGENTS_DIR" || status=$?
echo "done."
exit "$status"
