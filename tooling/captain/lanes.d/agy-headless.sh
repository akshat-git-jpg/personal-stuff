#!/bin/bash
# Lane: agy-headless — a backgrounded non-interactive Antigravity CLI run.
# OFFICERS' DEFAULT EXECUTOR (owner decision 2026-07-06): same engine and
# AI Pro subscription as the Antigravity IDE, but headless — real process
# (PID/exit-code liveness), no GUI permission dialogs, no aglock.
#
# v2 (same day, after the full capability sweep — see
# references/antigravity-cli-findings.md and the agy capability map):
#   --add-dir       print mode does NOT bind cwd as workspace; without this
#                   the run executes against a scratch dir, ignores repo
#                   rules, and can roam the home dir under skip-permissions.
#   --output-format json   usage (incl. thinking_tokens) + conversation_id;
#                   collect() parses the envelope and records both in meta.
#   --print-timeout 180m   default is 5m — would kill any real plan run.
#   AGENTS.md       agy never reads CLAUDE.md; the repo ships an
#                   AGENTS.md -> CLAUDE.md symlink so rules load anyway.
# Fix-up rounds: resume with full context via
#   agy --conversation "$(meta conversation_id)" -p "..." --add-dir <wt> ...
#
# Contract: <script> <verb> <task-id> [args...]
#   dispatch <task-id> <brief-path>
#   alive    <task-id>          exit 0 provably working, 1 finished/silent, 2 dead
#   collect  <task-id>          print "done|blocked|dead <detail>"
#
# Meta appends: pid=, out=, dispatched_at=, and at collect time:
# conversation_id=, tokens_total=. Model via meta `model=` (names from
# `agy models`); default Gemini 3.1 Pro (High) (owner decision 2026-07-06).
set -uo pipefail

export PATH="$HOME/.local/bin:$PATH"   # agy installs to ~/.local/bin

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTAIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CAPTAIN_HOME="${CAPTAIN_HOME:-$CAPTAIN_DIR}"
STATE_DIR="$CAPTAIN_HOME/state"
mkdir -p "$STATE_DIR"

meta_get() {
  local f="$STATE_DIR/$1.meta"
  [ -f "$f" ] || return 1
  grep "^$2=" "$f" | tail -1 | cut -d= -f2-
}

meta_append() {
  echo "$2" >> "$STATE_DIR/$1.meta"
}

verb="${1:?usage: agy-headless.sh <dispatch|alive|collect> <task-id> [args...]}"
id="${2:?usage: agy-headless.sh <verb> <task-id> [args...]}"

case "$verb" in
  dispatch)
    brief="${3:?dispatch requires <brief-path>}"
    command -v agy >/dev/null || { echo "ERROR: agy not installed (curl -fsSL https://antigravity.google/cli/install.sh | bash)" >&2; exit 1; }
    worktree=$(meta_get "$id" worktree) || { echo "ERROR: no worktree for $id" >&2; exit 1; }
    out="$STATE_DIR/$id.out"
    : > "$out"
    model=$(meta_get "$id" model) || model=""
    [ -n "$model" ] || model="${AGY_DEFAULT_MODEL:-Gemini 3.1 Pro (High)}"

    (
      cd "$worktree" || exit 1
      exec agy -p "$(cat "$brief")" \
        --dangerously-skip-permissions \
        --add-dir "$worktree" \
        --output-format json \
        --print-timeout "${AGY_PRINT_TIMEOUT:-180m}" \
        --model "$model"
    ) > "$out" 2>&1 &
    pid=$!
    disown "$pid" 2>/dev/null || true

    meta_append "$id" "pid=$pid"
    meta_append "$id" "out=$out"
    meta_append "$id" "dispatched_at=$(date +%s)"
    ;;

  alive)
    pid=$(meta_get "$id" pid) || exit 2
    if [ -z "$pid" ]; then exit 2; fi
    if kill -0 "$pid" 2>/dev/null; then
      exit 0
    fi
    exit 1
    ;;

  collect)
    out=$(meta_get "$id" out) || out="$STATE_DIR/$id.out"
    if [ ! -f "$out" ] || [ ! -s "$out" ]; then
      echo "dead no output"
      exit 0
    fi
    # Parse the JSON envelope (last line defends against stray stderr noise
    # captured before it). Record conversation_id + tokens once.
    result=$(python3 - "$out" <<'PYEOF'
import json, sys
raw = open(sys.argv[1]).read().strip()
try:
    d = json.loads(raw)
except json.JSONDecodeError:
    try:
        d = json.loads(raw.splitlines()[-1])
    except Exception:
        print("dead unparseable output"); raise SystemExit
status = d.get("status", "")
cid = d.get("conversation_id", "")
tok = (d.get("usage") or {}).get("total_tokens", "")
if status == "SUCCESS":
    print(f"done run completed (tokens={tok})|{cid}|{tok}")
elif status == "ERROR":
    err = (d.get("error") or "")[:120]
    print(f"blocked agy error: {err}|{cid}|{tok}")
else:
    print("dead no status in envelope||")
PYEOF
)
    detail="${result%%|*}"
    rest="${result#*|}"
    cid="${rest%%|*}"
    tok="${rest#*|}"
    if [ -n "$cid" ] && ! grep -q "^conversation_id=" "$STATE_DIR/$id.meta" 2>/dev/null; then
      meta_append "$id" "conversation_id=$cid"
      meta_append "$id" "tokens_total=$tok"
    fi
    echo "$detail"
    ;;

  *)
    echo "ERROR: unknown verb $verb" >&2
    exit 2
    ;;
esac
