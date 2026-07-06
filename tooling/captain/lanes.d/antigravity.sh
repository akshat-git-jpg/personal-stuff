#!/bin/bash
# Lane: antigravity — a GUI-driven Antigravity handoff (cheap plan-batch lane).
#
# Contract: <script> <verb> <task-id> [args...]
#   dispatch <task-id> <brief-path>
#   alive    <task-id>          exit 0 provably working, 1 finished/silent, 2 dead
#   collect  <task-id>          print "done|blocked|dead <detail>"
#
# Antigravity skips run-log heartbeats on long GUI runs (plans/runs/LESSONS.md,
# 2026-07-05), so `alive` trusts worktree file mtimes and git log over the
# run-log's own mtime. Task metadata lives in $STATE_DIR/<task-id>.meta. This
# lane appends: runlog=, dispatched_at=.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTAIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CAPTAIN_HOME="${CAPTAIN_HOME:-$CAPTAIN_DIR}"
STATE_DIR="$CAPTAIN_HOME/state"
mkdir -p "$STATE_DIR"

# How recent counts as "alive" evidence. Overridable for tests.
ALIVE_MIN="${CAP_AG_ALIVE_MIN:-10}"

meta_get() {
  local f="$STATE_DIR/$1.meta"
  [ -f "$f" ] || return 1
  grep "^$2=" "$f" | tail -1 | cut -d= -f2-
}

meta_append() {
  echo "$2" >> "$STATE_DIR/$1.meta"
}

repo_root() {
  git -C "$CAPTAIN_DIR" rev-parse --show-toplevel 2>/dev/null || echo "$CAPTAIN_DIR/../.."
}

verb="${1:?usage: antigravity.sh <dispatch|alive|collect> <task-id> [args...]}"
id="${2:?usage: antigravity.sh <verb> <task-id> [args...]}"

case "$verb" in
  dispatch)
    brief="${3:?dispatch requires <brief-path>}"
    root="$(repo_root)"
    runlog="$root/plans/runs/$id.md"
    mkdir -p "$(dirname "$runlog")"
    {
      echo "## RUN $id  executor: antigravity  lane: antigravity"
      echo "[$(date +%H:%M:%S)] RUN START"
    } > "$runlog"

    handoff="$root/.claude/skills/orchestrate/scripts/ag-handoff.sh"
    "$handoff" "$brief"

    meta_append "$id" "runlog=$runlog"
    meta_append "$id" "dispatched_at=$(date +%s)"
    ;;

  alive)
    worktree=$(meta_get "$id" worktree) || worktree=""
    runlog=$(meta_get "$id" runlog) || runlog=""
    now=$(date +%s)
    window=$(( ALIVE_MIN * 60 ))
    recent=1

    if [ -n "$runlog" ] && [ -f "$runlog" ]; then
      mtime=$(stat -f %m "$runlog" 2>/dev/null || stat -c %Y "$runlog" 2>/dev/null || echo 0)
      [ $(( now - mtime )) -lt "$window" ] && recent=0
    fi

    if [ "$recent" -ne 0 ] && [ -n "$worktree" ] && [ -d "$worktree" ]; then
      threshold=$(( now - window ))
      while IFS= read -r f; do
        [ -n "$f" ] || continue
        fmtime=$(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f" 2>/dev/null || echo 0)
        if [ "$fmtime" -ge "$threshold" ]; then
          recent=0
          break
        fi
      done < <(find "$worktree" -type f 2>/dev/null | grep -v '/\.git/')
    fi

    if [ "$recent" -ne 0 ] && [ -n "$worktree" ] && [ -d "$worktree" ]; then
      commit_ts=$(git -C "$worktree" log -1 --format=%ct 2>/dev/null || echo 0)
      [ -n "$commit_ts" ] && [ $(( now - commit_ts )) -lt "$window" ] && recent=0
    fi

    [ "$recent" -eq 0 ] && exit 0
    exit 1
    ;;

  collect)
    runlog=$(meta_get "$id" runlog) || runlog=""
    worktree=$(meta_get "$id" worktree) || worktree=""
    dispatched_at=$(meta_get "$id" dispatched_at) || dispatched_at=0
    root="$(repo_root)"
    status_script="$root/.claude/skills/orchestrate/scripts/runlog-status.sh"

    word="empty"
    if [ -n "$runlog" ] && [ -x "$status_script" ]; then
      word=$("$status_script" "$runlog" 2>/dev/null || echo "empty")
    fi

    case "$word" in
      done)
        echo "done $word"
        exit 0
        ;;
      blocked*)
        echo "blocked $word"
        exit 0
        ;;
      *)
        # git-commit fallback: a commit after dispatch means the work landed
        # even if the run-log never got a terminal marker.
        if [ -n "$worktree" ] && [ -d "$worktree" ]; then
          commit_ts=$(git -C "$worktree" log -1 --format=%ct 2>/dev/null || echo 0)
          if [ -n "$commit_ts" ] && [ "$commit_ts" -gt "$dispatched_at" ]; then
            echo "done git-commit fallback"
            exit 0
          fi
        fi
        echo "dead runlog-status: $word"
        ;;
    esac
    ;;

  *)
    echo "ERROR: unknown verb $verb" >&2
    exit 2
    ;;
esac
