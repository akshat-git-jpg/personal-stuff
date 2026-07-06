#!/bin/bash
# boss-session-start.sh — the session's catch-up surface.
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
boss_ensure_labels
echo "== recently landed / blocked =="
gh pr list --state all  --label boss:done    --limit 10 --json number,title -q '.[] | "  done    #\(.number) \(.title)"' 2>/dev/null
gh pr list --state open --label boss:blocked --limit 20 --json number,title -q '.[] | "  BLOCKED #\(.number) \(.title)"' 2>/dev/null
echo "== boss:ready queue (oldest first) =="
gh pr list --state open --label boss:ready --json number,title,createdAt \
  -q 'sort_by(.createdAt) | .[] | "  ready   #\(.number) \(.title)  (raised \(.createdAt))"' 2>/dev/null
echo "== in-flight =="
for m in "$STATE_DIR"/*.meta; do [ -e "$m" ] || continue; "$BOSS_HOME/bin/boss-state.sh" "$(basename "$m" .meta)"; done
