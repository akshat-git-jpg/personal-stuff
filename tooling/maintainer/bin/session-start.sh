#!/bin/bash
# Lists every job, when it last ran, and whether a proposal is still open.
# It RUNS NOTHING. The owner picks the job; nothing here is autonomous.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
mkdirs

jobs="$(discover_jobs)"
if [ -z "$jobs" ]; then
  echo "job discovery found no jobs — expected at least one jobs/*/check.sh"
  exit 2
fi

printf '%-16s %-12s %s\n' JOB LAST-RUN OPEN-PROPOSAL
for j in $jobs; do
  last="$("$FIND" "$FINDINGS_DIR" -name "*-$j.md" 2>/dev/null | sort | tail -1)"
  prop="$("$FIND" "$PROPOSALS_DIR" -name "*-$j.md" 2>/dev/null | sort | tail -1)"
  last_s="never"; [ -n "$last" ] && last_s="$(basename "$last" | "$SED" "s/-$j\.md//")"
  prop_s="-"
  if [ -n "$prop" ] && ! "$GREP" -q '^Decision:' "$prop"; then prop_s="AWAITING YOU"; fi
  printf '%-16s %-12s %s\n' "$j" "$last_s" "$prop_s"
done

echo
echo "Pick ONE job:  bin/run-job.sh <job>"
