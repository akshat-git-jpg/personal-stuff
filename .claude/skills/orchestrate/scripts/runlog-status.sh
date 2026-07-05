#!/usr/bin/env bash
# Parse a run-log and print its terminal status in ONE line (token-cheap wake-up read).
#
# Round-aware: status is computed on the ACTIVE segment — everything after the
# last "ROUND N START" marker (appended by the orchestrator when dispatching a
# fix-up round); whole file if no marker. Terminal lines from earlier rounds
# (BLOCKED / RUN DONE) are history, not current state.
#
# Usage: runlog-status.sh <run-log>
# Output (stdout, single line):
#   done                        — RUN DONE in the active segment; run finished
#   blocked <plan>: <reason>    — a plan hit a STOP condition in the active segment
#   dead <plan>                 — <plan> has a START but no DONE/BLOCKED (died or still in flight)
#   not-started                 — executor never started the active round
#   empty                       — log missing or zero bytes
#
# Reading rule encoded here (from plans/WORKFLOW.md): the last "PLAN <id> START"
# in the active segment with no matching terminal line is where the run died.
# Everything above it with a DONE is safe.
set -u

LOG="${1:?usage: runlog-status.sh <run-log>}"

if [ ! -s "$LOG" ]; then
  echo "empty"
  exit 0
fi

# Active segment: lines from the last "ROUND N START" onward; whole file if none.
SEG="$(awk '/ROUND [0-9]+ START/{n=NR} {l[NR]=$0} END{s=(n?n:1); for(i=s;i<=NR;i++) print l[i]}' "$LOG")"

# Explicit BLOCKED (in this round) beats everything — the executor stopped on purpose.
blocked_line=$(printf '%s\n' "$SEG" | grep -E 'PLAN [0-9A-Za-z_-]+ BLOCKED' | tail -1 || true)
if [ -n "$blocked_line" ]; then
  plan=$(echo "$blocked_line" | grep -oE 'PLAN [0-9A-Za-z_-]+' | awk '{print $2}')
  reason=$(echo "$blocked_line" | sed -E 's/.*BLOCKED[: ]*//')
  echo "blocked $plan: $reason"
  exit 0
fi

if printf '%s\n' "$SEG" | grep -q 'RUN DONE'; then
  echo "done"
  exit 0
fi

# Find the last started plan (in this round) with no terminal line (in this round).
dead=""
while read -r n; do
  [ -z "$n" ] && continue
  if ! printf '%s\n' "$SEG" | grep -qE "PLAN $n (DONE|BLOCKED)"; then
    dead="$n"
  fi
done < <(printf '%s\n' "$SEG" | grep -oE 'PLAN [0-9A-Za-z_-]+ START' | awk '{print $2}')

if [ -n "$dead" ]; then
  echo "dead $dead"
  exit 0
fi

# Round 1: no RUN START at all → never started. Fix-up round: the marker is
# there but the executor never wrote a PLAN START → round never picked up.
if ! printf '%s\n' "$SEG" | grep -qE '(RUN START|PLAN [0-9A-Za-z_-]+ START)'; then
  echo "not-started"
  exit 0
fi

# Started, every plan terminal, but no RUN DONE — died between plans.
echo "dead between-plans"
