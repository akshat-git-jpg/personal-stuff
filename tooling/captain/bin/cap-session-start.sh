#!/bin/bash
# Run once at the start of a captain session: reconcile dead tmux windows
# against known tasks, drain the wake-queue, and print a fleet digest (every
# task's cap-state line + data/backlog.md + parked greenlight runs).
#
# Usage: cap-session-start.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTAIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CAPTAIN_HOME="${CAPTAIN_HOME:-$CAPTAIN_DIR}"
export CAPTAIN_HOME
STATE_DIR="$CAPTAIN_HOME/state"
DATA_DIR="$CAPTAIN_HOME/data"
mkdir -p "$STATE_DIR" "$STATE_DIR/archive"

meta_get() {
  local f="$STATE_DIR/$1.meta"
  [ -f "$f" ] || return 1
  grep "^$2=" "$f" | tail -1 | cut -d= -f2-
}

echo "== captain lock =="
LOCK="$STATE_DIR/.captain-lock"
if [ -f "$LOCK" ]; then
  age_min=$(( ( $(date +%s) - $(stat -f %m "$LOCK") ) / 60 ))
  if [ "$age_min" -lt 480 ]; then
    echo "  WARNING: another captain session may be live (lock refreshed ${age_min}m ago: $(cat "$LOCK"))."
    echo "  Two captains share state/ and WILL double-process wakes. Confirm the other"
    echo "  session is closed before proceeding; clear with: rm state/.captain-lock"
  else
    echo "  stale lock (${age_min}m old) — taking over."
  fi
else
  echo "  (no other captain)"
fi
echo "config=${CLAUDE_CONFIG_DIR:-default} started=$(date '+%F %T')" > "$LOCK"

echo "== reconcile =="
shopt -s nullglob
for meta in "$STATE_DIR"/*.meta; do
  id=$(basename "$meta" .meta)
  lane=$(meta_get "$id" lane)
  if [ "$lane" = "claude-tmux" ]; then
    window=$(meta_get "$id" tmux_window) || window="cap-$id"
    tmux_session="${CAP_TMUX_SESSION:-captain}"
    if ! tmux has-session -t "$tmux_session" 2>/dev/null || ! tmux list-windows -t "$tmux_session" 2>/dev/null | grep -q "$window"; then
      echo "  $id: tmux window '$window' is gone (dead crewmate, needs teardown)"
    fi
  fi
done

echo "== wake queue =="
WAKE_QUEUE="$STATE_DIR/.wake-queue"
if [ -s "$WAKE_QUEUE" ]; then
  cat "$WAKE_QUEUE"
  : > "$WAKE_QUEUE"
else
  echo "  (empty)"
fi

echo "== fleet =="
found=0
for meta in "$STATE_DIR"/*.meta; do
  found=1
  id=$(basename "$meta" .meta)
  "$SCRIPT_DIR/cap-state.sh" "$id"
done
[ "$found" -eq 1 ] || echo "  (no active tasks)"

echo "== backlog =="
BACKLOG="$DATA_DIR/backlog.md"
if [ -s "$BACKLOG" ]; then
  cat "$BACKLOG"
else
  echo "  (no data/backlog.md)"
fi

echo "== in-flight orchestrate runs =="
REPO_ROOT="$(git -C "$CAPTAIN_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
orphan_found=0
if [ -n "$REPO_ROOT" ] && [ -d "$REPO_ROOT/plans/runs" ]; then
  for rl in "$REPO_ROOT"/plans/runs/*.md; do
    case "$rl" in *.prompt.md) continue ;; esac
    head -1 "$rl" | grep -q "^## RUN " || continue   # run logs only, not LESSONS.md
    # only recent logs; a run untouched for 7+ days is history, not in-flight
    [ -n "$(find "$rl" -mtime -7 2>/dev/null)" ] || continue
    if ! grep -q "RUN DONE" "$rl" && ! tail -3 "$rl" | grep -q "BLOCKED:"; then
      orphan_found=1
      echo "  $(basename "$rl"): no RUN DONE — orphaned or in flight (last: $(tail -1 "$rl"))"
    fi
  done
fi
[ "$orphan_found" -eq 1 ] || echo "  (none)"

echo "== parked greenlight runs =="
GL_DIR="$HOME/kb-scratch/greenlight"
parked_found=0
if [ -d "$GL_DIR" ]; then
  for run_dir in "$GL_DIR"/*; do
    [ -d "$run_dir" ] || continue
    state_file="$run_dir/state"
    [ -f "$state_file" ] || continue
    if [ "$(cat "$state_file")" = "parked" ]; then
      parked_found=1
      reason=""
      [ -f "$run_dir/parked-reason" ] && reason=$(cat "$run_dir/parked-reason")
      echo "  $(basename "$run_dir"): $reason"
    fi
  done
fi
[ "$parked_found" -eq 1 ] || echo "  (none)"
