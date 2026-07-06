#!/bin/bash
# Spawn a new captain task: lease a worktree via `wt`, write task metadata,
# and hand off to the chosen lane's dispatch verb.
#
# Usage: cap-spawn.sh <id> <project-path> --lane <lane> [--model <m>] [--effort <e>]
#
# Precondition: the brief the captain wrote must already exist at
# $CAPTAIN_HOME/data/<id>/brief.md — spawn fails loudly if it's missing.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTAIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CAPTAIN_HOME="${CAPTAIN_HOME:-$CAPTAIN_DIR}"
export CAPTAIN_HOME
STATE_DIR="$CAPTAIN_HOME/state"
DATA_DIR="$CAPTAIN_HOME/data"
LANES_DIR="$CAPTAIN_DIR/lanes.d"
mkdir -p "$STATE_DIR" "$STATE_DIR/archive"

usage() {
  echo "Usage: cap-spawn.sh <id> <project-path> --lane <lane> [--model <m>] [--effort <e>]" >&2
  exit 2
}

[ $# -ge 3 ] || usage

ID="$1"; shift
PROJECT="$1"; shift
LANE=""
MODEL=""
EFFORT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --lane) LANE="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --effort) EFFORT="$2"; shift 2 ;;
    *) usage ;;
  esac
done

[ -n "$LANE" ] || usage

META="$STATE_DIR/$ID.meta"
if [ -f "$META" ]; then
  echo "ERROR: task '$ID' already exists ($META)" >&2
  exit 1
fi

LANE_SCRIPT="$LANES_DIR/$LANE.sh"
if [ ! -x "$LANE_SCRIPT" ]; then
  echo "ERROR: unknown lane '$LANE' (no $LANE_SCRIPT)" >&2
  exit 1
fi

BRIEF="$DATA_DIR/$ID/brief.md"
if [ ! -s "$BRIEF" ]; then
  echo "ERROR: brief missing or empty: $BRIEF (write it before spawning)" >&2
  exit 1
fi

WT_PATH=$(wt get --holder "cap-$ID" --repo "$PROJECT") || {
  echo "ERROR: wt get failed for project $PROJECT" >&2
  exit 1
}

{
  echo "id=$ID"
  echo "lane=$LANE"
  echo "project=$PROJECT"
  echo "worktree=$WT_PATH"
  echo "model=$MODEL"
  echo "effort=$EFFORT"
  echo "created=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
} > "$META"

echo "[$(date +%H:%M:%S)] spawned: lane=$LANE project=$PROJECT worktree=$WT_PATH" >> "$STATE_DIR/$ID.status"

CAPTAIN_HOME="$CAPTAIN_HOME" "$LANE_SCRIPT" dispatch "$ID" "$BRIEF"
rc=$?
if [ $rc -ne 0 ]; then
  echo "ERROR: lane dispatch failed (exit $rc)" >&2
  exit $rc
fi

echo "spawned $ID (lane=$LANE, worktree=$WT_PATH)"
