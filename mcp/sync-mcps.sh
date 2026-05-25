#!/usr/bin/env bash
# Sync MCP server code between personal stuff/mcp/ and TY/mcp/.
#
# These two trees are intentionally duplicated (see memory:
# mcp-shared-across-personal-and-ty). Edit MCPs in either side, then run
# this script to mirror to the other side.
#
# Usage:
#   ./sync-mcps.sh                  # personal stuff/mcp/  --> TY/mcp/   (default)
#   ./sync-mcps.sh --reverse        # TY/mcp/              --> personal stuff/mcp/
#   ./sync-mcps.sh --dry-run        # preview without copying
#
# Always-excluded paths (never overwrite on either side, since they're
# machine/account-specific):
#   __pycache__/, .venv/, *.pyc
#   google-shared/credentials.json, google-shared/tokens/
#   **/.env

set -euo pipefail

PERSONAL="/Users/kbtg/codebase/personal stuff/mcp/"
TY="/Users/kbtg/codebase/TY/mcp/"

SRC="$PERSONAL"
DST="$TY"
DIRECTION="personal stuff/mcp/ → TY/mcp/"
DRY=""

for arg in "$@"; do
  case "$arg" in
    --reverse)
      SRC="$TY"; DST="$PERSONAL"
      DIRECTION="TY/mcp/ → personal stuff/mcp/"
      ;;
    --dry-run)
      DRY="--dry-run"
      ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

echo "Syncing: $DIRECTION ${DRY:+(DRY RUN)}"
echo

rsync -av --delete $DRY \
  --exclude='__pycache__/' \
  --exclude='.venv/' \
  --exclude='*.pyc' \
  --exclude='google-shared/credentials.json' \
  --exclude='google-shared/tokens/' \
  --exclude='*.env' \
  --exclude='.env' \
  "$SRC" "$DST"

echo
echo "Done."
