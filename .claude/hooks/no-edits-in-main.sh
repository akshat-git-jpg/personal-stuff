#!/usr/bin/env bash
# The second wall: no EDITING TRACKED FILES in the main checkout of this repo.
#
# Its sibling, no-history-in-main.sh, blocks git verbs that record history. That is the
# right chokepoint for the disaster it names: a scoped `git add <file>` in main sweeping
# up a concurrent session's uncommitted edit (2026-08-22). Guarding writes would not have
# prevented that, which is why it does not.
#
# But it leaves the other half unguarded, and CLAUDE.md already says so: "The Stop hook
# now nags on a dirty main checkout, but by then the work is already in the wrong place."
# On 2026-08-27 a session edited a tracked file in main by hand, then hit the git wall
# four times in a row trying to undo it — the wall held, and the work was still in the
# wrong tree. Blocking the edit is what stops that at the moment it happens, instead of
# reporting it once the turn is over.
#
# What it does NOT block, deliberately:
#   - anything outside the main checkout of the repo that ships this file
#   - a linked worktree (a pp-work workspace) — that is where work belongs
#   - UNTRACKED files. CLAUDE.md permits "read, talk, and scratch only" on main, a scratch
#     file is untracked by definition, and an untracked file cannot be swept into someone
#     else's scoped commit.
#
# Wired as a PreToolUse hook (matcher: Edit|Write|NotebookEdit) in .claude/settings.json.
# Deliberate one-off override:  touch .claude/allow-main-edit
# That sentinel expires after ALLOW_WINDOW seconds, so it cannot silently disarm the wall
# for good the way a permanent flag file would.
set -u

ALLOW_WINDOW=600        # seconds a touched sentinel stays valid

INPUT="$(cat)"

# A JSON runtime, resolved once — same approach and same reasoning as the sibling wall.
JSON_RT=""; JSON_KIND=""
for c in python3 python py; do
  command -v "$c" >/dev/null 2>&1 && { JSON_RT="$c"; JSON_KIND=py; break; }
done
if [ -z "$JSON_RT" ] && command -v node >/dev/null 2>&1; then
  JSON_RT=node; JSON_KIND=node
fi

# Fail CLOSED, like the sibling. A silently-absent wall is the failure this exists to
# prevent. The sibling already refuses every Bash command without a runtime, so a machine
# in this state is unusable either way; refusing loudly beats passing silently.
if [ -z "$JSON_RT" ]; then
  echo "no-edits-in-main: no JSON runtime on PATH (need python3, python, py or node)." >&2
  echo "  This repo's main-checkout write wall cannot run without one, so it is refusing" >&2
  echo "  the edit rather than passing it silently. Install Node or Python, then retry." >&2
  exit 2
fi

json_field() {
  if [ "$JSON_KIND" = py ]; then
    printf '%s' "$INPUT" | "$JSON_RT" -c "
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
  else
    printf '%s' "$INPUT" | "$JSON_RT" -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  let v; try { v = JSON.parse(s); } catch (e) { return; }
  for (const k of process.argv[1].split(".")) {
    v = (v && typeof v === "object") ? v[k] : undefined;
  }
  process.stdout.write(typeof v === "string" ? v : "");
});' "$1" 2>/dev/null
  fi
}

RAW_PATH="$(json_field tool_input.file_path)"
CWD="$(json_field cwd)"
[ -n "$RAW_PATH" ] || exit 0          # nothing to judge

# Resolve to an absolute path. A relative path resolves against the session cwd, and the
# file need not exist yet (Write creates it), so resolve the PARENT directory.
case "$RAW_PATH" in
  /*) ABS="$RAW_PATH" ;;
  *)  ABS="${CWD:-$PWD}/$RAW_PATH" ;;
esac
DIR="$(dirname "$ABS")"
BASE="$(basename "$ABS")"
DIR_P="$(cd "$DIR" 2>/dev/null && pwd -P)" || exit 0
[ -n "$DIR_P" ] || exit 0
ABS_P="$DIR_P/$BASE"

git -C "$DIR_P" rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Absolute-path normalisation matters here for the same reason as in the sibling:
# --git-common-dir comes back RELATIVE below the toplevel, so a raw comparison would
# silently never match for a file in pipelines/, apps/ or tooling/.
read -r GD GCD < <(git -C "$DIR_P" rev-parse --path-format=absolute --git-dir --git-common-dir 2>/dev/null | tr '\n' ' ')
[ -n "${GD:-}" ] && [ -n "${GCD:-}" ] || exit 0
[ "$GD" = "$GCD" ] || exit 0          # a linked worktree — exactly where work belongs

# Self-identifying repo test, like the sibling: the repo that ships this wall is the repo
# it applies to. No hardcoded path, so it cannot follow a tracked settings.json onto some
# other machine and match the wrong tree.
MAIN_TOP="$(dirname "$GCD")"
[ -f "$MAIN_TOP/.claude/hooks/no-edits-in-main.sh" ] || exit 0

# Untracked is allowed: scratch on main is permitted, and an untracked file cannot be
# swept into another session's scoped commit.
git -C "$DIR_P" ls-files --error-unmatch -- "$ABS_P" >/dev/null 2>&1 || exit 0

# A recently touched sentinel is a deliberate, self-expiring override.
SENTINEL="$MAIN_TOP/.claude/allow-main-edit"
if [ -f "$SENTINEL" ]; then
  NOW=$(date +%s)
  MOD=$(stat -f %m "$SENTINEL" 2>/dev/null || stat -c %Y "$SENTINEL" 2>/dev/null || echo 0)
  if [ "$MOD" -gt 0 ] && [ $((NOW - MOD)) -lt "$ALLOW_WINDOW" ]; then
    echo "no-edits-in-main: allowing this edit — $SENTINEL was touched $((NOW - MOD))s ago." >&2
    exit 0
  fi
fi

REL="${ABS_P#"$MAIN_TOP"/}"

cat >&2 <<MSG
BLOCKED: editing a tracked file in the main checkout.

  $REL

You cannot commit it here — the sibling wall (no-history-in-main.sh) refuses that — so an
edit made here sits in a tree two sessions share until someone else's commit sweeps it up,
or you lose track of it. The Stop hook would nag you about it later; this stops it now.

Do this instead:
  cd "\$(pp-work claim --kind code --slug <short-task-name>)"
and make the edit there. It lands on main by itself.

Already have a workspace? Edit the file under that path instead of this one.

Reading is fine. Untracked scratch files here are fine. Only tracked files are refused.

Deliberate one-off (expires after $((ALLOW_WINDOW / 60)) minutes):
  touch $MAIN_TOP/.claude/allow-main-edit
MSG
exit 2
