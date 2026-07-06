#!/bin/bash
# Lane: agy-headless — a backgrounded non-interactive Antigravity CLI run.
# OFFICERS' DEFAULT EXECUTOR (owner decision 2026-07-06): same engine and
# AI Pro subscription as the Antigravity IDE, but headless — real process
# (PID/exit-code liveness), no GUI permission dialogs, no aglock: runs in
# the task's own worktree, so officers execute fully in parallel. Replaces
# the gemini-headless lane (Google cut the gemini CLI off from individual
# accounts 2026-06-18 — see references/antigravity-cli-findings.md).
#
# Contract: <script> <verb> <task-id> [args...]
#   dispatch <task-id> <brief-path>
#   alive    <task-id>          exit 0 provably working, 1 finished/silent, 2 dead
#   collect  <task-id>          print "done|blocked|dead <detail>"
#
# Task metadata lives in $STATE_DIR/<task-id>.meta. This lane appends: pid=,
# out=, dispatched_at=. Model override via meta `model=` — agy model names
# contain spaces, e.g. model=Gemini 3.1 Pro (High); see `agy models`.
set -uo pipefail

export PATH="$HOME/.local/bin:$PATH"   # agy installs to ~/.local/bin

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

verb="${1:?usage: agy-headless.sh <dispatch|alive|collect> <task-id> [args...]}"
id="${2:?usage: agy-headless.sh <verb> <task-id> [args...]}"

case "$verb" in
  dispatch)
    brief="${3:?dispatch requires <brief-path>}"
    command -v agy >/dev/null || { echo "ERROR: agy not installed (curl -fsSL https://antigravity.google/cli/install.sh | bash)" >&2; exit 1; }
    worktree=$(meta_get "$id" worktree) || { echo "ERROR: no worktree for $id" >&2; exit 1; }
    out="$STATE_DIR/$id.out"
    : > "$out"
    model=$(meta_get "$id" model) || model=""

    (
      cd "$worktree" || exit 1
      if [ -n "$model" ]; then
        exec agy -p "$(cat "$brief")" --dangerously-skip-permissions --model "$model"
      else
        exec agy -p "$(cat "$brief")" --dangerously-skip-permissions
      fi
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
    # agy -p prints the final response as plain text; non-empty output from an
    # exited process counts as done — the caller judges content.
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
