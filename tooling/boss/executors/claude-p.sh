#!/bin/bash
# Executor: claude-p — backgrounded `claude -p` in a worktree.
# Contract: <script> <dispatch|alive|collect> <pr#> [brief-path]
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOSS_HOME="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="$BOSS_HOME/state"; mkdir -p "$STATE_DIR"
meta_get()    { local f="$STATE_DIR/$1.meta"; [ -f "$f" ] || return 1; grep "^$2=" "$f" | tail -1 | cut -d= -f2-; }
meta_set()    { echo "$2=$3" >> "$STATE_DIR/$1.meta"; }
verb="${1:?usage: claude-p.sh <dispatch|alive|collect> <pr#> [brief]}"
id="${2:?usage: claude-p.sh <verb> <pr#> [brief]}"
case "$verb" in
  dispatch)
    brief="${3:?dispatch requires <brief-path>}"
    worktree=$(meta_get "$id" worktree) || { echo "ERROR: no worktree for $id" >&2; exit 1; }
    out="$STATE_DIR/$id.out"; : > "$out"
    model=$(meta_get "$id" model) || model=""; [ -n "$model" ] || model="sonnet"
    ( cd "$worktree" || exit 1
      exec "${BOSS_CLAUDE_CMD:-claude}" -p "$(cat "$brief")" \
        --model "$model" --max-turns "${BOSS_MAX_TURNS:-60}" \
        --output-format json --dangerously-skip-permissions
    ) > "$out" 2>&1 &
    pid=$!; disown "$pid" 2>/dev/null || true
    meta_set "$id" pid "$pid"; meta_set "$id" out "$out"; meta_set "$id" dispatched_at "$(date +%s)"
    ;;
  alive)
    pid=$(meta_get "$id" pid) || exit 2; [ -z "$pid" ] && exit 2
    kill -0 "$pid" 2>/dev/null && exit 0; exit 1 ;;
  collect)
    out=$(meta_get "$id" out) || out="$STATE_DIR/$id.out"
    [ -f "$out" ] || { echo "dead no output file"; exit 0; }
    if grep -q '"result"' "$out" 2>/dev/null; then echo "done headless run completed"
    else echo "dead no result in output"; fi ;;
  *) echo "ERROR: unknown verb $verb" >&2; exit 2 ;;
esac
