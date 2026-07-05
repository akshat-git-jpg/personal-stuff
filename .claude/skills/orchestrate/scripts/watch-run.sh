#!/usr/bin/env bash
# Background watcher for a run-log. Blocks (cheaply, in bash — the model takes no
# turns) until the run terminates or goes stale, then exits so the harness
# re-invokes the orchestrator session.
#
# Round-aware: a run log accumulates fix-up rounds. "ROUND N START" markers are
# appended by the ORCHESTRATOR at dispatch time; everything after the LAST
# marker is the ACTIVE segment (whole file if no marker). Terminal lines from
# earlier rounds (BLOCKED / RUN DONE) are history and never end the watch.
#
# Usage: watch-run.sh <run-log> [timeout-minutes]
#   timeout-minutes — staleness window (default 10). If the log's mtime is older
#   than this and the active segment has no terminal line, the executor is
#   declared dead.
#
# Exit codes:
#   0 — RUN DONE in the active segment (success)
#   2 — a plan went BLOCKED in the active segment (executor hit a STOP condition)
#   3 — stale: no log append for <timeout> minutes and no terminal line (executor died)
#   4 — executor never started within the appear window (no RUN START; for a
#       fix-up round, no PLAN START after the round marker)
set -u

LOG="${1:?usage: watch-run.sh <run-log> [timeout-min]}"
TIMEOUT_MIN="${2:-10}"
POLL="${WATCH_POLL:-15}"                      # override only in tests
APPEAR_WAIT_SEC="${WATCH_APPEAR_SEC:-300}"    # executor must start within 5 min

# Active segment: lines from the last "ROUND N START" onward; whole file if none.
seg() {
  awk '/ROUND [0-9]+ START/{n=NR} {l[NR]=$0} END{s=(n?n:1); for(i=s;i<=NR;i++) print l[i]}' "$LOG" 2>/dev/null
}

# Started = RUN START in the segment (first round), or any PLAN START after a
# fix-up round marker (fix-up rounds don't write a fresh RUN START).
started() {
  s="$(seg)"
  if printf '%s\n' "$s" | grep -q 'RUN START'; then return 0; fi
  if printf '%s\n' "$s" | head -1 | grep -qE 'ROUND [0-9]+ START' &&
     printf '%s\n' "$s" | grep -qE 'PLAN [0-9A-Za-z_-]+ START'; then return 0; fi
  return 1
}

# Phase 1: wait for the executor to actually start.
waited=0
while ! started; do
  sleep "$POLL"
  waited=$(( waited + POLL ))
  if [ "$waited" -ge "$APPEAR_WAIT_SEC" ]; then
    exit 4
  fi
done

# Phase 2: watch the active segment until a terminal state or staleness.
while true; do
  s="$(seg)"
  if printf '%s\n' "$s" | grep -q 'RUN DONE'; then
    exit 0
  fi
  if printf '%s\n' "$s" | grep -qE 'PLAN [0-9A-Za-z_-]+ BLOCKED'; then
    exit 2
  fi
  now=$(date +%s)
  mtime=$(stat -f %m "$LOG")
  if [ $(( now - mtime )) -ge $(( TIMEOUT_MIN * 60 )) ]; then
    exit 3
  fi
  sleep "$POLL"
done
