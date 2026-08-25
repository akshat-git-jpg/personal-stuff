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
#
set -euo pipefail

# Acquire file lock to prevent overlapping cron executions
exec 9>/tmp/vps-sync.lock
flock -n 9 || { echo "another run in progress"; exit 0; }

REPO="${PERSONAL_STUFF_DIR:-/srv/projects/personal-stuff}"

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

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Same push gate + pre-push net as the Mac gets from relink.sh. guard_install always
# returns 0, so it can never abort this cron-run script.
source "$SCRIPTS_DIR/lib/guard-install.sh"
guard_install "$REPO" || true

# No skill symlinking any more: skills are repo-scoped, so a VPS session running
# inside this checkout reads .claude/skills directly (2026-08-25).
echo "done."
