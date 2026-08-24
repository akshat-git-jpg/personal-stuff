#!/usr/bin/env bash
#
# Delete old per-video folders under ~/yt-claude.
#
# The relay creates ~/yt-claude/<videoid>/ per summarised video and NOTHING ever
# removed it — 142 folders had accumulated by 2026-08-24, roughly 13 MB/year.
# Disk is not the issue; ~/yt-claude is the cwd every summarise session starts
# in, so the clutter is what costs you.
#
# Safety: only ever touches directories whose name is exactly an 11-character
# YouTube id, and only direct children of the root. `pinterest-mcp/`, `pending/`
# and loose files match neither, so they cannot be hit. Tested in test-prune.sh,
# where the refusal cases are the point.
#
# Written for macOS's /bin/bash, which is 3.2 — no mapfile, no associative
# arrays, and an empty array is "unset" under `set -u`. Hence the temp file.
#
# Usage:
#   prune.sh              # delete folders older than $YT_PRUNE_DAYS (default 30)
#   prune.sh --dry-run    # list what WOULD go, delete nothing
#   YT_PRUNE_DAYS=7 prune.sh
#
# Installed as a weekly launchd job — see com.kushal.yt-claude-prune.plist.
set -euo pipefail

ROOT="${YT_CLAUDE_DIR:-$HOME/yt-claude}"
DAYS="${YT_PRUNE_DAYS:-30}"
DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

ts() { date '+%Y-%m-%d %H:%M:%S'; }

[ -d "$ROOT" ] || { echo "$(ts) prune: $ROOT does not exist, nothing to do"; exit 0; }

case "$DAYS" in
  ''|*[!0-9]*)
    echo "$(ts) prune: YT_PRUNE_DAYS must be a whole number, got '$DAYS'" >&2
    exit 1 ;;
esac

list="$(mktemp)"
trap 'rm -f "$list"' EXIT

find "$ROOT" -maxdepth 1 -type d \
     -regex '.*/[A-Za-z0-9_-]\{11\}$' \
     -mtime +"$DAYS" \
     -print 2>/dev/null | sort > "$list"

count=$(wc -l < "$list" | tr -d ' ')

if [ "$count" -eq 0 ]; then
  echo "$(ts) prune: nothing older than ${DAYS}d in $ROOT"
  exit 0
fi

freed_kb=0
while IFS= read -r d; do
  [ -n "$d" ] || continue
  kb=$(du -sk "$d" | cut -f1)
  freed_kb=$((freed_kb + kb))
done < "$list"

if [ "$DRY" -eq 1 ]; then
  echo "$(ts) prune: DRY RUN — $count folders older than ${DAYS}d, ${freed_kb} KB"
  sed 's/^/  /' "$list"
  exit 0
fi

removed=0
while IFS= read -r d; do
  [ -n "$d" ] || continue
  # Belt and braces: re-check the shape before removing anything. `find` already
  # guaranteed it, but this runs unattended and deletes directories.
  base=$(basename "$d")
  case "$base" in
    ???????????) : ;;
    *) echo "$(ts) prune: REFUSING unexpected name '$base'" >&2; continue ;;
  esac
  rm -rf -- "$d"
  removed=$((removed + 1))
done < "$list"

echo "$(ts) prune: removed $removed folders older than ${DAYS}d, freed ${freed_kb} KB"
