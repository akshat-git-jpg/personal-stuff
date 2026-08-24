#!/bin/bash
# crons - did the scheduled work actually happen.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
#
# CRONS_LAUNCHD points at a fixture MAC-LAUNCHD.md. CRONS_SSH=1 enables VPS guidance.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

LAUNCHD_DOC="${CRONS_LAUNCHD:-$REPO_ROOT/MAC-LAUNCHD.md}"
STALE_DAYS="${CRONS_STALE_DAYS:-14}"

found=0
note() { echo "- $1"; found=1; }

echo "# crons findings - $(today)"
echo

[ -f "$LAUNCHD_DOC" ] || die "no launchd inventory at $LAUNCHD_DOC"

echo "## 1. launchd jobs - loaded, and writing a log"
# The Logs table gives one row per job: | <job> | `<path>` |
while IFS='|' read -r _ job logp _; do
  job="$(echo "$job" | tr -d ' ')"
  logp="$(echo "$logp" | tr -d ' `')"
  [ -n "$job" ] || continue
  case "$logp" in
    '~'*) logp="$HOME${logp#\~}" ;;
  esac
  if [ ! -f "$logp" ]; then
    note "NO-LOG $job (expected $logp, not there; the job may never have run)"
  elif [ -n "$("$FIND" "$logp" -mtime +"$STALE_DAYS" 2>/dev/null)" ]; then
    note "STALE-LOG $job (last written over $STALE_DAYS days ago: $logp)"
  fi
done < <("$GREP" -oE '^\| *[a-z0-9.-]+ *\| *`[^`]+` *\|' "$LAUNCHD_DOC")
echo

echo "## 2. launchd jobs documented but not loaded"
if command -v launchctl >/dev/null 2>&1; then
  loaded="$(launchctl list 2>/dev/null | "$AWK" '{print $3}')"
  while read -r lbl; do
    echo "$loaded" | "$GREP" -qxF "$lbl" || note "NOT-LOADED $lbl (documented, not in launchctl list)"
  done < <("$GREP" -oE '`com\.[a-z0-9.-]+`' "$LAUNCHD_DOC" | tr -d '`' | sort -u)
else
  echo "- launchctl not available on this machine; skipped"
fi
echo

echo "## 3. VPS crons"
if [ "${CRONS_SSH:-0}" = "1" ]; then
  echo "- SSH probe requested. See runbook.md for the exact read-only command and log paths."
else
  echo "- NOT CHECKED. The canonical crontab lives at /srv/crons/crontab.txt on the VPS,"
  echo "  in the separate vps-crons repo, so confirming a run needs SSH. Set CRONS_SSH=1"
  echo "  to probe deliberately. Silence here is 'not checked', never 'fine'."
fi

exit $found
