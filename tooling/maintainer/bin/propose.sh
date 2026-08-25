#!/bin/bash
# Scaffold the proposal the owner reads. The SESSION writes the verdicts —
# this only creates the skeleton and links the raw findings.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
mkdirs

job="${1:-}"
[ -n "$job" ] || die "usage: propose.sh <job>"
f="$(findings_file "$job")"
[ -f "$f" ] || die "no findings for $job today — run bin/run-job.sh $job first"
p="$(proposal_file "$job")"
[ -f "$p" ] && die "a proposal already exists: $p"

{
  echo "# $job — $(today)"
  echo
  echo "_Raw findings: ${f}_"
  echo
  echo "## Fix (mechanical, no judgement)"
  echo "## Archive (recoverable — moves, nothing is deleted)"
  echo "## Promote (belongs in the repo instead)"
  echo "## Improve (not broken, would be better)"
  echo "## Ask (I will not guess)"
  echo "## Not touching"
  echo
  echo "Approve: all / fix only / by number / none"
  echo
  echo "<!-- The owner's answer goes on ONE line below, starting 'Decision:'."
  echo "     Until that line exists, apply.sh refuses. -->"
} > "$p.tmp" || { rm -f "$p.tmp"; die "could not scaffold $p"; }
mv "$p.tmp" "$p"
echo "proposal scaffolded -> $p"
