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
  # Take the LAST digit run anywhere in the holder, not the text after the last dash.
  # ${holder##*-} mapped boss-<pr> and boss-mut-<pr> and SILENTLY skipped anything with
  # a trailing suffix: on 2026-08-23 boss-197fix and boss-197ver sat on two of eight
  # slots for five hours while this sweep printed "none — every leased slot belongs to
  # an open PR". A holder this cannot map is now REPORTED, never skipped in silence,
  # because a silent skip is indistinguishable from a clean pool.
  pr=$(printf '%s' "$holder" | grep -oE '[0-9]+' | tail -1)
  if [ -z "$pr" ]; then
    lease_sweep_found=1
    echo "  UNMAPPABLE holder=$holder holds a worktree slot — no PR number in it; check by hand"
    continue
  fi
  st=$(gh pr view "$pr" --json state -q .state 2>/dev/null)
  [ -n "$st" ] || continue
  [ "$st" = "OPEN" ] && continue
  lease_sweep_found=1
  echo "  #$pr is $st but still holds a worktree slot (holder=$holder) — freeing"
  wt release --holder "$holder" --repo "$REPO_ROOT" 2>&1 | sed 's/^/    /'
done < <(wt status --repo "$REPO_ROOT" 2>/dev/null)
[ "$lease_sweep_found" -eq 0 ] && echo "  none — every leased slot belongs to an open PR"

# Blocked lands (2026-08-23, plan 229). THE catch-up path: a land blocks whenever a rebase
# conflicts or a verify fails, and the owner ruled out both notifications and their own
# involvement — so if no boss session was open when it blocked, nothing else re-drives it.
# The sweep dispatches what it can and LISTS the rest, so a capped or held land stays
# visible here without becoming a notification. It runs under its own state namespace, so
# nothing it writes shows up in the in-flight loop above.
echo "== blocked lands (fix-ups dispatched into the workspace that already exists) =="
"$BOSS_HOME/bin/boss-land-sweep.sh" 2>&1 | sed 's/^/  /'

# Idle workspaces (2026-08-23). A land no longer removes the workspace it came from --
# one session commits many times into one workspace -- so reclaiming is a separate, later
# step. Running it HERE makes it the catch-up path as well: a workspace whose session died
# is reclaimed the next time boss opens. reap refuses anything dirty, unmerged, holding
# renders, or touched inside the grace window, so it can never take live work.
# Uncommitted workspace work. This runs BEFORE reap on purpose. reap checks idleness FIRST
# and prints "in use (touched inside the grace window)" for anything touched in the last 4h,
# never mentioning that it holds uncommitted work — so the freshest, most-likely-forgotten
# work was the only work this screen was silent about (found 2026-08-23, while the owner was
# being told the opposite). `list --dirty` is the fix: it prints only rows that need a human,
# and it is also the one place a BRANCH-MISMATCH workspace becomes visible.
# Is the lander even armed? The post-commit hook is UNTRACKED — only scripts/relink.sh
# installs it, and nothing on this Mac re-runs relink on its own. The failure is asymmetric
# and that is what makes it dangerous: a missing pre-push makes pp-push refuse loudly, but a
# missing post-commit is TOTAL SILENCE — no land, no .blocked entry, no log line, and every
# workspace commit simply stops reaching main.
echo "== lander armed? =="
_hooks_dir="$(git -C "$REPO_ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)/hooks"
for _h in post-commit pre-push pre-commit; do
  if [ -x "$_hooks_dir/$_h" ]; then
    echo "  ok $_h"
  else
    echo "  MISSING $_h — commits will not land. Run: bash scripts/relink.sh"
  fi
done

echo "== workspaces needing attention (uncommitted / unlanded / mismatched / snapshotted) =="
"$REPO_ROOT/tooling/cli/pp-work/pp-work" list --dirty 2>&1 | sed 's/^/  /' || true

# A rescue snapshot for anything still dirty. `stash create` + a private ref records the tree
# without committing it — deliberately NOT a commit, because a commit in a workspace IS a
# trigger here (post-commit -> pp-land -> push to main), so a "just in case" commit would ship
# unreviewed work to production. This is the backstop for a session that died mid-turn, which
# no in-process hook can catch.
echo "== rescue snapshots for dirty workspaces =="
"$REPO_ROOT/tooling/cli/pp-work/pp-work" snapshot --all 2>&1 | sed 's/^/  /' || true

echo "== idle workspaces (reclaimed only when clean, merged and untouched) =="
"$REPO_ROOT/tooling/cli/pp-work/pp-work" reap 2>&1 | sed 's/^/  /' || true
