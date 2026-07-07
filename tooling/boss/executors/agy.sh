#!/bin/bash
# Executor: agy — backgrounded Antigravity CLI in a worktree.
# Contract: <script> <dispatch|alive|collect> <pr#> [brief-path]
set -uo pipefail
export PATH="$HOME/.local/bin:$PATH"   # agy installs here
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../bin" && pwd)/boss-lib.sh"
verb="${1:?usage: agy.sh <dispatch|alive|collect> <pr#> [brief]}"
id="${2:?usage: agy.sh <verb> <pr#> [brief]}"
case "$verb" in
  dispatch)
    brief="${3:?dispatch requires <brief-path>}"
    command -v agy >/dev/null || { echo "ERROR: agy not installed" >&2; exit 1; }
    worktree=$(meta_get "$id" worktree) || { echo "ERROR: no worktree for $id" >&2; exit 1; }
    out="$STATE_DIR/$id.out"; : > "$out"
    model=$(meta_get "$id" model) || model=""; [ -n "$model" ] || model="${AGY_DEFAULT_MODEL:-Gemini 3.1 Pro (High)}"
    meta_set "$id" head_before "$(git -C "$worktree" rev-parse HEAD 2>/dev/null || echo none)"
    ( cd "$worktree" || exit 1
      exec agy -p "$(cat "$brief")" \
        --dangerously-skip-permissions --add-dir "$worktree" \
        --output-format json --print-timeout "${AGY_PRINT_TIMEOUT:-180m}" \
        --model "$model"
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
    status=$(python3 - "$out" <<'PY'
import json,sys
raw=open(sys.argv[1]).read().strip()
try: d=json.loads(raw)
except Exception:
    try: d=json.loads(raw.splitlines()[-1])
    except Exception: print("PARSEFAIL"); raise SystemExit
print(d.get("status",""))
PY
)
    # HEAD-advanced guard (shared via boss_head_advanced): agy can operate on the
    # wrong checkout; a SUCCESS with no new commit is NOT done (would make boss's
    # label state lie).
    case "$status" in
      SUCCESS)
        if boss_head_advanced "$id"; then echo "done agy completed, HEAD advanced"
        else echo "blocked agy reported success but HEAD did not advance (wrong-checkout?)"; fi ;;
      ERROR) echo "blocked agy error" ;;
      PARSEFAIL) echo "dead unparseable output" ;;
      *) echo "dead no status in envelope" ;;
    esac ;;
  *) echo "ERROR: unknown verb $verb" >&2; exit 2 ;;
esac
