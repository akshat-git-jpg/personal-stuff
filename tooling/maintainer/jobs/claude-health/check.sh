#!/bin/bash
# claude-health — is the Claude Code install healthy.
# Reports; never updates, never installs, never removes.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

found=0
note() { echo "- $1"; found=1; }

echo "# claude-health findings — $(today)"
echo

if ! command -v claude >/dev/null 2>&1; then
  echo "- claude CLI not on PATH; nothing to check"
  exit 0
fi

echo "## 1. claude doctor"
if out="$(claude doctor 2>&1)"; then
  echo "$out" | "$SED" 's/^/    /'
else
  note "claude doctor exited non-zero — read the output above"
  echo "$out" | "$SED" 's/^/    /'
fi
echo

echo "## 2. version"
echo "    $(claude --version 2>&1 | head -1)"
echo

echo "## 3. the full checkup is a SESSION-STEP"
echo "    claude doctor is the read-only CLI form. The fuller checkup, which can also FIX"
echo "    issues, is /doctor inside a session — it has no CLI equivalent. Run it yourself"
echo "    and record anything it reports. This script deliberately does not pretend to."

exit $found
