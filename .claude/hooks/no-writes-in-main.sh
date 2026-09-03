#!/usr/bin/env bash
# The third wall: no Bash-subprocess WRITES TO TRACKED FILES in the main checkout.
#
# Its siblings, no-history-in-main.sh and no-edits-in-main.sh, catch git verbs and
# Claude's own Edit/Write/NotebookEdit tool calls. Neither sees a Bash call whose
# SUBPROCESS writes a tracked file as a side effect (a Node CLI appending to a log,
# `sed -i` on a tracked file, a formatter run in place). That class recurs — the
# 2026-09-03 heygen-web incident (render-log.mjs appendFileSync'ing RENDERS.md
# regardless of caller cwd) is one instance; any repo-owned CLI that resolves write
# paths off import.meta.url / __dirname rather than the caller's cwd is the same shape.
#
# Unlike the other two walls, this one cannot block the write *before* it happens —
# the subprocess is opaque to PreToolUse. So it works around the call instead: snapshot
# `git status` before the Bash command runs (PreToolUse), diff against a fresh snapshot
# after it finishes (PostToolUse), and for anything newly dirty, quarantine the content
# then revert it. Warn-only fails identically to the existing Stop-hook nag — by the
# time the message prints, the work is already in the wrong tree. Auto-revert is the
# "won't happen again" commitment; quarantining first is what makes that commitment safe.
#
# What it does NOT touch, deliberately:
#   - anything outside the main checkout of the repo that ships this file
#   - a linked worktree (a pp-work workspace) — that is where work belongs
#   - UNTRACKED files — git status -uno omits them entirely, so a scratch file never
#     shows up in the diff at all
#   - a path listed in .claude/allow-main-writes.list (a known-legit write-through)
#
# Wired as BOTH a PreToolUse and a PostToolUse hook (matcher: Bash) in .claude/settings.json.
# Pre/Post pairing uses a single-slot snapshot file per session — safe because Claude Code
# executes tool calls serially within a session.
# Deliberate one-off override:  touch .claude/allow-main-edit
# Same sentinel as no-edits-in-main.sh, same ALLOW_WINDOW expiry.
set -u

ALLOW_WINDOW=600        # seconds a touched sentinel stays valid

INPUT="$(cat)"

# A JSON runtime, resolved once — same approach and same reasoning as the sibling walls.
JSON_RT=""; JSON_KIND=""
for c in python3 python py; do
  command -v "$c" >/dev/null 2>&1 && { JSON_RT="$c"; JSON_KIND=py; break; }
done
if [ -z "$JSON_RT" ] && command -v node >/dev/null 2>&1; then
  JSON_RT=node; JSON_KIND=node
fi

# Fail CLOSED, like the siblings. A silently-absent wall is the failure this exists to
# prevent, and no-history-in-main.sh already refuses every Bash command without a
# runtime, so a machine in this state is unusable either way.
if [ -z "$JSON_RT" ]; then
  echo "no-writes-in-main: no JSON runtime on PATH (need python3, python, py or node)." >&2
  echo "  This repo's main-checkout write wall cannot run without one, so it is refusing" >&2
  echo "  the Bash call rather than passing it silently. Install Node or Python, then retry." >&2
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

HOOK_EVENT="$(json_field hook_event_name)"
TOOL_NAME="$(json_field tool_name)"
SESSION_ID="$(json_field session_id)"
CWD="$(json_field cwd)"
COMMAND="$(json_field tool_input.command)"

# Only Bash calls can have an opaque subprocess write. Everything else is either
# handled by a sibling wall or irrelevant to this one.
[ "$TOOL_NAME" = "Bash" ] || exit 0

[ -n "$SESSION_ID" ] || SESSION_ID="nosession"
STATE_DIR="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/no-writes-in-main/$SESSION_ID"
mkdir -p "$STATE_DIR" 2>/dev/null || true

CWD_P="$(cd "${CWD:-$PWD}" 2>/dev/null && pwd -P)" || exit 0
[ -n "$CWD_P" ] || exit 0
git -C "$CWD_P" rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Absolute-path normalisation matters here for the same reason as in the siblings:
# --git-common-dir comes back RELATIVE below the toplevel, so a raw comparison would
# silently never match for a command run from pipelines/, apps/ or tooling/.
read -r GD GCD < <(git -C "$CWD_P" rev-parse --path-format=absolute --git-dir --git-common-dir 2>/dev/null | tr '\n' ' ')
[ -n "${GD:-}" ] && [ -n "${GCD:-}" ] || exit 0
[ "$GD" = "$GCD" ] || exit 0          # a linked worktree — exactly where work belongs

# Self-identifying repo test, like the siblings: the repo that ships this wall is the
# repo it applies to. No hardcoded path, so it cannot follow a tracked settings.json
# onto some other machine and match the wrong tree.
MAIN_TOP="$(dirname "$GCD")"
[ -f "$MAIN_TOP/.claude/hooks/no-writes-in-main.sh" ] || exit 0

if [ "$HOOK_EVENT" = "PreToolUse" ]; then
  git -C "$MAIN_TOP" status --porcelain=v1 -uno > "$STATE_DIR/pre.snap" 2>/dev/null || : > "$STATE_DIR/pre.snap"
  exit 0
fi

[ "$HOOK_EVENT" = "PostToolUse" ] || exit 0

PRE_SNAP="$STATE_DIR/pre.snap"
POST_SNAP="$STATE_DIR/post.snap"
git -C "$MAIN_TOP" status --porcelain=v1 -uno > "$POST_SNAP" 2>/dev/null || : > "$POST_SNAP"

# Newly-dirty tracked files: present in POST with a modification status (M, A, D, R,
# C, U) that was NOT already present with the same status in PRE. Diffing porcelain
# output is easiest in the JSON runtime we already resolved above.
diff_dirty() {
  if [ "$JSON_KIND" = py ]; then
    "$JSON_RT" -c "
import sys
def parse(path):
    d = {}
    try:
        f = open(path)
    except OSError:
        return d
    with f:
        for line in f:
            line = line.rstrip('\n')
            if not line:
                continue
            status = line[:2]
            rest = line[3:]
            if ' -> ' in rest:
                rest = rest.split(' -> ', 1)[1]
            if rest.startswith('\"') and rest.endswith('\"'):
                rest = rest[1:-1]
            d[rest] = status
    return d

pre = parse(sys.argv[1])
post = parse(sys.argv[2])
mod = set('MADRCU')
for path, status in post.items():
    if not (set(status) & mod):
        continue
    if pre.get(path) == status:
        continue
    sys.stdout.write(status + '\t' + path + '\n')
" "$1" "$2" 2>/dev/null
  else
    "$JSON_RT" -e '
const fs = require("fs");
function parse(path) {
  const d = {};
  let content;
  try { content = fs.readFileSync(path, "utf8"); } catch (e) { return d; }
  for (const line of content.split("\n")) {
    if (!line) continue;
    const status = line.slice(0, 2);
    let rest = line.slice(3);
    if (rest.includes(" -> ")) rest = rest.split(" -> ")[1];
    if (rest.startsWith("\"") && rest.endsWith("\"")) rest = rest.slice(1, -1);
    d[rest] = status;
  }
  return d;
}
const pre = parse(process.argv[1]);
const post = parse(process.argv[2]);
const mod = new Set("MADRCU");
for (const [path, status] of Object.entries(post)) {
  if (![...status].some((c) => mod.has(c))) continue;
  if (pre[path] === status) continue;
  process.stdout.write(status + "\t" + path + "\n");
}
' "$1" "$2" 2>/dev/null
  fi
}

DIRTY_LIST="$(diff_dirty "$PRE_SNAP" "$POST_SNAP")"

rm -f "$PRE_SNAP" "$POST_SNAP"
rmdir "$STATE_DIR" 2>/dev/null || true

[ -n "$DIRTY_LIST" ] || exit 0

ALLOWLIST_FILE="$MAIN_TOP/.claude/allow-main-writes.list"
is_allowlisted() {
  local p="$1"
  [ -f "$ALLOWLIST_FILE" ] || return 1   # missing file = empty allow-list, fail-open here
  local pattern
  while IFS= read -r pattern; do
    case "$pattern" in ''|'#'*) continue ;; esac
    case "$p" in
      $pattern) return 0 ;;
    esac
  done < "$ALLOWLIST_FILE"
  return 1
}

# A recently touched sentinel is a deliberate, self-expiring override — checked once so
# a multi-file dirty set only prints one explanatory line, not one per file.
SENTINEL="$MAIN_TOP/.claude/allow-main-edit"
SENTINEL_ACTIVE=0
if [ -f "$SENTINEL" ]; then
  NOW=$(date +%s)
  # GNU stat first, BSD fallback — see no-edits-in-main.sh for why the order matters.
  MOD=$(stat -c %Y "$SENTINEL" 2>/dev/null || stat -f %m "$SENTINEL" 2>/dev/null || echo 0)
  case "$MOD" in ''|*[!0-9]*) MOD=0 ;; esac
  if [ "$MOD" -gt 0 ] && [ $((NOW - MOD)) -lt "$ALLOW_WINDOW" ]; then
    echo "no-writes-in-main: allowing this write — $SENTINEL was touched $((NOW - MOD))s ago." >&2
    SENTINEL_ACTIVE=1
  fi
fi

REVERTED_PATHS=()
QUARANTINE_RELS=()

while IFS=$'\t' read -r STATUS PATH_REL; do
  [ -n "$PATH_REL" ] || continue
  is_allowlisted "$PATH_REL" && continue
  [ "$SENTINEL_ACTIVE" = 1 ] && continue

  UTC="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
  FLAT="$(printf '%s' "$PATH_REL" | tr '/' '_')"
  QREL=".claude/quarantine/${UTC}__${FLAT}"
  mkdir -p "$MAIN_TOP/.claude/quarantine"
  cp "$MAIN_TOP/$PATH_REL" "$MAIN_TOP/$QREL" 2>/dev/null || true
  git -C "$MAIN_TOP" checkout -- "$PATH_REL" 2>/dev/null

  REVERTED_PATHS+=("$PATH_REL")
  QUARANTINE_RELS+=("$QREL")
done <<< "$DIRTY_LIST"

[ "${#REVERTED_PATHS[@]}" -gt 0 ] || exit 0

{
  echo "BLOCKED: a Bash command dirtied tracked files in the main checkout."
  echo
  for i in "${!REVERTED_PATHS[@]}"; do
    printf '  %s          quarantined to %s\n' "${REVERTED_PATHS[$i]}" "${QUARANTINE_RELS[$i]}"
  done
  echo
  echo "Command that dirtied them:"
  printf '  %s\n' "${COMMAND:0:200}"
  echo
  echo "The files above have been REVERTED. Their prior content was saved to the quarantine"
  echo "paths above — copy them anywhere you need. Two walls already refuse editing tracked"
  echo "files in main; this is the third, catching subprocess writes that slip through them."
  echo
  echo "Do this instead:"
  echo "  cd \"\$(pp-work claim --kind code --slug <short-task-name>)\""
  echo "and re-run the command there. It lands on main by itself."
  echo
  echo "Reading is fine. Untracked scratch files here are fine. Only writes to tracked"
  echo "files are refused."
  echo
  echo "Deliberate one-off (expires after $((ALLOW_WINDOW / 60)) minutes):"
  echo "  touch $MAIN_TOP/.claude/allow-main-edit"
} >&2

exit 2
