#!/usr/bin/env bash
# Repo health aggregator — read-only. Runs the three existing checks and summarizes.
# Usage: .claude/skills/personal-stuff-diagnostics-and-tooling/scripts/doctor.sh [--with-sites]
# (probe-sites hits live URLs, so it's opt-in.)
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$REPO_ROOT"

fail=0
run() {
  local label="$1"; shift
  echo "== $label =="
  if "$@"; then echo "-- $label: OK"; else echo "-- $label: FAIL"; fail=1; fi
  echo
}

run "skills symlink health (scripts/skills-status.sh)" ./scripts/skills-status.sh
run "app checks (scripts/check-apps.sh)" ./scripts/check-apps.sh

if [[ "${1:-}" == "--with-sites" ]]; then
  run "live site probe (scripts/probe-sites.sh)" ./scripts/probe-sites.sh
fi

echo "=================================="
if [[ $fail -eq 0 ]]; then echo "DOCTOR: all checks passed"; else echo "DOCTOR: FAILURES above"; fi
exit $fail
