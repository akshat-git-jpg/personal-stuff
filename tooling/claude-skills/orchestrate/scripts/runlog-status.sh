#!/usr/bin/env bash
# Parse a run-log and print its terminal status in ONE line (token-cheap wake-up read).
#
# Usage: runlog-status.sh <run-log>
# Output (stdout, single line):
#   done                        — RUN DONE sentinel present; all plans finished
#   blocked <plan>: <reason>    — a plan hit a STOP condition / went BLOCKED
#   dead <plan>                 — <plan> has a START but no DONE/BLOCKED (died or still in flight)
#   not-started                 — log has a header but executor never wrote RUN START
#   empty                       — log missing or zero bytes
#
# Reading rule encoded here (from plans/WORKFLOW.md): the last "PLAN <id> START"
# with no matching terminal line is where the run died. Everything above it with
# a DONE is safe.
set -u

LOG="${1:?usage: runlog-status.sh <run-log>}"

if [ ! -s "$LOG" ]; then
  echo "empty"
  exit 0
fi

# Explicit BLOCKED beats everything — the executor stopped on purpose.
blocked_line=$(grep -E 'PLAN [0-9A-Za-z_-]+ BLOCKED' "$LOG" | tail -1 || true)
if [ -n "$blocked_line" ]; then
  plan=$(echo "$blocked_line" | grep -oE 'PLAN [0-9A-Za-z_-]+' | awk '{print $2}')
  reason=$(echo "$blocked_line" | sed -E 's/.*BLOCKED[: ]*//')
  echo "blocked $plan: $reason"
  exit 0
fi

if grep -q 'RUN DONE' "$LOG"; then
  echo "done"
  exit 0
fi

# Find the last started plan that has no terminal line.
dead=""
while read -r n; do
  [ -z "$n" ] && continue
  if ! grep -qE "PLAN $n (DONE|BLOCKED)" "$LOG"; then
    dead="$n"
  fi
done < <(grep -oE 'PLAN [0-9A-Za-z_-]+ START' "$LOG" | awk '{print $2}')

if [ -n "$dead" ]; then
  echo "dead $dead"
  exit 0
fi

if ! grep -q 'RUN START' "$LOG"; then
  echo "not-started"
  exit 0
fi

# RUN START present, every plan terminal, but no RUN DONE — died between plans.
echo "dead between-plans"
