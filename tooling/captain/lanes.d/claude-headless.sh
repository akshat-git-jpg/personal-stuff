#!/bin/bash
# Lane: claude-headless — a backgrounded non-interactive `claude -p` run.
#
# Contract: <script> <verb> <task-id> [args...]
#   dispatch <task-id> <brief-path>
#   alive    <task-id>          exit 0 provably working, 1 finished/silent, 2 dead
#   collect  <task-id>          print "done|blocked|dead <detail>"
#
# Task metadata lives in $STATE_DIR/<task-id>.meta. This lane appends: pid=,
# out=, dispatched_at=.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTAIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CAPTAIN_HOME="${CAPTAIN_HOME:-$CAPTAIN_DIR}"
STATE_DIR="$CAPTAIN_HOME/state"
mkdir -p "$STATE_DIR"

meta_get() {
  local f="$STATE_DIR/$1.meta"
  [ -f "$f" ] || return 1
  grep "^$2=" "$f" | tail -1 | cut -d= -f2-
}

meta_append() {
  echo "$2" >> "$STATE_DIR/$1.meta"
}

verb="${1:?usage: claude-headless.sh <dispatch|alive|collect> <task-id> [args...]}"
id="${2:?usage: claude-headless.sh <verb> <task-id> [args...]}"

case "$verb" in
  dispatch)
    brief="${3:?dispatch requires <brief-path>}"
    worktree=$(meta_get "$id" worktree) || { echo "ERROR: no worktree for $id" >&2; exit 1; }
    out="$STATE_DIR/$id.out"
    : > "$out"

    (
      cd "$worktree" || exit 1
      exec "${CAP_LAUNCH_CMD:-claude}" -p "$(cat "$brief")" \
        --output-format json --dangerously-skip-permissions
    ) > "$out" 2>&1 &
    pid=$!
    disown "$pid" 2>/dev/null || true

    meta_append "$id" "pid=$pid"
    meta_append "$id" "out=$out"
    meta_append "$id" "dispatched_at=$(date +%s)"
    ;;

  alive)
    pid=$(meta_get "$id" pid) || exit 2
    if [ -z "$pid" ]; then exit 2; fi
    if kill -0 "$pid" 2>/dev/null; then
      exit 0
    fi
    exit 1
    ;;

  collect)
    out=$(meta_get "$id" out) || out="$STATE_DIR/$id.out"
    if [ ! -f "$out" ]; then
      echo "dead no output file"
      exit 0
    fi
    if grep -q '"result"' "$out" 2>/dev/null; then
      echo "done headless run completed"
    else
      echo "dead no result in output"
    fi
    ;;

  *)
    echo "ERROR: unknown verb $verb" >&2
    exit 2
    ;;
esac
