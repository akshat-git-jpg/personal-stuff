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
    ( cd "$worktree" || exit 1
      exec "${BOSS_CLAUDE_CMD:-claude}" -p "$(cat "$brief")" \
        --model "$model" --max-turns "${BOSS_MAX_TURNS:-60}" \
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
    verdict=$(python3 - "$out" <<'PY'
import json,sys
raw=open(sys.argv[1]).read().strip()
try:
    d=json.loads(raw)
except Exception:
    try: d=json.loads(raw.splitlines()[-1])
    except Exception: print("PARSEFAIL"); raise SystemExit
if d.get("is_error") or d.get("subtype")!="success":
    print("ERROR")
else:
    print("SUCCESS")
PY
)
    # HEAD-advanced guard (shared with agy): a SUCCESS with no new commit is NOT done.
    case "$verdict" in
      SUCCESS)
        if boss_head_advanced "$id"; then echo "done headless run completed, HEAD advanced"
        else echo "blocked claude reported success but HEAD did not advance (no work / wrong-checkout?)"; fi ;;
      ERROR) echo "blocked claude run errored (max-turns or execution error)" ;;
      PARSEFAIL) echo "dead unparseable output" ;;
      *) echo "dead no verdict in envelope" ;;
    esac ;;
  *) echo "ERROR: unknown verb $verb" >&2; exit 2 ;;
esac
