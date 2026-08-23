#!/bin/bash
# boss-session-start.sh — the session's catch-up surface.
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
boss_assert_gh || exit 1
# test_cmd timeouts need a `timeout`-compatible binary; without it a hanging
# verify freezes a merge (2026-07-08 incident). Dispatch/merge hard-fail when it's
# missing — warn loudly here so it's fixed before any dispatch.
boss_timeout_bin >/dev/null || echo "== ⚠️  NO gtimeout/timeout ON PATH — test_cmd timeouts DISABLED; a hang will freeze a merge. Fix: brew install coreutils =="
boss_ensure_labels
# Dirty-main-checkout guard: greenlight refuses to land onto a REPO_TOPLEVEL with
# any uncommitted tracked changes (it "never stashes or switches"), so a dirty
# main silently blocks EVERY merge in a batch with a "main checkout busy" park.
# Surface it up front so it's dealt with before dispatch, not discovered mid-land.
dirty=$(boss_repo_dirty)
onbranch=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ "$onbranch" != "main" ]; then
  echo "== ⚠️  CHECKOUT NOT ON MAIN (on '$onbranch') =="
  echo "  Merges still work — greenlight lands from inside the worktree (cbc9e6b7)."
  echo "  But boss-merge SKIPS the plans/README.md landing record, so the registry drifts."
  echo "  Switch to main when the branch work is done, then reconcile the registry."
fi
if [ -n "$dirty" ]; then
  echo "== ℹ️  checkout has uncommitted tracked changes (informational) =="
  echo "$dirty" | sed 's/^/  /'
  echo "  This does NOT block merges. boss leaves it alone — it may be another session's work."
fi
# Concurrent-session guard (2026-08-02). Another Claude/agy session working in
# this repo re-dirties main under you: it parked merges repeatedly, re-created the
# same rebase conflict three times on one file, and landed two main-breaking
# regressions that blocked an unrelated PR for hours. boss cannot detect this from
# git alone (the tree just looks dirty again), so name the actual cause up front.
others=$(ps -eo pid=,args= 2>/dev/null \
  | grep -E '(^| )(claude|agy)( |$)' | grep -v 'bg-spare\|bg-pty-host\|daemon run\|grep' \
  | grep -vw "$$" | awk '{print $1}' | head -8)
mine=$(ps -o ppid= -p $$ 2>/dev/null | tr -d ' ')
others=$(echo "$others" | grep -vw "${mine:-0}" | tr '\n' ' ' | sed 's/ *$//')
if [ -n "$others" ]; then
  echo "== ⚠️  OTHER claude/agy SESSION(S) RUNNING (pids: $others) =="
  echo "  If one is working in this repo it WILL re-dirty main and re-conflict your branches."
  echo "  Confirm what it is before dispatching; boss will not touch its uncommitted work."
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
  # Local terminal marker: skip with no network call. This is what makes startup O(1)
  # in the number of long-finished PRs.
  [ -n "$(meta_get "$n" terminal 2>/dev/null)" ] && continue
  st=$(gh pr view "$n" --json state,labels -q '"\(.state) \(.labels[].name)"' 2>/dev/null)
  case "$st" in
    *boss:done*|CLOSED*|MERGED*)
      # Back-fill the marker we just learned, so this meta costs nothing next time.
      # No pruning: boss-deploy.sh still needs a landed PR's meta.
      meta_set "$n" terminal done
      continue ;;
  esac
  "$BOSS_HOME/bin/boss-state.sh" "$n"
done
# Orphan check: a PR is boss:in-progress on GitHub but has no local meta — its crew
# was lost (state/ is gitignored + machine-local, so a wiped dir or a different
# machine orphans it). Surface it; it needs a manual re-dispatch or label reset.
echo "== orphaned in-progress (on GitHub, no local state — needs reconcile) =="
for n in $(gh pr list --state open --label boss:in-progress --json number -q '.[].number' 2>/dev/null); do
  [ -f "$STATE_DIR/$n.meta" ] || echo "  ORPHAN  #$n — boss:in-progress but no state/$n.meta (re-dispatch or reset label)"
done

# Worktree-lease sweep (2026-08-22). boss-dispatch leases a pool slot per PR, but
# only ever RETURNS it on an error path or after a successful boss-merge. A PR that
# dies, gets blocked, or is abandoned keeps its slot forever, and `wt get`'s only
# liveness test is "does the lease file exist" — so the leak is permanent and the
# pool only ever shrinks. Four of eight slots had leaked by 2026-08-22 (one held
# 25 days by a PR merged weeks earlier); the next leak would have starved dispatch
# with `ERROR: pool full`.
#
# The signal is the PR's STATE, never its labels: PR#152 and #153 were both MERGED
# and *still* labelled boss:in-progress, so a label check would have called them live.
echo "== worktree leases held by finished PRs =="
lease_sweep_found=0
while IFS= read -r line; do
  case "$line" in ''|N' '*) continue;; esac
  holder=$(echo "$line" | awk '{print $3}')
  case "$holder" in boss-*) ;; *) continue;; esac
  pr=${holder##*-}
  case "$pr" in ''|*[!0-9]*) continue;; esac
  st=$(gh pr view "$pr" --json state -q .state 2>/dev/null)
  [ -n "$st" ] || continue
  [ "$st" = "OPEN" ] && continue
  lease_sweep_found=1
  echo "  #$pr is $st but still holds a worktree slot (holder=$holder) — freeing"
  wt release --holder "$holder" --repo "$REPO_ROOT" 2>&1 | sed 's/^/    /'
done < <(wt status --repo "$REPO_ROOT" 2>/dev/null)
[ "$lease_sweep_found" -eq 0 ] && echo "  none — every leased slot belongs to an open PR"
