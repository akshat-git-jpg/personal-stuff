#!/bin/bash
# token-budget — where are tokens going.
# Reports; changes no configuration.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

found=0
note() { echo "- $1"; found=1; }

echo "# token-budget findings — $(today)"
echo

echo "## 1. rtk savings so far"
if command -v rtk >/dev/null 2>&1; then
  rtk gain 2>&1 | "$SED" 's/^/    /'
else
  note "rtk not on PATH — every shell command is costing full tokens"
fi
echo

echo "## 2. missed savings (rtk discover)"
if command -v rtk >/dev/null 2>&1; then
  rtk discover 2>&1 | head -40 | "$SED" 's/^/    /'
  echo "    (truncated to 40 lines; run 'rtk discover' for the rest)"
else
  echo "    skipped — rtk not on PATH"
fi
echo

echo "## 3. per-account usage"
if command -v ccusage >/dev/null 2>&1; then
  for acct in "$HOME/.claude-work" "$HOME/.claude-personal"; do
    [ -d "$acct" ] || continue
    echo "    --- $(basename "$acct") ---"
    CLAUDE_CONFIG_DIR="$acct" ccusage 2>&1 | head -12 | "$SED" 's/^/    /'
  done
  echo "    (~/.claude is a LEGACY dir, not the work account — do not read it as one)"
else
  echo "    skipped — ccusage not installed"
fi
echo

echo "## 4. context breakdown — SESSION-STEP, not automatable"
echo "    /context has no CLI form. It is the only thing that shows how much of the window"
echo "    the system prompt, tools, MCP servers, skills and memory files each consume."
echo "    Run /context in a session and paste the breakdown into the proposal. This script"
echo "    will not fake it, and an absent breakdown must read as 'not measured', never as"
echo "    'nothing to report'."

exit $found
