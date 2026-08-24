#!/bin/bash
# Executor: claude-p — backgrounded `claude -p` in a worktree.
# Contract: <script> <dispatch|alive|collect> <pr#> [brief-path]
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../bin" && pwd)/boss-lib.sh"
verb="${1:?usage: claude-p.sh <dispatch|alive|collect> <pr#> [brief]}"
id="${2:?usage: claude-p.sh <verb> <pr#> [brief]}"
case "$verb" in
  dispatch)
    brief="${3:?dispatch requires <brief-path>}"
    worktree=$(meta_get "$id" worktree) || { echo "ERROR: no worktree for $id" >&2; exit 1; }
    out="$STATE_DIR/$id.out"; : > "$out"
    model=$(meta_get "$id" model) || model=""; [ -n "$model" ] || model="sonnet"
    meta_set "$id" head_before "$(git -C "$worktree" rev-parse HEAD 2>/dev/null || echo none)"
    # Turn cap, sized from the plan. A flat 60 was really a ~300-line plan ceiling:
    # measured across all 18 historical claude-p runs, turns scale with plan size at
    # ~0.15-0.2 turns/line; every success had a plan <=292 lines and both
    # error_max_turns deaths were 315L and 537L. Budget 0.4 turns/line — double the
    # observed worst case — because a cap only ever TRUNCATES, so an over-generous
    # budget costs nothing while an exact one kills the run at the finish line.
    # BOSS_MAX_TURNS still wins, so an operator can pin any value.
    turns="${BOSS_MAX_TURNS:-}"
    if [ -z "$turns" ]; then
      lines=$(meta_get "$id" plan_lines) || lines=""
      # Fall back to counting the plan in the worktree: a DIRECT fix-up dispatch runs
      # against a meta written before plan_lines existed.
      if [ -z "$lines" ]; then
        pp=$(meta_get "$id" planpath) || pp=""
        [ -n "$pp" ] && [ -f "$worktree/$pp" ] && lines=$(wc -l < "$worktree/$pp" | tr -d ' ')
      fi
      case "$lines" in ''|*[!0-9]*) lines=0 ;; esac
      turns=$(( lines * 2 / 5 ))
      [ "$turns" -lt 60 ]  && turns=60
      [ "$turns" -gt 600 ] && turns=600
      echo "claude-p: PR $id plan is ${lines}L — budgeting $turns turns" >&2
    fi
    meta_set "$id" max_turns "$turns"
    ( cd "$worktree" || exit 1
      exec "${BOSS_CLAUDE_CMD:-claude}" -p "$(cat "$brief")" \
        --model "$model" --max-turns "$turns" \
        --output-format json --dangerously-skip-permissions
    ) > "$out" 2>&1 &
    pid=$!; disown "$pid" 2>/dev/null || true
    meta_set "$id" pid "$pid"; meta_set "$id" out "$out"; meta_set "$id" dispatched_at "$(date +%s)"
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
      MAXTURNS)  echo "blocked claude hit max-turns at $(meta_get "$id" max_turns 2>/dev/null || echo '?') turns for a $(meta_get "$id" plan_lines 2>/dev/null || echo '?')-line plan — re-dispatch with a higher BOSS_MAX_TURNS, or split the plan$salvage" ;;
      APIERROR)  echo "ratelimited claude API error ($detail) — environmental, retryable$salvage" ;;
      ERROR)     echo "blocked claude run errored$salvage" ;;
      PARSEFAIL) echo "dead unparseable output" ;;
      *) echo "dead no verdict in envelope" ;;
    esac ;;
  *) echo "ERROR: unknown verb $verb" >&2; exit 2 ;;
esac
