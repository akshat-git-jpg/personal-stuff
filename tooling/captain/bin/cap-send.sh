#!/bin/bash
# Send a line of text into a running task's interactive session.
# claude-tmux lane only — other lanes are not interactive.
#
# Usage: cap-send.sh <id> "<text>"
#
# Submit protocol (firstmate's, kept literal): type the text once via a
# literal send-keys, sleep, then send Enter as a SEPARATE send-keys call. On a
# swallowed Enter, retry Enter only — never retype the text.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTAIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CAPTAIN_HOME="${CAPTAIN_HOME:-$CAPTAIN_DIR}"
STATE_DIR="$CAPTAIN_HOME/state"

usage() {
  echo 'Usage: cap-send.sh <id> "<text>"' >&2
  exit 2
}

[ $# -eq 2 ] || usage
ID="$1"
TEXT="$2"

meta_get() {
  local f="$STATE_DIR/$1.meta"
  [ -f "$f" ] || return 1
  grep "^$2=" "$f" | tail -1 | cut -d= -f2-
}

META="$STATE_DIR/$ID.meta"
[ -f "$META" ] || { echo "ERROR: no such task $ID" >&2; exit 1; }

LANE=$(meta_get "$ID" lane)
if [ "$LANE" != "claude-tmux" ]; then
  echo "lane not interactive" >&2
  exit 1
fi

WINDOW=$(meta_get "$ID" tmux_window) || WINDOW="cap-$ID"
TMUX_SESSION="${CAP_TMUX_SESSION:-captain}"

tmux send-keys -t "$TMUX_SESSION:$WINDOW" -l "$TEXT"
sleep 0.3
tmux send-keys -t "$TMUX_SESSION:$WINDOW" Enter
