#!/bin/bash
# Act on an APPROVED proposal. Refuses if the owner has not decided.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

job="${1:-}"
[ -n "$job" ] || die "usage: apply.sh <job>"
p="$(proposal_file "$job")"
[ -f "$p" ] || die "no proposal for $job today"

decision="$("$GREP" -m1 '^Decision:' "$p" || true)"
[ -n "$decision" ] || die "no 'Decision:' line in $p — nothing is approved, refusing to act"
case "$decision" in
  *none*) echo "$job: owner declined everything. Nothing to do."; exit 0 ;;
esac

echo "$job: decision recorded -> $decision"
echo "Apply the approved items in a pp-work workspace, then append to $LEDGER."
echo "Repo edits MUST claim a workspace: cd \"\$(pp-work claim --kind code --slug maintainer-$job)\""
