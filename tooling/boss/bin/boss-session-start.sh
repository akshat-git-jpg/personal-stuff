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
echo "== gapped (raised but NOT ready — plan needs a fix, run /secretary groom) =="
gh pr list --state open --label gap:test-cmd,gap:open-points --json number,title,labels \
  -q '.[] | "  gap     #\(.number) \(.title)  [\([.labels[].name|select(.=="gap:test-cmd" or .=="gap:open-points")]|join(","))]"' 2>/dev/null
echo "== in-flight (local state/) =="
for m in "$STATE_DIR"/*.meta; do [ -e "$m" ] || continue; "$BOSS_HOME/bin/boss-state.sh" "$(basename "$m" .meta)"; done
# Orphan check: a PR is boss:in-progress on GitHub but has no local meta — its crew
# was lost (state/ is gitignored + machine-local, so a wiped dir or a different
# machine orphans it). Surface it; it needs a manual re-dispatch or label reset.
echo "== orphaned in-progress (on GitHub, no local state — needs reconcile) =="
for n in $(gh pr list --state open --label boss:in-progress --json number -q '.[].number' 2>/dev/null); do
  [ -f "$STATE_DIR/$n.meta" ] || echo "  ORPHAN  #$n — boss:in-progress but no state/$n.meta (re-dispatch or reset label)"
done
