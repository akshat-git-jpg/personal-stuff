#!/bin/bash
# boss-dispatch.sh <pr#> [--executor <e>] [--model <m>]
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"
pr="${1:?usage: boss-dispatch.sh <pr#> [--executor e] [--model m]}"; shift
exec_override=""; model_override=""; force=0; brief_extra=""
while [ $# -gt 0 ]; do case "$1" in
  --executor) exec_override="$2"; shift 2;; --model) model_override="$2"; shift 2;;
  --force) force=1; shift;;
  --brief-extra) brief_extra="$2"; shift 2;;
  *) echo "unknown arg $1" >&2; exit 2;; esac; done

trap boss_gh_restore EXIT
boss_assert_gh || exit 1

# Checkout hygiene (WARN ONLY — never mutate the owner's checkout).
#
# History: this used to hard-refuse on a dirty REPO_ROOT, then auto-commit it,
# because greenlight landed from the top-level checkout and parked every merge as
# "main checkout busy". cbc9e6b7 (2026-08-02) moved landing INSIDE the leased
# worktree, so greenlight no longer reads REPO_ROOT at all — it logs
# "top-level checkout is not on main — left untouched" and lands fine. The guard
# outlived its reason.
#
# Auto-commit then became actively harmful (2026-08-03): REPO_ROOT was parked on a
# feature branch, so "commit dirty main" committed a concurrent session's
# in-progress work into an unrelated OPEN PR (#143) — twice — including plan files
# and plans/README.md, the one file the registry rule reserves to main. Stale
# copies of files main had since advanced nearly reverted four commits on merge.
#
# A dispatch has no business writing to the owner's checkout. Warn and continue.
dirty=$(boss_repo_dirty)
onbranch=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ "$onbranch" != "main" ]; then
  echo "PR $pr: NOTE — $REPO_ROOT is on '$onbranch', not main." >&2
  echo "  Merges are unaffected (greenlight lands from the worktree), but boss-merge will" >&2
  echo "  skip the plans/README.md landing record. Reconcile the registry from main later." >&2
fi
if [ -n "$dirty" ]; then
  echo "PR $pr: NOTE — $REPO_ROOT has uncommitted tracked changes (left untouched):" >&2
  echo "$dirty" | sed 's/^/    /' >&2
  echo "  This does NOT block the merge. If it is another session's work, leave it alone." >&2
fi

branch=$(gh pr view "$pr" --json headRefName -q .headRefName) || { echo "no such PR $pr" >&2; exit 1; }
case "$branch" in boss/*) ;; *) echo "PR $pr branch '$branch' not boss/* — refusing" >&2; exit 1;; esac
slug=$(slug_of "$branch"); planpath="plans/$slug.md"

git -C "$REPO_ROOT" fetch -q origin "$branch"
plan_tmp="$STATE_DIR/$pr.plan"
git -C "$REPO_ROOT" show "origin/$branch:$planpath" > "$plan_tmp" 2>/dev/null \
  || { echo "PR $pr: $planpath missing on branch" >&2; exit 1; }
fm_executor="$(fm_get executor "$plan_tmp")"
executor="${exec_override:-$fm_executor}"; [ -n "$executor" ] || executor="claude-p"
# Model resolution. An explicit --model always wins. Otherwise the frontmatter
# model is only valid when the executor IS the frontmatter's own — a model string
# is executor-specific ("sonnet" is a claude-p model; agy rejects it with
# `invalid --model "sonnet"` and burns a dispatch). When --executor swaps the
# executor, DROP the frontmatter model so the new executor falls back to its own
# default (agy.sh / claude-p.sh fill it in).
if [ -n "$model_override" ]; then
  model="$model_override"
elif [ "$executor" = "$fm_executor" ]; then
  model="$(fm_get model "$plan_tmp")"
else
  model=""
fi
test_cmd="$(fm_get test_cmd "$plan_tmp")"
# Gate the shape BEFORE anything expensive (worktree lease, branch reset, crew).
# Prose in CLAUDE.md asked for a bare one-line command and got violated anyway.
if [ -n "$test_cmd" ]; then
  test_cmd="$(boss_check_test_cmd "$test_cmd")" \
    || { echo "PR $pr: fix test_cmd in $planpath frontmatter, then re-dispatch." >&2; exit 2; }
fi
[ -n "$test_cmd" ] || { echo "PR $pr: test_cmd missing in frontmatter — refusing" >&2; exit 1; }

# A ui:true plan that names a screenshot path git will not track can never satisfy
# its own gate. Plan 239 did exactly that (docs/shots is gitignored) and the crew
# spent a round finding out. Same reasoning as the test_cmd gate above: refuse in a
# second, before the worktree lease and the crew.
ui_decl="$(fm_get ui "$plan_tmp" 2>/dev/null)"
case "$ui_decl" in
  true|yes|1)
    ui_bad="$(boss_ui_ignored_paths "$plan_tmp")"
    if [ -n "$ui_bad" ]; then
      echo "PR $pr: plan is ui:true but names GITIGNORED image path(s): $ui_bad" >&2
      echo "  git could never track that file, so the ui gate could never pass." >&2
      echo "  Fix: point the plan at a tracked directory, or un-ignore the named file." >&2
      exit 2
    fi
    ;;
esac
# Optional frontmatter `test_timeout` (seconds) — plans with real renders/downloads
# declare their own budget; everything else gets 600s, which would have caught the
# 2026-07-08 hang in 10 minutes instead of 83.
test_timeout="$(fm_get test_timeout "$plan_tmp")"; [ -n "$test_timeout" ] || test_timeout=600

# Structured dependency gate. `needs:` is free prose (a human note), so boss could
# never act on it — the 2026-08-02 intro-studio chain (180->181->182) was sequenced
# entirely by the owner telling boss when to dispatch. `needs_prs: [138, 139]` is
# machine-readable: refuse to dispatch until each listed PR is closed (= landed).
# --force overrides for a deliberate out-of-order run.
#
# A number here may be a PR number OR a plan number: a plan is written before its
# PR exists, so `needs_prs: [261]` naming plan 261 is the normal authoring mistake,
# not an exception. boss_dep_resolve tries the PR first and falls back to the
# boss/<n>-* branch, so both spellings work. `needs_plans:` is the explicit key.
boss_dep_gate() {  # <list> <pr|plan>
  local list="$1" mode="$2" dep resolved dep_pr dep_state
  for dep in $(echo "$list" | tr -d '[]",' ); do
    case "$dep" in ''|*[!0-9]*) continue;; esac
    if ! resolved=$(boss_dep_resolve "$dep" "$mode"); then
      echo "PR $pr: REFUSING to dispatch — dependency '$dep' matches no PR and no boss/$dep-* branch." >&2
      echo "  Check needs_prs/needs_plans in $planpath against the real numbers." >&2
      return 1
    fi
    dep_pr=${resolved%% *}; dep_state=${resolved##* }
    [ "$dep_pr" = "$dep" ] || \
      echo "PR $pr: NOTE — dependency '$dep' is a PLAN number; resolved to PR#$dep_pr." >&2
    if [ "$dep_state" != "CLOSED" ] && [ "$dep_state" != "MERGED" ]; then
      echo "PR $pr: REFUSING to dispatch — depends on PR#$dep_pr which is $dep_state (not landed)." >&2
      echo "  This plan builds on #$dep_pr's work; dispatching now means the crew works against a tree that lacks it." >&2
      echo "  Land #$dep_pr first, or pass --force to override." >&2
      return 1
    fi
  done
  return 0
}
needs_prs="$(fm_get needs_prs "$plan_tmp")"
needs_plans="$(fm_get needs_plans "$plan_tmp")"
if [ "$force" != "1" ]; then
  boss_dep_gate "$needs_prs"   pr   || exit 1
  boss_dep_gate "$needs_plans" plan || exit 1
fi

# Same-file collision warning. Three plans in the 2026-08-02 batch appended to
# lib/lint-cues.mjs and collided on the 2nd and 3rd merges. `touches:` lets boss
# warn at dispatch instead of surprising the merge.
touches="$(fm_get touches "$plan_tmp")"
if [ -n "$touches" ]; then
  for other in "$STATE_DIR"/*.meta; do
    [ -f "$other" ] || continue
    oid=$(basename "$other" .meta); [ "$oid" = "$pr" ] && continue
    opid=$(meta_get "$oid" pid) || continue
    [ -n "$opid" ] && kill -0 "$opid" 2>/dev/null || continue
    otouch=$(meta_get "$oid" touches) || continue
    for f in $(echo "$touches" | tr -d '[]",'); do
      case "$otouch" in *"$f"*) echo "WARN: PR#$pr and in-flight PR#$oid both touch $f — expect a rebase conflict on the second merge (boss resolves the concat; do NOT fix-up dispatch for it)" >&2;; esac
    done
  done
fi
# ui: frontmatter is no longer read — the screenshot gate was removed 2026-07-18 (see decisions.md).
[ -f "$BOSS_HOME/executors/$executor.sh" ] || { echo "no executor '$executor'" >&2; exit 1; }

# Duplicate-dispatch refusal. boss-dispatch never read the PR's CURRENT labels
# (only headRefName, and a dependency's state), so a second dispatch of a live PR
# ran straight through: it flipped the labels blindly, leased a SECOND worktree,
# and then either
#   - hit the checkout guard below, whose recovery set the PR back to boss:ready
#     while crew 1 was still running — inviting a THIRD dispatch, or
#   - succeeded, and truncated $pr.meta below, orphaning crew 1's pid, worktree and
#     head_before beyond recovery.
# boss:in-progress was designated as the lock but was never actually checked.
# --force overrides (same escape hatch as the needs_prs override above).
if [ "$force" != "1" ]; then
  cur_labels=$(gh pr view "$pr" --json labels -q '[.labels[].name]|join(",")' 2>/dev/null || echo "")
  case ",$cur_labels," in
    *,boss:in-progress,*)
      echo "PR#$pr is already boss:in-progress — refusing a second dispatch." >&2
      echo "  Inspect it first: bin/boss-state.sh $pr" >&2
      echo "  To FIX UP an existing crew, use a DIRECT executor dispatch — never boss-dispatch," >&2
      echo "  which force-resets the branch to origin and destroys the crew's local commits." >&2
      echo "  Pass --force only if you are certain nothing is running." >&2
      exit 3;;
  esac
  live_pid=$(meta_get "$pr" pid 2>/dev/null) || live_pid=""
  if [ -n "$live_pid" ] && kill -0 "$live_pid" 2>/dev/null; then
    echo "PR#$pr already has a LIVE crew (pid $live_pid) — refusing a second dispatch." >&2
    echo "  Fix-ups go through a direct executor dispatch. --force overrides." >&2
    exit 3
  fi
fi

gh pr edit "$pr" --remove-label boss:ready --add-label boss:in-progress

wt=$(wt get --holder "boss-$pr")
git -C "$wt" fetch -q origin "$branch" main
# Guard the checkout. If $branch is held by another worktree (typically a prior
# errored dispatch that never released it), `checkout -B` fails — but without this
# guard execution CONTINUES and the crew runs on this worktree's stale detached
# HEAD, silently committing nothing to $branch (data loss; hit on PR#43). Fail
# loudly, return the leased worktree, and leave the PR boss:ready (retryable, not
# blocked — this is an environment snag, not a plan defect).
if ! git -C "$wt" checkout -B "$branch" "origin/$branch"; then
  # Only hand the PR back to the ready queue when nothing is actually working on
  # it. Flipping a PR that still has a LIVE crew back to boss:ready invited a third
  # dispatch on top of the second. Reachable only via --force now, but the belt stays.
  abort_pid=$(meta_get "$pr" pid 2>/dev/null) || abort_pid=""
  if [ -n "$abort_pid" ] && kill -0 "$abort_pid" 2>/dev/null; then
    echo "PR#$pr: leaving boss:in-progress — crew pid $abort_pid is still alive." >&2
  else
    gh pr edit "$pr" --remove-label boss:in-progress --add-label boss:ready 2>/dev/null || true
  fi
  boss_notify "boss:dispatch-abort PR#$pr — cannot checkout $branch (held by another worktree?); left boss:ready"
  wt return "$wt" --holder "boss-$pr"
  echo "PR#$pr dispatch ABORTED — could not checkout $branch in $wt (branch held by another worktree?)." >&2
  echo "  Free the stale worktree (git -C <wt> checkout --detach; wt return <wt>), then re-dispatch." >&2
  exit 2
fi
if ! git -C "$wt" merge --no-edit origin/main; then
  gh pr edit "$pr" --remove-label boss:in-progress --add-label boss:blocked
  boss_notify "boss:blocked PR#$pr — stale, main-merge conflict"
  wt return "$wt" --holder "boss-$pr"; echo "PR#$pr blocked (stale)"; exit 2
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
# Plan size, measured once here where the plan text is already in hand. Executors
# budget their turn cap from it (see executors/claude-p.sh).
meta_set "$pr" plan_lines "$(wc -l < "$plan_tmp" | tr -d ' ')"
[ -n "$touches" ] && meta_set "$pr" touches "$touches"

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
- **Work ONLY inside this worktree: $wt**
  Never cd, write, or run git anywhere else — above all NOT in $REPO_ROOT, which is
  the owner's shared main checkout. A commit made there can capture another live
  session's uncommitted edits (2026-08-22), and your branch is not checked out there
  anyway, so the work would be lost as well as damaging. Everything this plan needs
  is in this worktree. If a path seems to be missing, it is a plan defect — report
  it and stop; do not go looking for it in another checkout.
- Do NOT edit plans/README.md — boss owns the plan registry on main; any edit
  you make to it is discarded, and the merge gate REJECTS the branch.
- Finish with a final commit; the last thing you print is the test_cmd result.
EOF

# Standing rules. Each of these was learned the expensive way in the 2026-08-02
# batch, where they lived in a per-batch --brief-extra and so protected only that
# batch. They belong to every dispatch. (Quoted heredoc: no shell expansion.)
cat >> "$brief" <<'STANDING'

## Standing rules (not optional)

- **NEVER run a command in the background.** You cannot wait on a background job.
  Four crews in one batch backgrounded their gate and then printed "I am waiting
  for the background task to finish" and idled away the entire run. Run every
  command in the FOREGROUND and let it block. Never append `&`. Slow is fine —
  wrap it in the timeout above and WAIT.
- **COMMIT EARLY, and often.** A crew that saves everything for the end and then
  hits the turn cap loses all of it (that is exactly how one plan produced 11
  modified files and zero commits). Commit as soon as anything works.
- **NEVER reserialise a data file.** Do not read a .json/.html file, re-emit it
  with a JSON dumper or formatter, and write it back. It reflows every line, so a
  3-line change lands as a 2000-line diff that conflicts with everything. Edit the
  file surgically, preserving existing indentation and key order.
- **Leave the worktree clean.** `git status --porcelain` must be EMPTY when you
  finish. Delete scratch scripts, .pid files, sample videos and measurement dumps
  rather than leaving them untracked. Never commit a one-off helper script — the
  merge gate rejects `scratch*`, `*.pid`, `*.mp4` and `run-log.json`.
- **Never commit regenerated artifacts** (e.g. `run-log.json`). They are output,
  not intent, and they cause rebase conflicts on every concurrent branch.
- **Report against your COMMITTED state**, never your working tree. Run the final
  check last, on what you actually committed, and paste its real output.
STANDING

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

# Gate-specific brief sections. Telling the crew which gates RUN (not which rules
# exist) is what makes them binding — the 2026-08-02 batch proved a rule nobody
# enforces gets violated even when it is written down.
mut_apply="$(fm_get mutation_apply "$plan_tmp")"
if [ -n "$mut_apply" ]; then
  cat >> "$brief" <<EOF

## Mutation gate — this WILL be run against your branch

Before your work can land, boss runs this automatically:

  1. \`$(fm_get mutation_command "$plan_tmp")\` must PASS on your clean branch
  2. this mutation is applied: \`$mut_apply\`
  3. the same command must then FAIL, and its output must contain: \`$(fm_get mutation_expect "$plan_tmp")\`
  4. the mutation is reverted and the command must pass again

A gate that does not fire under its own mutation is dead code and is REJECTED.
Do not satisfy this by asserting on source text (e.g. reading a .mjs file and
regex-matching the line the mutation edits) — that is circular and it is caught.
Your assertion must exercise real behaviour through the production code path.
EOF
fi
case "$(fm_get ui "$plan_tmp")" in
  true|yes|1) cat >> "$brief" <<'UIGATE'

## ui: true — a committed screenshot is required

This plan is marked `ui: true`. The merge gate REJECTS the branch unless it
commits an image (.png/.jpg/.webp). Capture the view your change affects, save it
inside the repo (alongside the other evidence for this pipeline, not at the repo
root) and commit it. A described screenshot is not a screenshot.
UIGATE
  ;;
esac

# Optional per-dispatch extra instructions (owner batch rules, ui-verification
# notes, etc). Appended verbatim after the standard brief so a batch can add
# constraints without editing this script.
if [ -n "$brief_extra" ]; then
  [ -f "$brief_extra" ] || { echo "PR $pr: --brief-extra file '$brief_extra' not found" >&2; exit 1; }
  { echo ""; echo "## Batch-specific instructions (owner)"; cat "$brief_extra"; } >> "$brief"
fi

# ui:true screenshot gate removed 2026-07-18: the sole owner never reviews the
# committed PNGs / PR comments, and making the crew render one inside its turn
# budget only ever cost us (e.g. the #31 max-turns fix-up). Visual changes are
# eyeballed locally on demand; boss-merge prints the run hint. See decisions.md.

"$BOSS_HOME/executors/$executor.sh" dispatch "$pr" "$brief"
echo "PR#$pr dispatched: executor=$executor model=${model:-default} worktree=$wt"
