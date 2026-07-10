#!/usr/bin/env bash
# argo-logs.sh — pull dbt container logs from a shared prod Argo Workflows link.
#
# Usage:
#   argo-logs.sh <argo-url-or-id> [--all] [--grep PATTERN] [--tail N] [--list]
#
# <argo-url-or-id> accepts any of:
#   https://.../archived-workflows/<ns>/<uid>      (archived link — has the UID)
#   https://.../workflows/<ns>/<name>              (live link — has the name)
#   <uid>                                          (bare archived UID)
#   <name>                                         (bare live workflow name)
#
# Modes:
#   (default)      per failed node: status line + last 60 log lines
#   --all          full logs (no tail)
#   --grep PAT     only lines matching PAT (case-insensitive); dbt errors:
#                    --grep 'ERROR|Database Error|Completed with|exit code'
#   --tail N       tail N lines instead of 60
#   --list         just list node phases/messages, no logs
#
# Notes:
#   * Archived (GC'd) runs are the common case for a *failed* dbt job. The archived
#     link carries the UID, which is all we need. A live NAME cannot be resolved to a
#     UID with this token (the archived-list endpoint 403s), so if a live link 404s,
#     open the run in the UI and copy the "Archived Workflows" link instead.
#   * Logs come from the S3 artifact repo (artifact name `main-logs` per pod node).

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$HERE/../references/prod-argo.env"

MODE="tail"; TAILN=60; PATTERN=""; INPUT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --all) MODE="all";;
    --list) MODE="list";;
    --tail) TAILN="$2"; shift;;
    --grep) MODE="grep"; PATTERN="$2"; shift;;
    -*) echo "unknown flag: $1" >&2; exit 2;;
    *) INPUT="$1";;
  esac
  shift
done
[ -n "$INPUT" ] || { echo "usage: argo-logs.sh <argo-url-or-id> [--all|--grep PAT|--tail N|--list]" >&2; exit 2; }

curl_argo() { curl -sS -m 60 -H "Authorization: Bearer $ARGO_TOKEN" "$@"; }

# --- parse input into KIND (archived|live) + ID (uid|name) -------------------
KIND=""; ID=""
if [[ "$INPUT" == *"/archived-workflows/"* ]]; then
  KIND="archived"; ID="${INPUT##*/}"
elif [[ "$INPUT" == *"/workflows/"* ]]; then
  KIND="live"; ID="${INPUT##*/}"
elif [[ "$INPUT" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
  KIND="archived"; ID="$INPUT"   # bare UID
else
  KIND="live"; ID="$INPUT"       # bare name
fi
ID="${ID%%\?*}"  # strip any query string

emit_log() { # reads log on stdin, applies MODE
  case "$MODE" in
    all)  cat;;
    grep) grep -iE "$PATTERN" || true;;
    *)    tail -n "$TAILN";;
  esac
}

if [ "$KIND" = "live" ]; then
  echo "### LIVE workflow: $ID (ns=$ARGO_NS)"
  HTTP=$(curl_argo -o /dev/null -w '%{http_code}' \
    "$ARGO_BASE/api/v1/workflows/$ARGO_NS/$ID") || true
  if [ "$HTTP" = "404" ]; then
    echo "  live workflow not found (garbage-collected)." >&2
    echo "  Open the run in the Argo UI and paste the ARCHIVED link (it contains the UID)." >&2
    exit 3
  fi
  [ "$MODE" = "list" ] && { curl_argo "$ARGO_BASE/api/v1/workflows/$ARGO_NS/$ID" \
    | python3 "$HERE/_nodes.py"; exit 0; }
  # live logs stream as NDJSON {"result":{"content":...}}
  curl_argo "$ARGO_BASE/api/v1/workflows/$ARGO_NS/$ID/log?logOptions.container=main" \
    | python3 -c 'import sys,json
for line in sys.stdin:
    line=line.strip()
    if not line: continue
    try: print(json.loads(line)["result"]["content"])
    except Exception: pass' | emit_log
  exit 0
fi

# --- archived path -----------------------------------------------------------
echo "### ARCHIVED workflow uid=$ID (ns=$ARGO_NS)"
WF=$(mktemp)
curl_argo "$ARGO_BASE/api/v1/archived-workflows/$ID" -o "$WF"
python3 "$HERE/_nodes.py" < "$WF"
[ "$MODE" = "list" ] && { rm -f "$WF"; exit 0; }

# for each FAILED pod node, fetch its log artifact
while IFS=$'\t' read -r NODE ART DISP; do
  [ -z "$NODE" ] && continue
  echo ""
  echo "===== node $DISP ($NODE) — artifact $ART ====="
  curl_argo "$ARGO_BASE/artifact-files/$ARGO_NS/archived-workflows/$ID/$NODE/outputs/$ART" \
    | emit_log
done < <(python3 "$HERE/_nodes.py" --failed-pods < "$WF")
rm -f "$WF"
