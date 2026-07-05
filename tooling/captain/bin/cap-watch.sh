#!/bin/bash
# Background liveness watcher. Every 30s, for each non-archived task, compares
# lane liveness against the last recorded signal; on a change that means
# "needs attention" (finished, died, or turn ended with no terminal status
# verb) it appends a line to state/.wake-queue — but only when the lane does
# NOT show positive evidence of ongoing work (the absorb rule). Never calls
# any model. Meant to run as a background Bash task from the captain session.
#
# Test hook: CAP_WATCH_ONCE=1 runs a single pass and exits (used by
# test-captain.sh; real usage loops forever).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTAIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CAPTAIN_HOME="${CAPTAIN_HOME:-$CAPTAIN_DIR}"
export CAPTAIN_HOME
STATE_DIR="$CAPTAIN_HOME/state"
LANES_DIR="$CAPTAIN_DIR/lanes.d"
mkdir -p "$STATE_DIR" "$STATE_DIR/archive"

WAKE_QUEUE="$STATE_DIR/.wake-queue"

meta_get() {
  local f="$STATE_DIR/$1.meta"
  [ -f "$f" ] || return 1
  grep "^$2=" "$f" | tail -1 | cut -d= -f2-
}

do_pass() {
  shopt -s nullglob
  for meta in "$STATE_DIR"/*.meta; do
    id=$(basename "$meta" .meta)
    lane=$(meta_get "$id" lane)
    lane_script="$LANES_DIR/$lane.sh"
    [ -x "$lane_script" ] || continue

    if CAPTAIN_HOME="$CAPTAIN_HOME" "$lane_script" alive "$id" >/dev/null 2>&1; then
      signal="working"
    else
      collect_out=$(CAPTAIN_HOME="$CAPTAIN_HOME" "$lane_script" collect "$id" 2>/dev/null)
      signal=$(echo "$collect_out" | awk '{print $1}')
      [ -n "$signal" ] || signal="dead"
    fi

    last_seen_file="$STATE_DIR/$id.last-seen"
    prev=""
    [ -f "$last_seen_file" ] && prev=$(cat "$last_seen_file")

    if [ "$signal" != "$prev" ]; then
      if [ "$signal" != "working" ]; then
        echo "[$(date +%H:%M:%S)] $id $signal" >> "$WAKE_QUEUE"
      fi
      echo "$signal" > "$last_seen_file"
    fi
  done
}

if [ -n "${CAP_WATCH_ONCE:-}" ]; then
  do_pass
  exit 0
fi

while true; do
  do_pass
  sleep 30
done
