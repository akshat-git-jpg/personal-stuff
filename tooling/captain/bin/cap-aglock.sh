#!/bin/bash
# Global Antigravity lock: one plan-batch execution at a time, repo-wide.
# Antigravity is one IDE on one workspace (the main checkout), so holding
# this lock ALSO means the main checkout is checked out to the holder's
# branch until release. greenlight lands and owner work on the main checkout
# must wait for release.
#
# Usage:
#   cap-aglock.sh acquire <task-id> <branch>   # blocks up to 30 min for the lock,
#                                              # then checks out <branch> in the main checkout
#   cap-aglock.sh release <task-id>            # returns main checkout to main, frees the lock
#   cap-aglock.sh status                       # who holds it
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTAIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="${CAPTAIN_HOME:-$CAPTAIN_DIR}/state"
LOCK_DIR="$STATE_DIR/.aglock.d"
REPO_ROOT="$(git -C "$CAPTAIN_DIR" rev-parse --show-toplevel)"
mkdir -p "$STATE_DIR"

cmd="${1:-}"; shift || true
case "$cmd" in
  acquire)
    id="${1:?task-id required}"; branch="${2:?branch required}"
    waited=0
    until mkdir "$LOCK_DIR" 2>/dev/null; do
      holder=$(cat "$LOCK_DIR/holder" 2>/dev/null || echo "?")
      [ $waited -eq 0 ] && echo "waiting for aglock (held by: $holder)…" >&2
      sleep 30; waited=$((waited+30))
      if [ $waited -ge 1800 ]; then
        echo "ERROR: aglock still held by $holder after 30m — escalate to the captain" >&2
        exit 1
      fi
    done
    echo "$id" > "$LOCK_DIR/holder"
    # steer the main checkout onto the officer's branch — only from a clean main
    if [ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]; then
      echo "ERROR: main checkout dirty — cannot steer it to $branch. Lock released." >&2
      rm -rf "$LOCK_DIR"; exit 2
    fi
    prev=$(git -C "$REPO_ROOT" branch --show-current)
    echo "$prev" > "$LOCK_DIR/prev-branch"
    if ! git -C "$REPO_ROOT" checkout -q "$branch"; then
      echo "ERROR: checkout $branch failed in main checkout. Lock released." >&2
      rm -rf "$LOCK_DIR"; exit 2
    fi
    echo "aglock acquired by $id; main checkout on $branch (was $prev)"
    ;;
  release)
    id="${1:?task-id required}"
    holder=$(cat "$LOCK_DIR/holder" 2>/dev/null || echo "")
    if [ "$holder" != "$id" ]; then
      echo "ERROR: aglock held by '$holder', not '$id' — not releasing" >&2; exit 2
    fi
    prev=$(cat "$LOCK_DIR/prev-branch" 2>/dev/null || echo "main")
    if [ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]; then
      echo "WARN: main checkout dirty at release — leaving branch as-is for inspection" >&2
    else
      git -C "$REPO_ROOT" checkout -q "$prev" || echo "WARN: could not return to $prev" >&2
    fi
    rm -rf "$LOCK_DIR"
    echo "aglock released by $id; main checkout back on $prev"
    ;;
  status)
    if [ -d "$LOCK_DIR" ]; then
      echo "held by: $(cat "$LOCK_DIR/holder" 2>/dev/null || echo '?') (main checkout on $(git -C "$REPO_ROOT" branch --show-current))"
    else
      echo "free"
    fi
    ;;
  *)
    echo "usage: cap-aglock.sh acquire <task-id> <branch> | release <task-id> | status" >&2
    exit 2
    ;;
esac
