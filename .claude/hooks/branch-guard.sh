#!/usr/bin/env bash
# branch-guard: block git branch switches in the MAIN checkout while another
# Claude session is live in the same checkout.
#
# Why: two concurrent sessions sharing one checkout means a `git switch` in
# session B silently moves HEAD under session A, so A's next commits land on
# B's branch. That interleaving is what forced the exclusion-cherry-pick mess
# on advisor/055 (2026-07-10). This hook blocks only the destructive act —
# branch switching while someone else is active — and stays silent otherwise.
#
# Wired as a PreToolUse hook (matcher: Bash) in .claude/settings.json.
# Override for a deliberate switch: prefix the command with GUARD_OK=1.

set -u

MAIN_CHECKOUT="/Users/kbtg/codebase/personal-stuff"
TRANSCRIPT_DIRS=(
  "$HOME/.claude-work/projects/-Users-kbtg-codebase-personal-stuff"
  "$HOME/.claude/projects/-Users-kbtg-codebase-personal-stuff"
)
LIVE_WINDOW_MIN=5   # a transcript touched within this many minutes = live session

INPUT="$(cat)"

json_field() {
  printf '%s' "$INPUT" | python3 -c "
import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
v = d
for k in sys.argv[1].split('.'):
    v = v.get(k, {}) if isinstance(v, dict) else {}
print(v if isinstance(v, str) else '')
" "$1" 2>/dev/null
}

CMD="$(json_field tool_input.command)"
SESSION_ID="$(json_field session_id)"
CWD="$(json_field cwd)"

# Not a branch-moving command -> allow. Matches `git switch X` / `git checkout X`
# (also rtk-prefixed), but NOT path restores (`git checkout -- file`).
if ! printf '%s' "$CMD" | grep -qE '(^|[;&|]\s*|\s)(rtk\s+)?git\s+(switch|checkout)\s+[^-]'; then
  exit 0
fi
# `git checkout <ref> -- <path>` is a path restore, not a branch move -> allow.
if printf '%s' "$CMD" | grep -qE 'git\s+(switch|checkout)\s+\S+\s+--\s'; then
  exit 0
fi

# Explicit override -> allow.
if printf '%s' "$CMD" | grep -q 'GUARD_OK=1'; then
  exit 0
fi

# Only guard the main checkout; worktrees are already isolated.
case "$CWD" in
  "$MAIN_CHECKOUT"|"$MAIN_CHECKOUT"/*) : ;;
  *) exit 0 ;;
esac

# Any other live session in this checkout?
OTHERS=0
for dir in "${TRANSCRIPT_DIRS[@]}"; do
  [ -d "$dir" ] || continue
  while IFS= read -r f; do
    base="$(basename "$f" .jsonl)"
    [ "$base" = "$SESSION_ID" ] && continue
    OTHERS=$((OTHERS + 1))
  done < <(find "$dir" -name '*.jsonl' -mmin "-$LIVE_WINDOW_MIN" 2>/dev/null)
done

if [ "$OTHERS" -gt 0 ]; then
  cat >&2 <<'MSG'
BLOCKED: another Claude session is live in this checkout right now.
Switching branches here would move HEAD under that session, and its next
commits would land on YOUR branch (this is how advisor/055 got mangled).

Do one of these instead:
  1. Work in an isolated worktree on a named branch:
       path=$(wt get --holder <task>) && cd "$path" && git switch -c task/<name>
  2. Wait ~5 minutes for the other session to go idle, then retry.
  3. If you are CERTAIN the other session is done, override deliberately:
       GUARD_OK=1 git switch <branch>
MSG
  exit 2
fi

exit 0
