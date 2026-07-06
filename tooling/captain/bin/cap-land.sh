#!/bin/bash
# Land a captain task branch into main via greenlight.
#
# Usage: cap-land.sh <id>
#
# Resolves the worktree for the task, checks if it is clean, detaches HEAD
# to free up the branch, and then invokes greenlight to merge. If successful,
# tears down the worktree.

set -uo pipefail

usage() {
  echo "Usage: cap-land.sh <id>" >&2
  exit 2
}

[ $# -eq 1 ] || usage

ID="$1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTAIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CAPTAIN_HOME="${CAPTAIN_HOME:-$CAPTAIN_DIR}"
STATE_DIR="$CAPTAIN_HOME/state"
DATA_DIR="$CAPTAIN_HOME/data"

META="$STATE_DIR/$ID.meta"
if [ ! -f "$META" ]; then
  echo "ERROR: no meta for $ID" >&2
  exit 1
fi

meta_get() {
  grep "^$1=" "$META" | tail -1 | cut -d= -f2-
}

worktree=$(meta_get "worktree") || { echo "ERROR: no worktree for $ID" >&2; exit 1; }
project=$(meta_get "project") || { echo "ERROR: no project for $ID" >&2; exit 1; }

if [ ! -d "$worktree" ]; then
  echo "ERROR: worktree $worktree not found" >&2
  exit 1
fi

status_out=$(git -C "$worktree" status --porcelain)
if [ -n "$status_out" ]; then
  echo "ERROR: worktree $worktree has uncommitted changes" >&2
  exit 1
fi

current_branch=$(git -C "$worktree" rev-parse --abbrev-ref HEAD)
if [ "$current_branch" = "cap/$ID" ]; then
  git -C "$worktree" checkout --detach >/dev/null 2>&1
fi

greenlight="$project/tooling/cli/greenlight/greenlight"
if [ ! -x "$greenlight" ]; then
  echo "ERROR: greenlight not found at $greenlight" >&2
  exit 1
fi

brief="$DATA_DIR/$ID/brief.md"
if [ ! -f "$brief" ]; then
  echo "ERROR: no brief for $ID" >&2
  exit 1
fi

export GREENLIGHT_STATE_ROOT="$STATE_DIR/greenlight-land-$ID"
mkdir -p "$GREENLIGHT_STATE_ROOT"

"$greenlight" run --branch "cap/$ID" --intent "$(cat "$brief")"

run_dir_path=$(find "$GREENLIGHT_STATE_ROOT" -mindepth 1 -maxdepth 1 -type d -print -quit 2>/dev/null || echo "")
if [ -z "$run_dir_path" ]; then
  echo "ERROR: greenlight did not produce a run directory" >&2
  exit 1
fi

gl_state=$(cat "$run_dir_path/state" 2>/dev/null || echo "unknown")

if [ "$gl_state" = "landed" ]; then
  "$SCRIPT_DIR/cap-teardown.sh" "$ID"
  echo "landed $ID"
elif [ "$gl_state" = "parked" ]; then
  reason=$(cat "$run_dir_path/parked-reason" 2>/dev/null || echo "unknown reason")
  echo "parked $reason"
  exit 1
else
  echo "ERROR: greenlight failed or unknown state: $gl_state" >&2
  exit 1
fi
