#!/bin/bash
# boss-dispatch.sh <pr#> [--executor <e>] [--model <m>]
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
pr="${1:?usage: boss-dispatch.sh <pr#> [--executor e] [--model m]}"; shift
exec_override=""; model_override=""
while [ $# -gt 0 ]; do case "$1" in
  --executor) exec_override="$2"; shift 2;; --model) model_override="$2"; shift 2;;
  *) echo "unknown arg $1" >&2; exit 2;; esac; done

branch=$(gh pr view "$pr" --json headRefName -q .headRefName) || { echo "no such PR $pr" >&2; exit 1; }
case "$branch" in boss/*) ;; *) echo "PR $pr branch '$branch' not boss/* — refusing" >&2; exit 1;; esac
slug=$(slug_of "$branch"); planpath="plans/$slug.md"

git -C "$REPO_ROOT" fetch -q origin "$branch"
plan_tmp="$STATE_DIR/$pr.plan"
git -C "$REPO_ROOT" show "origin/$branch:$planpath" > "$plan_tmp" 2>/dev/null \
  || { echo "PR $pr: $planpath missing on branch" >&2; exit 1; }
executor="${exec_override:-$(fm_get executor "$plan_tmp")}"; [ -n "$executor" ] || executor="claude-p"
model="${model_override:-$(fm_get model "$plan_tmp")}"
test_cmd="$(fm_get test_cmd "$plan_tmp")"
[ -n "$test_cmd" ] || { echo "PR $pr: test_cmd missing in frontmatter — refusing" >&2; exit 1; }
[ -f "$BOSS_HOME/executors/$executor.sh" ] || { echo "no executor '$executor'" >&2; exit 1; }

gh pr edit "$pr" --remove-label boss:ready --add-label boss:in-progress

wt=$(wt get --holder "boss-$pr")
git -C "$wt" fetch -q origin "$branch" main
git -C "$wt" checkout -B "$branch" "origin/$branch"
if ! git -C "$wt" merge --no-edit origin/main; then
  gh pr edit "$pr" --remove-label boss:in-progress --add-label boss:blocked
  boss_notify "boss:blocked PR#$pr — stale, main-merge conflict"
  wt return "$wt"; echo "PR#$pr blocked (stale)"; exit 2
fi

: > "$STATE_DIR/$pr.meta"
meta_set "$pr" branch "$branch"; meta_set "$pr" slug "$slug"; meta_set "$pr" worktree "$wt"
meta_set "$pr" executor "$executor"; meta_set "$pr" model "$model"; meta_set "$pr" test_cmd "$test_cmd"
meta_set "$pr" planpath "$planpath"

brief="$STATE_DIR/$pr.brief.md"
cat > "$brief" <<EOF
You are a boss crew member. Implement exactly the plan at $planpath in THIS worktree.

Rules:
- Read $planpath fully. Implement its Goals to satisfy its Success criteria.
- You are on branch $branch. COMMIT early and often on this branch.
- Run the plan's test_cmd and make it pass: $test_cmd
- Do NOT push. Do NOT merge. Do NOT deploy. Do NOT edit files outside this repo.
- Finish with a final commit; the last thing you print is the test_cmd result.
EOF

"$BOSS_HOME/executors/$executor.sh" dispatch "$pr" "$brief"
echo "PR#$pr dispatched: executor=$executor model=${model:-default} worktree=$wt"
