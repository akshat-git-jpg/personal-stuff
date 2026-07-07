#!/bin/bash
# boss-session-start.sh — the session's catch-up surface.
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
boss_ensure_labels
# Dirty-main-checkout guard: greenlight refuses to land onto a REPO_TOPLEVEL with
# any uncommitted tracked changes (it "never stashes or switches"), so a dirty
# main silently blocks EVERY merge in a batch with a "main checkout busy" park.
# Surface it up front so it's dealt with before dispatch, not discovered mid-land.
dirty=$(boss_repo_dirty)
if [ -n "$dirty" ]; then
  echo "== ⚠️  MAIN CHECKOUT DIRTY (blocks greenlight land — clean before merging) =="
  echo "$dirty" | sed 's/^/  /'
  echo "  → commit, stash, or revert these in $REPO_ROOT before running boss-merge."
fi
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
# Only show PRs boss is still working. A landed PR keeps its state/*.meta (deploy
# may still need it) but is boss:done/closed — not in-flight — so skip those.
for m in "$STATE_DIR"/*.meta; do
  [ -e "$m" ] || continue; n=$(basename "$m" .meta)
  st=$(gh pr view "$n" --json state,labels -q '"\(.state) \(.labels[].name)"' 2>/dev/null)
  case "$st" in *boss:done*|CLOSED*|MERGED*) continue;; esac
  "$BOSS_HOME/bin/boss-state.sh" "$n"
done
# Orphan check: a PR is boss:in-progress on GitHub but has no local meta — its crew
# was lost (state/ is gitignored + machine-local, so a wiped dir or a different
# machine orphans it). Surface it; it needs a manual re-dispatch or label reset.
echo "== orphaned in-progress (on GitHub, no local state — needs reconcile) =="
for n in $(gh pr list --state open --label boss:in-progress --json number -q '.[].number' 2>/dev/null); do
  [ -f "$STATE_DIR/$n.meta" ] || echo "  ORPHAN  #$n — boss:in-progress but no state/$n.meta (re-dispatch or reset label)"
done
