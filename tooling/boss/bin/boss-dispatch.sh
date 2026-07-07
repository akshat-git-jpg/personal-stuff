#!/bin/bash
# boss-dispatch.sh <pr#> [--executor <e>] [--model <m>]
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
pr="${1:?usage: boss-dispatch.sh <pr#> [--executor e] [--model m]}"; shift
exec_override=""; model_override=""; force=0
while [ $# -gt 0 ]; do case "$1" in
  --executor) exec_override="$2"; shift 2;; --model) model_override="$2"; shift 2;;
  --force) force=1; shift;;
  *) echo "unknown arg $1" >&2; exit 2;; esac; done

# Dirty-main guard (enforced, not a reminder). greenlight refuses to land onto a
# REPO_ROOT with any uncommitted tracked change and silently parks the merge as
# "main checkout busy" — so a dirty main quietly swallows an entire dispatch
# batch. Refuse HERE, before we flip labels or lease a worktree, so the failure
# surfaces at the point of action regardless of whether the session ran
# boss-session-start. --force overrides (rarely wanted). Recurred twice under a
# docs-only control (2026-07-07, 2026-07-08); this moves it from "I remember" to
# "the code refuses".
if [ "$force" != "1" ]; then
  dirty=$(boss_repo_dirty)
  if [ -n "$dirty" ]; then
    echo "PR $pr: REFUSING to dispatch — main checkout ($REPO_ROOT) has uncommitted tracked changes:" >&2
    echo "$dirty" | sed 's/^/  /' >&2
    echo "  greenlight will park EVERY merge until this is clean. Commit/stash/revert in $REPO_ROOT, then re-dispatch (or pass --force to override)." >&2
    exit 1
  fi
fi

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
ui="$(fm_get ui "$plan_tmp")"
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

# Registry is boss-owned on main. Force the branch's plans/README.md to match
# main so a plan branch NEVER carries registry edits into greenlight's merge —
# that was the sole source of the plans/README.md rebase conflicts (concurrent
# branches all editing one shared file). Plan rows live on main; boss records
# landings there (boss-merge). See tooling/boss/CLAUDE.md.
if git -C "$wt" cat-file -e origin/main:plans/README.md 2>/dev/null; then
  git -C "$wt" checkout origin/main -- plans/README.md 2>/dev/null || true
  if ! git -C "$wt" diff --quiet -- plans/README.md 2>/dev/null; then
    git -C "$wt" add plans/README.md
    git -C "$wt" commit -q -m "boss: reset plans/README.md to main (registry is boss-owned)"
  fi
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
- Do NOT edit plans/README.md — boss owns the plan registry on main; any edit
  you make to it is discarded.
- Finish with a final commit; the last thing you print is the test_cmd result.
EOF

if [ "$ui" = "true" ]; then
  repo_slug="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)"
  shot_path="plans/runs/evidence/$slug.png"
  cat >> "$brief" <<EOF

UI verification (required — this plan is flagged \`ui: true\`; test_cmd alone
does not judge how the UI looks):
- After implementing, render the changed view (dev server + browser, or an
  existing screenshot script if this repo has one) and save ONE screenshot to
  $shot_path in this worktree.
- Commit the screenshot on this branch.
- Post it as a PR comment so it renders inline:
  gh pr comment $pr --body "![screenshot](https://github.com/$repo_slug/blob/$branch/$shot_path?raw=true)"
- Do this BEFORE your final commit and before printing the test_cmd result.
EOF
fi

"$BOSS_HOME/executors/$executor.sh" dispatch "$pr" "$brief"
echo "PR#$pr dispatched: executor=$executor model=${model:-default} worktree=$wt"
