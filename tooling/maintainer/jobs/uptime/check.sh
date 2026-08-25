#!/bin/bash
# uptime - are the deployed surfaces up, and do the inventories agree.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
#
# UPTIME_SITES / UPTIME_INFRA point at fixtures. UPTIME_PROBE=1 makes real requests.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

SITES="${UPTIME_SITES:-$REPO_ROOT/my-hosted-sites.md}"
INFRA="${UPTIME_INFRA:-$REPO_ROOT/INFRA.md}"

found=0
note() { echo "- $1"; found=1; }

echo "# uptime findings - $(today)"
echo

[ -f "$SITES" ] || die "no site index at $SITES"

echo "## 1. inventory drift - a URL in one doc and not the other"
urls_s="$("$GREP" -oE 'https?://[a-zA-Z0-9./_-]+' "$SITES" | "$SED" 's|/*$||' | sort -u)"
urls_i=""
[ -f "$INFRA" ] && urls_i="$("$GREP" -oE 'https?://[a-zA-Z0-9./_-]+' "$INFRA" | "$SED" 's|/*$||' | sort -u)"
for u in $urls_i; do
  echo "$urls_s" | "$GREP" -qxF "$u" || note "IN-INFRA-NOT-SITES $u"
done
echo
echo "  (the reverse direction is NOT a defect: my-hosted-sites.md is the flat index of"
echo "   every live URL, so it legitimately holds more than INFRA.md.)"
echo

echo "## 2. reachability"
if [ "${UPTIME_PROBE:-0}" = "1" ]; then
  if out="$(bash "$REPO_ROOT/scripts/probe-sites.sh" 2>&1)"; then
    echo "- all probed sites reachable"
  else
    echo "$out" | "$GREP" 'DOWN_SITES:' | while read -r line; do echo "- $line"; done
    found=1
  fi
else
  echo "- skipped (set UPTIME_PROBE=1; it makes real network requests)"
fi
echo

echo "## 3. app checks"
if [ "${UPTIME_APPS:-0}" = "1" ]; then
  bash "$REPO_ROOT/scripts/check-apps.sh" >/dev/null 2>&1 || note "check-apps.sh reported a failing app"
else
  echo "- skipped (set UPTIME_APPS=1; it installs and runs every app's test suite)"
fi

exit $found
