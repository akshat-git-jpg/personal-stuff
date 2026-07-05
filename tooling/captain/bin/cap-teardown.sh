#!/bin/bash
# Tear down a finished (or force-killed) captain task: kill its tmux window
# (if any), return its worktree lease, and archive its state files.
#
# Usage: cap-teardown.sh <id> [--force]
#
# Refuses if cap-state reports the task is still working, unless --force. If
# the task's branch (cap/<id>) has commits not on main, prints the greenlight
# invocation to land them instead of silently losing track of them.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTAIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CAPTAIN_HOME="${CAPTAIN_HOME:-$CAPTAIN_DIR}"
export CAPTAIN_HOME
STATE_DIR="$CAPTAIN_HOME/state"
mkdir -p "$STATE_DIR/archive"

usage() {
  echo "Usage: cap-teardown.sh <id> [--force]" >&2
  exit 2
}

[ $# -ge 1 ] || usage
ID="$1"; shift
FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE=1; shift ;;
    *) usage ;;
  esac
done

META="$STATE_DIR/$ID.meta"
[ -f "$META" ] || { echo "ERROR: no such task $ID" >&2; exit 1; }

meta_get() {
  grep "^$1=" "$META" | tail -1 | cut -d= -f2-
}

STATE_LINE=$("$SCRIPT_DIR/cap-state.sh" "$ID")
TASK_STATE=$(echo "$STATE_LINE" | awk '{print $3}')

if [ "$TASK_STATE" = "working" ] && [ "$FORCE" -ne 1 ]; then
  echo "ERROR: task $ID is still working (use --force to tear down anyway)" >&2
  exit 1
fi

WORKTREE=$(meta_get worktree)
LANE=$(meta_get lane)

if [ -n "$WORKTREE" ] && [ -d "$WORKTREE" ]; then
  BRANCH="cap/$ID"
  if git -C "$WORKTREE" show-ref --verify --quiet "refs/heads/$BRANCH"; then
    base="main"
    git -C "$WORKTREE" show-ref --verify --quiet "refs/remotes/origin/main" && base="origin/main"
    UNLANDED=$(git -C "$WORKTREE" log --oneline "$base..$BRANCH" 2>/dev/null || true)
    if [ -n "$UNLANDED" ]; then
      echo "NOTE: $BRANCH has commits not on $base — land them first:"
      echo "  greenlight run --branch $BRANCH --intent \"<summary>\""
    fi
  fi
fi

if [ "$LANE" = "claude-tmux" ]; then
  WINDOW=$(meta_get tmux_window) || WINDOW="cap-$ID"
  TMUX_SESSION="${CAP_TMUX_SESSION:-captain}"
  tmux kill-window -t "$TMUX_SESSION:$WINDOW" 2>/dev/null || true
fi

if [ -n "$WORKTREE" ]; then
  wt return "$WORKTREE" || echo "WARNING: wt return failed for $WORKTREE" >&2
fi

for f in "$STATE_DIR/$ID".*; do
  [ -e "$f" ] || continue
  case "$f" in
    "$STATE_DIR/archive"*) continue ;;
  esac
  mv "$f" "$STATE_DIR/archive/"
done

echo "torn down $ID"
