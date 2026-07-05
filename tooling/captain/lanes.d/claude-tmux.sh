#!/bin/bash
# Lane: claude-tmux — an interactive Claude Code session in a tmux window.
#
# Contract: <script> <verb> <task-id> [args...]
#   dispatch <task-id> <brief-path>
#   alive    <task-id>          exit 0 provably working, 1 finished/silent, 2 dead
#   collect  <task-id>          print "done|blocked|dead <detail>"
#
# Task metadata lives in $STATE_DIR/<task-id>.meta (lane=, project=, worktree=,
# model=, created=). This lane appends: tmux_window=, marker=, dispatched_at=.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTAIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CAPTAIN_HOME="${CAPTAIN_HOME:-$CAPTAIN_DIR}"
STATE_DIR="$CAPTAIN_HOME/state"
mkdir -p "$STATE_DIR"

TMUX_SESSION="${CAP_TMUX_SESSION:-captain}"
BUSY_REGEX='esc (to )?interrupt|Working\.\.\.'

meta_get() {
  # meta_get <task-id> <key>
  local f="$STATE_DIR/$1.meta"
  [ -f "$f" ] || return 1
  grep "^$2=" "$f" | tail -1 | cut -d= -f2-
}

meta_append() {
  # meta_append <task-id> <line>
  echo "$2" >> "$STATE_DIR/$1.meta"
}

verb="${1:?usage: claude-tmux.sh <dispatch|alive|collect> <task-id> [args...]}"
id="${2:?usage: claude-tmux.sh <verb> <task-id> [args...]}"

case "$verb" in
  dispatch)
    brief="${3:?dispatch requires <brief-path>}"
    worktree=$(meta_get "$id" worktree) || { echo "ERROR: no worktree for $id" >&2; exit 1; }
    window="cap-$id"
    marker="$STATE_DIR/$id.turn-ended"
    rm -f "$marker"

    tmux has-session -t "$TMUX_SESSION" 2>/dev/null || tmux new-session -d -s "$TMUX_SESSION"
    tmux new-window -d -t "$TMUX_SESSION" -n "$window" -c "$worktree"

    # Install a Stop hook in the worktree that touches the marker after every
    # assistant turn. Keep it out of git via .git/info/exclude.
    mkdir -p "$worktree/.claude"
    settings_file="$worktree/.claude/settings.local.json"
    cat > "$settings_file" <<EOF
{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"touch $marker"}]}]}}
EOF
    gitdir=$(git -C "$worktree" rev-parse --git-dir 2>/dev/null || true)
    if [ -n "$gitdir" ]; then
      excl="$gitdir/info/exclude"
      mkdir -p "$(dirname "$excl")"
      grep -qxF '.claude/settings.local.json' "$excl" 2>/dev/null || echo '.claude/settings.local.json' >> "$excl"
    fi

    launch_cmd="${CAP_LAUNCH_CMD:-claude} --dangerously-skip-permissions \"\$(cat $(printf '%q' "$brief"))\""
    tmux send-keys -t "$TMUX_SESSION:$window" -l "$launch_cmd"
    sleep 0.3
    tmux send-keys -t "$TMUX_SESSION:$window" Enter

    meta_append "$id" "tmux_window=$window"
    meta_append "$id" "marker=$marker"
    meta_append "$id" "dispatched_at=$(date +%s)"
    ;;

  alive)
    window=$(meta_get "$id" tmux_window) || window="cap-$id"
    content=$(tmux capture-pane -p -t "$TMUX_SESSION:$window" -S -40 2>/dev/null) || { exit 2; }
    if echo "$content" | grep -qE "$BUSY_REGEX"; then
      exit 0
    fi
    exit 1
    ;;

  collect)
    window=$(meta_get "$id" tmux_window) || window="cap-$id"
    marker=$(meta_get "$id" marker) || marker="$STATE_DIR/$id.turn-ended"
    dispatched_at=$(meta_get "$id" dispatched_at) || dispatched_at=0

    if ! tmux capture-pane -p -t "$TMUX_SESSION:$window" -S -40 >/dev/null 2>&1; then
      echo "dead tmux window $window is gone"
      exit 0
    fi

    if [ -f "$marker" ]; then
      marker_mtime=$(stat -f %m "$marker" 2>/dev/null || stat -c %Y "$marker" 2>/dev/null || echo 0)
      if [ "$marker_mtime" -ge "$dispatched_at" ]; then
        echo "done turn ended, pane idle"
        exit 0
      fi
    fi
    echo "blocked no turn-ended marker since dispatch"
    ;;

  *)
    echo "ERROR: unknown verb $verb" >&2
    exit 2
    ;;
esac
