#!/usr/bin/env bash
# The wall: no RECORDING HISTORY in the main checkout of this repo.
#
# Why the commit and not the write: on 2026-08-22 a session ran `git add decisions.md` —
# one file, correctly scoped — and committed a concurrent session's unrelated 36-line
# edit, because the on-disk copy already contained it. Both sessions were entitled to
# edit that file, so guarding writes fixes nothing. Recording history is the chokepoint.
#
# Replaces branch-guard.sh, which (a) had `\s+[^-]` after the verb so ANY flag bypassed
# it, (b) covered only switch/checkout, and (c) fired only when another transcript had
# been touched in the last 5 minutes — probabilistic, on a deterministic invariant.
#
# Wired as a PreToolUse hook (matcher: Bash) in .claude/settings.json.
# Deliberate one-off override: prefix the command with GUARD_OK=1.
set -u

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
CWD="$(json_field cwd)"
[ -n "$CMD" ] || exit 0

# --- cheapest test first: does this even look like a history-recording git verb? ---
# Allows any number of flags, including flag-with-value pairs like `-C <path>`, which is
# exactly what branch-guard.sh's `\s+[^-]` failed to handle.
VERBS='add|commit|stash|rebase|merge|switch|checkout|reset|cherry-pick|am|apply|revert|tag'
if ! printf '%s' "$CMD" | grep -qE "(^|[;&|(]|[[:space:]])(rtk[[:space:]]+)?git([[:space:]]+-{1,2}[^[:space:]]+([[:space:]]+[^-][^[:space:]]*)?)*[[:space:]]+($VERBS)([[:space:]]|$)"; then
  exit 0
fi

# `git checkout <ref> -- <path>` / `git checkout -- <path>` is a path restore, not history.
if printf '%s' "$CMD" | grep -qE 'git[[:space:]]+(switch|checkout)[[:space:]]+([^[:space:]]+[[:space:]]+)?--[[:space:]]'; then
  exit 0
fi

# Deliberate human override.
printf '%s' "$CMD" | grep -q 'GUARD_OK=1' && exit 0

# --- is CWD the MAIN worktree of the repo that ships this wall? ---
[ -n "$CWD" ] || exit 0
git -C "$CWD" rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Absolute-path normalisation below is load-bearing. Raw rev-parse output is absolute
# for --git-dir but RELATIVE for --git-common-dir below the toplevel, so a raw
# comparison silently fails
# open in pipelines/, apps/, tooling/ — where sessions actually run.
read -r GD GCD < <(git -C "$CWD" rev-parse --path-format=absolute --git-dir --git-common-dir 2>/dev/null | tr '\n' ' ')
[ -n "${GD:-}" ] && [ -n "${GCD:-}" ] || exit 0
[ "$GD" = "$GCD" ] || exit 0          # a linked worktree — the whole point is that it is allowed

# Self-identifying repo test: the repo that ships this wall is the repo it applies to.
# No hardcoded path (branch-guard.sh's was this Mac's, and .claude/settings.json is
# tracked, so it shipped to the VPS and matched nothing) and no origin-URL coupling.
MAIN_TOP="$(dirname "$GCD")"
[ -f "$MAIN_TOP/.claude/hooks/no-history-in-main.sh" ] || exit 0

cat >&2 <<MSG
BLOCKED: recording git history in the main checkout.

Two sessions share this working tree, so a commit here can capture another session's
uncommitted edits — even a correctly-scoped one (2026-08-22).

Do this instead:
  cd "\$(pp-work claim --kind code --slug <short-task-name>)"
and run the same git command there. It lands on main by itself.

Deliberate one-off: GUARD_OK=1 <your command>
MSG
exit 2
