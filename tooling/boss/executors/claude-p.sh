#!/bin/bash
# Executor: claude-p — backgrounded `claude -p` in a worktree.
# Contract: <script> <dispatch|resume|alive|collect> <pr#> [brief-path]
#
# `resume` continues a run that hit its turn cap, via `claude -p --resume <session_id>`.
# It MUST resume the same session: boss holds no plan context by design, so a summary
# brief is the weakest possible handoff — the model's own prior context is the strongest.
# The session id comes out of the previous run's own JSON envelope.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../bin" && pwd)/boss-lib.sh"
verb="${1:?usage: claude-p.sh <dispatch|resume|alive|collect> <pr#> [brief]}"
id="${2:?usage: claude-p.sh <verb> <pr#> [brief]}"

# Turn cap, sized from the plan. A flat 60 was really a ~300-line plan ceiling:
# measured across all 18 historical claude-p runs, turns scale with plan size at
# ~0.15-0.2 turns/line; every success had a plan <=292 lines and both
# error_max_turns deaths were 315L and 537L. Budget 0.4 turns/line — double the
# observed worst case — because a cap only ever TRUNCATES, so an over-generous
# budget costs nothing while an exact one kills the run at the finish line.
# BOSS_MAX_TURNS still wins, so an operator can pin any value.
_turn_budget() {
  local wt="$1" turns lines pp
  turns="${BOSS_MAX_TURNS:-}"
  if [ -n "$turns" ]; then printf '%s' "$turns"; return; fi
  lines=$(meta_get "$id" plan_lines) || lines=""
  # Fall back to counting the plan in the worktree: a DIRECT fix-up dispatch runs
  # against a meta written before plan_lines existed.
  if [ -z "$lines" ]; then
    pp=$(meta_get "$id" planpath) || pp=""
    [ -n "$pp" ] && [ -f "$wt/$pp" ] && lines=$(wc -l < "$wt/$pp" | tr -d ' ')
  fi
  case "$lines" in ''|*[!0-9]*) lines=0 ;; esac
  turns=$(( lines * 2 / 5 ))
  [ "$turns" -lt 60 ]  && turns=60
  [ "$turns" -gt 600 ] && turns=600
  printf '%s' "$turns"
}

# _session_id <envelope-file> — the session id `claude -p --output-format json`
# reports. Same two-step parse as collect: the whole file, else its last line.
_session_id() {
  python3 - "$1" <<'SIDPY'
import json,sys
raw=open(sys.argv[1]).read().strip()
d=None
for cand in (raw, raw.splitlines()[-1] if raw else ""):
    try:
        d=json.loads(cand); break
    except Exception:
        continue
print((d or {}).get("session_id") or "")
SIDPY
}
case "$verb" in
  dispatch)
    brief="${3:?dispatch requires <brief-path>}"
    worktree=$(meta_get "$id" worktree) || { echo "ERROR: no worktree for $id" >&2; exit 1; }
    # Persisted fix-up budget. A dispatch against a meta that already carries a pid
    # is a fix-up round by definition; refuse past BOSS_MAX_FIXUPS. Must run BEFORE
    # head_before/pid are overwritten below.
    boss_fixup_claim "$id" || exit 3
    out="$STATE_DIR/$id.out"; : > "$out"
    model=$(meta_get "$id" model) || model=""; [ -n "$model" ] || model="sonnet"
    meta_set "$id" head_before "$(git -C "$worktree" rev-parse HEAD 2>/dev/null || echo none)"
    turns=$(_turn_budget "$worktree")
    echo "claude-p: PR $id budgeting $turns turns ($(meta_get "$id" plan_lines 2>/dev/null || echo '?')L plan)" >&2
    meta_set "$id" max_turns "$turns"
    ( cd "$worktree" || exit 1
      exec "${BOSS_CLAUDE_CMD:-claude}" -p "$(cat "$brief")" \
        --model "$model" --max-turns "$turns" \
        --output-format json --dangerously-skip-permissions
    ) > "$out" 2>&1 &
    pid=$!; disown "$pid" 2>/dev/null || true
    meta_set "$id" pid "$pid"; meta_set "$id" out "$out"; meta_set "$id" dispatched_at "$(date +%s)"
    ;;
  resume)
    # Continue a run that hit its turn cap. Truncation is not a failure of the plan
    # or the crew, so it must not spend the single fix-up round reserved for real
    # failures — but it must still be BOUNDED, like every other retry in boss.
    worktree=$(meta_get "$id" worktree) || { echo "ERROR: no worktree for $id" >&2; exit 1; }
    out=$(meta_get "$id" out) || out="$STATE_DIR/$id.out"
    [ -f "$out" ] && [ -s "$out" ] || { echo "ERROR: no previous output for $id — nothing to resume" >&2; exit 1; }
    # Refuse to fork a second crew onto one worktree.
    prev_pid=$(meta_get "$id" pid) || prev_pid=""
    if [ -n "$prev_pid" ] && kill -0 "$prev_pid" 2>/dev/null; then
      echo "REFUSED: PR $id still has a live crew (pid $prev_pid). Let it finish or kill it first." >&2
      exit 1
    fi
    sid=$(_session_id "$out")
    [ -n "$sid" ] || { echo "ERROR: no session_id in $out — cannot resume; dispatch a fresh crew" >&2; exit 1; }
    n=$(meta_get "$id" resumes) || n=""; case "$n" in ''|*[!0-9]*) n=0 ;; esac
    n=$(( n + 1 ))
    cap="${BOSS_MAX_RESUMES:-2}"
    if [ "$n" -gt "$cap" ]; then
      echo "REFUSED: PR $id has already used $(( n - 1 )) resume(s) (BOSS_MAX_RESUMES=$cap)." >&2
      echo "  A plan that cannot finish in $cap continuations is too big — split it, or raise the cap for one run." >&2
      exit 1
    fi
    # Keep the envelope we just read the session id out of. collect and the stall
    # detector both resolve `out` from the meta, so the canonical path keeps holding
    # the LATEST run while the chain stays inspectable.
    cp "$out" "$out.r$(( n - 1 ))" 2>/dev/null || true
    test_cmd=$(meta_get "$id" test_cmd) || test_cmd=""
    test_timeout=$(meta_get "$id" test_timeout) || test_timeout=600
    model=$(meta_get "$id" model) || model=""; [ -n "$model" ] || model="sonnet"
    turns=$(_turn_budget "$worktree")
    rbrief="$STATE_DIR/$id.resume.md"
    {
      echo "You ran out of turns mid-task. This is the SAME session, so you still have your"
      echo "full prior context. Continue exactly where you left off — do NOT start over and"
      echo "do NOT re-read the plan from the beginning."
      echo ""
      echo "- Commit your work on the current branch. Commit early and often."
      if [ -n "$test_cmd" ]; then
        echo "- Run the test_cmd ONLY wrapped in a timeout, so a hang fails fast:"
        echo "    gtimeout -k 30 ${test_timeout}s bash -c '<the test_cmd>'"
        echo "  The test_cmd is: $test_cmd"
        echo "  Make it pass. If it TIMES OUT your code is hanging — fix the hang, never"
        echo "  raise the timeout and never run test_cmd bare."
      fi
      echo "- Do NOT push. Do NOT merge. Do NOT deploy."
      echo "- Finish with a final commit; the last thing you print is the test_cmd result."
    } > "$rbrief"
    # head_before is deliberately NOT rewritten. The question collect asks is whether
    # this PR produced work at all, and the honest baseline for that is the original
    # dispatch point — a continuation is the same task, not a new one.
    ( cd "$worktree" || exit 1
      exec "${BOSS_CLAUDE_CMD:-claude}" -p "$(cat "$rbrief")" \
        --resume "$sid" --model "$model" --max-turns "$turns" \
        --output-format json --dangerously-skip-permissions
    ) > "$out" 2>&1 &
    pid=$!; disown "$pid" 2>/dev/null || true
    meta_set "$id" resumes "$n"
    meta_set "$id" max_turns "$turns"
    meta_set "$id" pid "$pid"; meta_set "$id" out "$out"; meta_set "$id" dispatched_at "$(date +%s)"
    echo "claude-p: PR $id resumed session $sid (round $n/$cap, $turns turns)" >&2
    ;;
  alive)
    pid=$(meta_get "$id" pid) || exit 2; [ -z "$pid" ] && exit 2
    kill -0 "$pid" 2>/dev/null && exit 0; exit 1 ;;
  collect)
    out=$(meta_get "$id" out) || out="$STATE_DIR/$id.out"
    [ -f "$out" ] && [ -s "$out" ] || { echo "dead no output"; exit 0; }
    # The `claude -p --output-format json` envelope carries "result" even on an
    # error_max_turns / error_during_execution outcome, so a bare grep for
    # "result" would mark a failed run "done". Parse the envelope: a run is a
    # real success only when is_error is false AND subtype == "success".
    # Failure CLASSIFICATION, not just pass/fail (2026-08-02). Two crews were
    # killed mid-flight by an API 429 ("You've hit your session limit") and this
    # reported "blocked ... (max-turns or execution error)" — a wrong diagnosis
    # that points at the plan when the cause was environmental and self-clearing.
    # Distinguishing them matters because the one-fix-up-then-blocked policy must
    # not spend its budget on a rate limit or a flake.
    verdict=$(python3 - "$out" <<'PY'
import json,sys
raw=open(sys.argv[1]).read().strip()
try:
    d=json.loads(raw)
except Exception:
    try: d=json.loads(raw.splitlines()[-1])
    except Exception: print("PARSEFAIL"); raise SystemExit
if not d.get("is_error") and d.get("subtype")=="success":
    print("SUCCESS"); raise SystemExit
status=d.get("api_error_status")
reason=(d.get("terminal_reason") or "")
result=(d.get("result") or "")
if status==429 or "session limit" in result.lower() or "rate limit" in result.lower():
    print("RATELIMIT|"+result.strip()[:120]); raise SystemExit
if d.get("subtype")=="error_max_turns" or "max_turns" in reason:
    print("MAXTURNS"); raise SystemExit
if status or reason=="api_error":
    print("APIERROR|"+(result.strip()[:120] or f"api_error_status={status}")); raise SystemExit
print("ERROR")
PY
)
    detail="${verdict#*|}"; verdict="${verdict%%|*}"
    # HEAD-advanced guard (shared with agy): a SUCCESS with no new commit is NOT done.
    # A crew killed mid-flight often leaves finished-but-UNCOMMITTED work (PR#134
    # held a complete implementation in its worktree). Surface that, so the
    # salvage path is a direct fix-up on the existing branch and never a
    # boss-dispatch (which force-resets the branch and would destroy it).
    wt=$(meta_get "$id" worktree) || wt=""
    salvage=""
    if [ -n "$wt" ] && [ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]; then
      salvage=" — WORK UNCOMMITTED in worktree ($(git -C "$wt" status --porcelain 2>/dev/null | wc -l | tr -d ' ') file(s)); salvage with a DIRECT executor fix-up, never boss-dispatch"
    fi
    case "$verdict" in
      SUCCESS)
        if boss_head_advanced "$id"; then echo "done headless run completed, HEAD advanced"
        else echo "blocked claude reported success but HEAD did not advance (no work / wrong-checkout?)$salvage"; fi ;;
      RATELIMIT) echo "ratelimited claude hit an API rate/session limit ($detail) — environmental, retry when it clears; do NOT spend the fix-up budget$salvage" ;;
      MAXTURNS)
        # NOT "blocked". Truncation is resumable, so it must not spend the single
        # fix-up round reserved for real failures — the same reasoning that makes
        # `ratelimited` its own class. Bounded by BOSS_MAX_RESUMES.
        _rn=$(meta_get "$id" resumes 2>/dev/null || echo 0); case "$_rn" in ''|*[!0-9]*) _rn=0 ;; esac
        _rc="${BOSS_MAX_RESUMES:-2}"
        if [ "$_rn" -ge "$_rc" ]; then
          echo "blocked claude hit max-turns again after $_rn resume(s) at $(meta_get "$id" max_turns 2>/dev/null || echo '?') turns for a $(meta_get "$id" plan_lines 2>/dev/null || echo '?')-line plan — the plan is too big; split it$salvage"
        else
          echo "truncated claude hit max-turns at $(meta_get "$id" max_turns 2>/dev/null || echo '?') turns for a $(meta_get "$id" plan_lines 2>/dev/null || echo '?')-line plan — RESUMABLE, do NOT spend the fix-up: executors/claude-p.sh resume $id (used $_rn/$_rc)$salvage"
        fi ;;
      APIERROR)  echo "ratelimited claude API error ($detail) — environmental, retryable$salvage" ;;
      ERROR)     echo "blocked claude run errored$salvage" ;;
      PARSEFAIL) echo "dead unparseable output" ;;
      *) echo "dead no verdict in envelope" ;;
    esac ;;
  *) echo "ERROR: unknown verb $verb (want dispatch|resume|alive|collect)" >&2; exit 2 ;;
esac
