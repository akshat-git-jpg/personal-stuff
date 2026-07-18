#!/bin/bash
# boss-dispatch.sh <pr#> [--executor <e>] [--model <m>]
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
pr="${1:?usage: boss-dispatch.sh <pr#> [--executor e] [--model m]}"; shift
exec_override=""; model_override=""; force=0
while [ $# -gt 0 ]; do case "$1" in
  --executor) exec_override="$2"; shift 2;; --model) model_override="$2"; shift 2;;
  --force) force=1; shift;;
  *) echo "unknown arg $1" >&2; exit 2;; esac; done

boss_assert_gh || exit 1

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
# Optional frontmatter `test_timeout` (seconds) — plans with real renders/downloads
# declare their own budget; everything else gets 600s, which would have caught the
# 2026-07-08 hang in 10 minutes instead of 83.
test_timeout="$(fm_get test_timeout "$plan_tmp")"; [ -n "$test_timeout" ] || test_timeout=600
# ui: frontmatter is no longer read — the screenshot gate was removed 2026-07-18 (see decisions.md).
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
meta_set "$pr" test_timeout "$test_timeout"; meta_set "$pr" planpath "$planpath"

brief="$STATE_DIR/$pr.brief.md"
cat > "$brief" <<EOF
You are a boss crew member. Implement exactly the plan at $planpath in THIS worktree.

Rules:
- Read $planpath fully. Implement its Goals to satisfy its Success criteria.
- You are on branch $branch. COMMIT early and often on this branch.
- Run the plan's test_cmd ONLY wrapped in a timeout, so a hang fails fast instead
  of blocking forever:  gtimeout -k 30 ${test_timeout}s bash -c '<the test_cmd>'
  Make it pass. If it TIMES OUT, your code is hanging — FIX the hang; never raise
  the timeout, never run test_cmd bare. The test_cmd is: $test_cmd
- Do NOT push. Do NOT merge. Do NOT deploy. Do NOT edit files outside this repo.
- Do NOT edit plans/README.md — boss owns the plan registry on main; any edit
  you make to it is discarded.
- Finish with a final commit; the last thing you print is the test_cmd result.
EOF

# Anti-fence guardrail (quoted heredoc — the literal backticks must NOT be shell-
# expanded). The 2026-07-08 hang was markdown fence markers copied verbatim into
# source files; telling the crew the merge gate rejects them makes it enforceable.
cat >> "$brief" <<'FENCE'
- NEVER generate files by copying or slicing line ranges out of the plan markdown
  (e.g. reading the plan and dumping lines[1717:1794] to disk). Write each file's
  contents yourself. Code blocks in the plan are ILLUSTRATIONS — the ``` fence
  lines are NOT part of any file. A leaked ```bash / ``` line makes a shell script
  hang forever on an unterminated backtick.
- Before your final commit, find and remove every leaked markdown fence:
    git diff origin/main...HEAD -- . ':(exclude)*.md' | grep -n '^+.*```'
  Any hit is a bug; the merge gate rejects fence markers in non-markdown source.
FENCE

# ui:true screenshot gate removed 2026-07-18: the sole owner never reviews the
# committed PNGs / PR comments, and making the crew render one inside its turn
# budget only ever cost us (e.g. the #31 max-turns fix-up). Visual changes are
# eyeballed locally on demand; boss-merge prints the run hint. See decisions.md.

"$BOSS_HOME/executors/$executor.sh" dispatch "$pr" "$brief"
echo "PR#$pr dispatched: executor=$executor model=${model:-default} worktree=$wt"
