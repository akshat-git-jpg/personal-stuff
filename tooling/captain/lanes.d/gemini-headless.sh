#!/bin/bash
# Lane: gemini-headless — a backgrounded non-interactive `gemini -p` run.
# EXPERIMENTAL (2026-07-06): candidate replacement for the antigravity lane —
# same Gemini models, but a real process (PID/exit-code liveness, captured
# stdout, no GUI permission dialogs, no global lock: runs in the task's own
# worktree). Shakedown per LESSONS before making it any default.
#
# Contract: <script> <verb> <task-id> [args...]
#   dispatch <task-id> <brief-path>
#   alive    <task-id>          exit 0 provably working, 1 finished/silent, 2 dead
#   collect  <task-id>          print "done|blocked|dead <detail>"
#
# Task metadata lives in $STATE_DIR/<task-id>.meta. This lane appends: pid=,
# out=, dispatched_at=. Model override via meta `model=` (e.g. gemini-3-pro).
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

verb="${1:?usage: gemini-headless.sh <dispatch|alive|collect> <task-id> [args...]}"
id="${2:?usage: gemini-headless.sh <verb> <task-id> [args...]}"

case "$verb" in
  dispatch)
    brief="${3:?dispatch requires <brief-path>}"
    command -v gemini >/dev/null || { echo "ERROR: gemini CLI not installed" >&2; exit 1; }
    worktree=$(meta_get "$id" worktree) || { echo "ERROR: no worktree for $id" >&2; exit 1; }
    out="$STATE_DIR/$id.out"
    : > "$out"
    model=$(meta_get "$id" model) || model=""

    (
      cd "$worktree" || exit 1
      # --yolo: approvals are a spawn-time decision, never a hidden dialog.
      # --skip-trust: worktrees are freshly-created paths the CLI hasn't seen.
      # shellcheck disable=SC2086
      exec gemini -p "$(cat "$brief")" --yolo --skip-trust \
        ${model:+-m "$model"}
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
    # gemini -p prints the final response as plain text; a non-empty output
    # from an exited process counts as done — the caller judges content.
    if [ -s "$out" ]; then
      echo "done headless run completed ($(wc -c < "$out" | tr -d ' ') bytes)"
    else
      echo "dead empty output"
    fi
    ;;

  *)
    echo "ERROR: unknown verb $verb" >&2
    exit 2
    ;;
esac
