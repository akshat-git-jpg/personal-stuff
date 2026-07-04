#!/usr/bin/env bash
# Background watcher for a run-log. Blocks (cheaply, in bash — the model takes no
# turns) until the run terminates or goes stale, then exits so the harness
# re-invokes the orchestrator session.
#
# Usage: watch-run.sh <run-log> [timeout-minutes]
#   timeout-minutes — staleness window (default 10). If the log's mtime is older
#   than this and there's no RUN DONE, the executor is declared dead.
#
# Exit codes:
#   0 — RUN DONE (success sentinel found)
#   2 — a plan went BLOCKED (executor stopped on a STOP condition)
#   3 — stale: no log append for <timeout> minutes and no RUN DONE (executor died)
#   4 — log never got a RUN START within the appear window (executor never started)
set -u

LOG="${1:?usage: watch-run.sh <run-log> [timeout-min]}"
TIMEOUT_MIN="${2:-10}"
POLL="${WATCH_POLL:-15}"   # override only in tests
APPEAR_WAIT_SEC=$(( 5 * 60 ))   # executor must write RUN START within 5 min

# Phase 1: wait for the executor to actually start.
waited=0
while ! grep -q 'RUN START' "$LOG" 2>/dev/null; do
  sleep "$POLL"
  waited=$(( waited + POLL ))
  if [ "$waited" -ge "$APPEAR_WAIT_SEC" ]; then
    exit 4
  fi
done

# Phase 2: watch until a terminal state or staleness.
while true; do
  if grep -q 'RUN DONE' "$LOG"; then
    exit 0
  fi
  if grep -qE 'PLAN [0-9A-Za-z_-]+ BLOCKED' "$LOG"; then
    exit 2
  fi
  now=$(date +%s)
  mtime=$(stat -f %m "$LOG")
  if [ $(( now - mtime )) -ge $(( TIMEOUT_MIN * 60 )) ]; then
    exit 3
  fi
  sleep "$POLL"
done
