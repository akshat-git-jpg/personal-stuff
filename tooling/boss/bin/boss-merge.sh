#!/bin/bash
# boss-merge.sh <pr#> — land a finished PR via greenlight, record DONE, offer deploy.
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
pr="${1:?usage: boss-merge.sh <pr#>}"
branch=$(meta_get "$pr" branch); slug=$(meta_get "$pr" slug)
test_cmd=$(meta_get "$pr" test_cmd); wt=$(meta_get "$pr" worktree)

# Free the dispatch worktree BEFORE greenlight runs. git refuses to check out a
# branch already held by another worktree, so greenlight (which leases its own
# worktree and checks out $branch) would park with a checkout error while the
# crew's dispatch worktree still holds it. The crew's commits live on the branch
# ref, which survives the worktree return, so this is lossless.
if [ -n "$wt" ] && [ -d "$wt" ]; then
  wt return "$wt" 2>/dev/null || true
fi

# greenlight exits 0 on BOTH land and park (park() writes state=parked, exit 0),
# so the exit code alone can't tell success from a parked verify-failure. Read
# greenlight's own state file for the truth. RUN_ID = <timestamp>-<branch-slug>;
# find the newest run dir matching this branch.
gl_root="${GREENLIGHT_STATE_ROOT:-$HOME/kb-scratch/greenlight}"
branch_slug=$(echo "$branch" | tr '/' '-' | tr -cd 'a-zA-Z0-9-')
"$REPO_ROOT/tooling/cli/greenlight/greenlight" run --branch "$branch" --verify "$test_cmd" || true
run_dir=$(ls -dt "$gl_root"/*-"$branch_slug" 2>/dev/null | head -1)
gl_state=$(cat "$run_dir/state" 2>/dev/null || echo unknown)
gl_reason=$(cat "$run_dir/parked-reason" 2>/dev/null || echo "")

if [ "$gl_state" != "landed" ]; then
  # "main checkout busy" / "--no-land" are transient: another land holds the
  # checkout, or landing was deliberately deferred. Leave the PR in-progress and
  # retryable — do NOT burn boss:blocked (which spends the single fix-up round)
  # on a condition that clears itself.
  case "$gl_reason" in
    "main checkout busy"|"--no-land")
      boss_notify "boss:retry PR#$pr — greenlight deferred ($gl_reason); still in-progress, retry the merge later"
      echo "PR#$pr not landed (transient: $gl_reason) — left boss:in-progress, retry later"; exit 3 ;;
    *)
      gh pr edit "$pr" --remove-label boss:in-progress --add-label boss:blocked
      boss_notify "boss:blocked PR#$pr — greenlight parked (${gl_reason:-$gl_state})"
      echo "PR#$pr parked by greenlight (${gl_reason:-$gl_state}) — see $gl_root/"; exit 2 ;;
  esac
fi

# Landed on main. Record DONE in the plan registry (main checkout, serialized).
# Guard: only record on the main checkout — greenlight lands onto REPO_TOPLEVEL's
# main, but never commit the bookkeeping row onto whatever branch happens to be
# checked out here (e.g. an aglock-steered executing branch).
title=$(gh pr view "$pr" --json title -q .title 2>/dev/null)
readme="$REPO_ROOT/plans/README.md"
if [ "$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)" != "main" ]; then
  echo "WARN: $REPO_ROOT not on main — skipping plans/README.md record for PR#$pr (landed, but bookkeeping deferred)" >&2
elif ! grep -q "boss:$slug" "$readme" 2>/dev/null; then
  # Append a one-line record to a dedicated "boss-landed" list at end of file (idempotent).
  grep -q '^## boss-landed' "$readme" || printf '\n## boss-landed\n' >> "$readme"
  printf -- '- %s — PR#%s %s — DONE\n' "$slug" "$pr" "${title:-}" >> "$readme"
  ( cd "$REPO_ROOT" && git add plans/README.md && git commit -q -m "boss: record $slug (PR#$pr) landed" && git push -q origin main )
fi

gh pr edit "$pr" --remove-label boss:in-progress --add-label boss:done 2>/dev/null || true
# greenlight lands by merging the branch into main directly (not via the PR
# merge button), so GitHub leaves the PR OPEN. Close it explicitly with a
# landing comment — boss:done is the state, closed is the lifecycle.
gh pr close "$pr" --comment "Landed on main via greenlight (merged directly; closing)." 2>/dev/null \
  || gh pr comment "$pr" --body "Landed on main via greenlight." 2>/dev/null || true
[ -n "$wt" ] && wt return "$wt" 2>/dev/null || true
boss_notify "boss:merged PR#$pr ($slug) landed on main"
echo "PR#$pr merged. If the plan has a deploy, run: tooling/boss/bin/boss-deploy.sh $pr --yes"
