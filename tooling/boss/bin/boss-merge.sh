#!/bin/bash
# boss-merge.sh <pr#> — land a finished PR via greenlight, record DONE, offer deploy.
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
pr="${1:?usage: boss-merge.sh <pr#>}"
branch=$(meta_get "$pr" branch); slug=$(meta_get "$pr" slug)
test_cmd=$(meta_get "$pr" test_cmd); wt=$(meta_get "$pr" worktree)

if ! "$REPO_ROOT/tooling/cli/greenlight/greenlight" run --branch "$branch" --verify "$test_cmd"; then
  gh pr edit "$pr" --remove-label boss:in-progress --add-label boss:blocked
  boss_notify "boss:blocked PR#$pr — greenlight parked (test_cmd failed or checkout busy)"
  echo "PR#$pr parked by greenlight — see ~/kb-scratch/greenlight/"; exit 2
fi

# Landed on main. Record DONE in the plan registry (main checkout, serialized).
title=$(gh pr view "$pr" --json title -q .title 2>/dev/null)
readme="$REPO_ROOT/plans/README.md"
if ! grep -q "boss:$slug" "$readme" 2>/dev/null; then
  # Append a record row under the status table's last row is fragile; instead append a
  # one-line record to a dedicated "boss-landed" list at end of file (idempotent).
  grep -q '^## boss-landed' "$readme" || printf '\n## boss-landed\n' >> "$readme"
  printf -- '- %s — PR#%s %s — DONE\n' "$slug" "$pr" "${title:-}" >> "$readme"
  ( cd "$REPO_ROOT" && git add plans/README.md && git commit -q -m "boss: record $slug (PR#$pr) landed" && git push -q origin main )
fi

gh pr edit "$pr" --remove-label boss:in-progress --add-label boss:done 2>/dev/null || true
gh pr comment "$pr" --body "Landed on main via greenlight." 2>/dev/null || true
[ -n "$wt" ] && wt return "$wt" 2>/dev/null || true
boss_notify "boss:merged PR#$pr ($slug) landed on main"
echo "PR#$pr merged. If the plan has a deploy, run: tooling/boss/bin/boss-deploy.sh $pr --yes"
