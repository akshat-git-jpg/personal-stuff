#!/bin/bash
# Run ONE job's mechanical check. Writes findings. Judges nothing, changes nothing.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
mkdirs

job="${1:-}"
[ -n "$job" ] || die "usage: run-job.sh <job>"
check="$(job_dir "$job")/check.sh"
[ -f "$check" ] || die "no such job: $job (have: $(discover_jobs | tr '\n' ' '))"

out="$(findings_file "$job")"
bash "$check" > "$out"
rc=$?
case "$rc" in
  0) echo "$job: clean. findings -> $out" ;;
  1) echo "$job: findings written -> $out"; echo "next: bin/propose.sh $job" ;;
  *) echo "$job: THE CHECK ITSELF FAILED (exit $rc). Do not treat this as clean." >&2 ;;
esac
exit $rc
