#!/bin/bash
# Report state for one or all captain tasks: "<id> <lane> <state> <detail>".
#
# state is the lane's alive/collect verdict reconciled with the last line of
# state/<id>.status (terminal verbs: done: failed: needs-decision: blocked:).
# A LIVE lane check always wins over a stale status line.
#
# Usage: cap-state.sh [<id>]
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTAIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CAPTAIN_HOME="${CAPTAIN_HOME:-$CAPTAIN_DIR}"
STATE_DIR="$CAPTAIN_HOME/state"
LANES_DIR="$CAPTAIN_DIR/lanes.d"
mkdir -p "$STATE_DIR"

meta_get() {
  local f="$STATE_DIR/$1.meta"
  [ -f "$f" ] || return 1
  grep "^$2=" "$f" | tail -1 | cut -d= -f2-
}

state_one() {
  local id="$1"
  local meta="$STATE_DIR/$id.meta"
  if [ ! -f "$meta" ]; then
    echo "$id ? unknown no meta file"
    return
  fi
  local lane
  lane=$(meta_get "$id" lane)
  local lane_script="$LANES_DIR/$lane.sh"
  if [ ! -x "$lane_script" ]; then
    echo "$id $lane error unknown lane script"
    return
  fi

  local state detail
  if CAPTAIN_HOME="$CAPTAIN_HOME" "$lane_script" alive "$id" >/dev/null 2>&1; then
    state="working"
    detail="lane reports alive"
  else
    local collect_out
    collect_out=$(CAPTAIN_HOME="$CAPTAIN_HOME" "$lane_script" collect "$id" 2>/dev/null)
    local lane_state lane_detail
    lane_state=$(echo "$collect_out" | awk '{print $1}')
    lane_detail=$(echo "$collect_out" | cut -d' ' -f2-)
    [ -n "$lane_state" ] || lane_state="dead"

    local log_file="$STATE_DIR/$id.status"
    local log_tail=""
    [ -f "$log_file" ] && log_tail=$(tail -1 "$log_file")

    if echo "$log_tail" | grep -qE '^(done|failed|needs-decision|blocked):'; then
      state=$(echo "$log_tail" | cut -d: -f1)
      detail=$(echo "$log_tail" | cut -d: -f2- | sed -E 's/^ *//')
    else
      state="$lane_state"
      detail="$lane_detail"
    fi
  fi
  echo "$id $lane $state $detail"
}

if [ $# -eq 1 ]; then
  state_one "$1"
else
  shopt -s nullglob
  for meta in "$STATE_DIR"/*.meta; do
    id=$(basename "$meta" .meta)
    state_one "$id"
  done
fi
