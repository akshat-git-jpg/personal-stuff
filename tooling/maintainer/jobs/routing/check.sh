#!/bin/bash
# routing — the mechanical half. Checks 1-3 only; 4 and 5 need judgement.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
#
# ROUTING_ROOT lets the test point this at a fixture repo.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

ROOT="${ROUTING_ROOT:-$REPO_ROOT}"
cd "$ROOT" || die "cannot reach $ROOT"
[ -f CLAUDE.md ] || die "no CLAUDE.md at $ROOT"

EXEMPT='^(plans/runs|.*/fixtures|.*/venv|.*/node_modules|.*/archive|\..*)$'

found=0
note() { echo "- $1"; found=1; }

echo "# routing findings — $(today)"
echo

echo "## 1. unmapped top-level folders"
for d in */; do
  name="${d%/}"
  echo "$name" | "$GREP" -qE "$EXEMPT" && continue
  "$GREP" -q "$name" CLAUDE.md || note "UNMAPPED $name (no row in the Find it fast table)"
done
echo

echo "## 2. dead links in CLAUDE.md"
"$GREP" -oE '\]\(([^)]+)\)' CLAUDE.md | "$SED" 's/^](//;s/)$//' | sort -u | while read -r target; do
  case "$target" in http*|\#*) continue ;; esac
  t="${target%%#*}"
  [ -e "$t" ] || echo "- DEAD LINK $t (referenced from CLAUDE.md)"
done
echo

echo "## 3. project sub-folders with no operate-doc"
for d in apps/*/ pipelines/*/ tooling/*/; do
  [ -d "$d" ] || continue
  echo "$d" | "$GREP" -qE "$EXEMPT" && continue
  if [ ! -f "$d/README.md" ] && [ ! -f "$d/CLAUDE.md" ]; then
    note "NO OPERATE-DOC $d (siblings have one)"
  fi
done
echo

echo "## 4. stale decisions.md entries — NOT CHECKED HERE"
echo "(needs judgement, and superseded is not stale: an entry overridden by a LATER entry"
echo " is settled history. The session does this against runbook.md check 4.)"
echo
echo "## 5. routes that SHOULD exist — NOT CHECKED HERE"
echo "(an improvement, not a defect. The session does this against runbook.md check 5.)"

exit $found
