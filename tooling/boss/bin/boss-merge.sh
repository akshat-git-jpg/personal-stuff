#!/bin/bash
# boss-merge.sh <pr#> — land a finished PR via greenlight, record DONE, offer deploy.
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
boss_assert_gh || exit 1
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
# ...and free ANY other worktree still holding the branch. Returning only the
# dispatch worktree was not enough: three merges in the 2026-08-02 batch parked on
# "already used by worktree" because a finished crew's (or a diagnostic) worktree
# still held the ref. Lossless — refuses to touch a dirty worktree.
boss_free_branch_worktree "$branch"

# Fence-leak gate. The 2026-07-08 hang was markdown fence markers (```bash / ```)
# copied verbatim into real source files — a class of failure that is mechanically
# detectable with zero LLM involvement, so catch it deterministically BEFORE
# handing off to greenlight (verify might not even trip on it). The crew's commits
# live on the local $branch ref (worktrees share the ref store), intact after the
# return above. Diff the branch against main; .md is excluded (fences are legal there).
git -C "$REPO_ROOT" fetch -q origin main 2>/dev/null || true
leak=$(git -C "$REPO_ROOT" diff "origin/main...$branch" -- . ':(exclude)*.md' 2>/dev/null | grep -cE '^\+[[:space:]]*```' || true)
if [ "${leak:-0}" -gt 0 ]; then
  gh pr edit "$pr" --remove-label boss:in-progress --add-label boss:blocked
  boss_notify "boss:blocked PR#$pr — $leak markdown fence line(s) leaked into non-md source"
  echo "PR#$pr blocked — $leak leaked markdown fence line(s) in non-markdown source (see git diff origin/main...$branch)"; exit 2
fi

# --- deterministic gates (2026-08-02). Each rule below was already in the crew
# brief and was violated anyway; prose is a suggestion, a gate is not. Collect
# every violation before blocking so one fix-up can address them all at once.
plan_file="$STATE_DIR/$pr.plan"
violations=$(boss_hygiene_gate "$branch" "$plan_file")
if [ -f "$plan_file" ]; then
  ui_v=$(boss_ui_gate "$branch" "$plan_file"); [ -n "$ui_v" ] && violations="$violations
$ui_v"
fi
violations=$(printf '%s\n' "$violations" | sed '/^$/d')
if [ -n "$violations" ]; then
  gh pr edit "$pr" --remove-label boss:in-progress --add-label boss:blocked
  boss_notify "boss:blocked PR#$pr — pre-merge gate: $(printf '%s' "$violations" | head -1)"
  echo "PR#$pr blocked — pre-merge gate violations:"; printf '%s\n' "$violations" | sed 's/^/  - /'
  exit 2
fi

# Mutation gate. The 2026-08-02 batch's core lesson: a gate that never fires is
# worse than no gate because it reads as coverage. Runs only when the plan arms
# it via mutation_apply/_command/_expect frontmatter. Needs a worktree holding
# the branch, so re-lease one briefly (greenlight has not run yet).
#
# Check out the LOCAL $branch, never origin/$branch. The crew commits into its
# leased worktree and NOTHING in boss or the executors ever pushes that branch —
# greenlight lands the local ref straight into main. So origin/$branch is still
# the plan-file-only commit secretary raised, where the implementation does not
# exist and every mutation_apply matches nothing. That is not a no-op recipe, it
# is the gate aiming at the wrong tree, and it fired on PR#148 (2026-08-04) as a
# bogus "mutation_apply changed NOTHING". The fence-leak gate above and
# greenlight below both already use the local $branch — this now matches them,
# so the mutation gate tests the tree that actually lands.
if [ -f "$plan_file" ] && [ -n "$(fm_get mutation_apply "$plan_file" 2>/dev/null)" ]; then
  mwt=$(wt get --holder "boss-mut-$pr" 2>/dev/null)
  if [ -n "$mwt" ] && git -C "$mwt" checkout -q --detach "$branch" 2>/dev/null; then
    echo "PR#$pr: running mutation gate…"
    mut=$(boss_mutation_gate "$branch" "$plan_file" "$mwt")
    wt return "$mwt" 2>/dev/null || true
    if [ -n "$mut" ]; then
      gh pr edit "$pr" --remove-label boss:in-progress --add-label boss:blocked
      boss_notify "boss:blocked PR#$pr — $(printf '%s' "$mut" | head -1)"
      echo "PR#$pr blocked — mutation gate:"; printf '%s\n' "$mut" | sed 's/^/  - /'
      exit 2
    fi
    echo "PR#$pr: mutation gate PROVEN (gate fires under its own mutation)"
  else
    [ -n "$mwt" ] && wt return "$mwt" 2>/dev/null || true
    echo "WARN: PR#$pr mutation gate skipped — could not lease/checkout a worktree" >&2
  fi
fi

# greenlight exits 0 on BOTH land and park (park() writes state=parked, exit 0),
# so the exit code alone can't tell success from a parked verify-failure. Read
# greenlight's own state file for the truth. RUN_ID = <timestamp>-<branch-slug>;
# find the newest run dir matching this branch.
gl_root="${GREENLIGHT_STATE_ROOT:-$HOME/kb-scratch/greenlight}"
branch_slug=$(echo "$branch" | tr '/' '-' | tr -cd 'a-zA-Z0-9-')
# Wrap the verify in a timeout so a hanging test_cmd fails fast (gtimeout exits
# 124 → greenlight parks "verify failed" → existing boss:blocked path) instead of
# wedging the merge forever (2026-07-08). greenlight runs --verify via bash -c, so
# printf %q keeps the test_cmd intact through the extra shell layer. -k 30 forces
# SIGKILL 30s after SIGTERM in case the hung process ignores the term.
ttl=$(meta_get "$pr" test_timeout); ttl="${ttl:-600}"
tbin=$(boss_timeout_bin) || { echo "FATAL: no gtimeout/timeout on PATH — brew install coreutils" >&2; exit 1; }
verify="$tbin -k 30 ${ttl}s bash -c $(printf '%q' "$test_cmd")"
# Serialize browser-driving work. Every visuals-flow/card-library test_cmd launches
# headless Chrome; PR#134 lost a merge cycle to "Chrome dump-dom timeout on
# #card-plan" with 44 chrome processes live because a crew was rendering at the
# same time. Wait for live crews to finish, then hold the lock across the verify.
crews=$(boss_crews_running)
if [ -n "$crews" ]; then
  echo "boss: crews still running ($(echo "$crews" | tr '\n' ' ')) — waiting before verify to avoid Chrome contention" >&2
  for _ in $(seq 1 "${BOSS_CHROME_WAIT_MIN:-45}"); do
    [ -z "$(boss_crews_running)" ] && break; sleep 60
  done
fi
boss_chrome_lock_acquire "merge-$pr"
trap 'boss_chrome_lock_release' EXIT
"$REPO_ROOT/tooling/cli/greenlight/greenlight" run --branch "$branch" --verify "$verify" || true
boss_chrome_lock_release; trap - EXIT
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
  # greenlight now lands from inside its own worktree and only best-effort
  # fast-forwards this checkout (2026-08-02), so it can legitimately be behind
  # origin/main here. Catch up before appending, or the registry push is
  # rejected as non-fast-forward.
  git -C "$REPO_ROOT" fetch -q origin main 2>/dev/null || true
  git -C "$REPO_ROOT" merge --ff-only origin/main >/dev/null 2>&1 \
    || echo "WARN: $REPO_ROOT could not fast-forward to origin/main (dirty?) — registry push may be rejected" >&2
  # Append a one-line record to a dedicated "boss-landed" list at end of file (idempotent).
  grep -q '^## boss-landed' "$readme" || printf '\n## boss-landed\n' >> "$readme"
  printf -- '- %s — PR#%s %s — DONE\n' "$slug" "$pr" "${title:-}" >> "$readme"
  ( cd "$REPO_ROOT" && git add plans/README.md && git commit -q -m "boss: record $slug (PR#$pr) landed" \
      && "$HOME/.local/libexec/pp-push" --repo "$REPO_ROOT" origin main )
fi

gh pr edit "$pr" --remove-label boss:in-progress --add-label boss:done 2>/dev/null || true
# Record the terminal verdict LOCALLY. The session-start in-flight loop can then skip
# this PR with no `gh` call at all; before this it ran `gh pr view` for every one of
# 171 metas on every startup, because a live lookup was its only skip test.
meta_set "$pr" terminal done
# greenlight lands by merging the branch into main directly (not via the PR
# merge button), so GitHub leaves the PR OPEN. Close it explicitly with a
# landing comment — boss:done is the state, closed is the lifecycle.
gh pr close "$pr" --comment "Landed on main via greenlight (merged directly; closing)." 2>/dev/null \
  || gh pr comment "$pr" --body "Landed on main via greenlight." 2>/dev/null || true
[ -n "$wt" ] && wt return "$wt" 2>/dev/null || true
boss_notify "boss:merged PR#$pr ($slug) landed on main"
echo "PR#$pr merged. If the plan has a deploy, run: tooling/boss/bin/boss-deploy.sh $pr --yes"
