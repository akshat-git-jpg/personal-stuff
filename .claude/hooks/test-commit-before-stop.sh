#!/usr/bin/env bash
# Behavioural harness for the Stop hook (.claude/hooks/commit-before-stop.sh).
#
# Every case feeds the REAL hook REAL Stop-hook JSON on stdin and checks the REAL exit code.
# Nothing inspects the hook's source text — a source assertion would pass for a hook that
# never runs, which is the failure mode this whole system keeps rediscovering.
#
# Fixtures: a repo that ships the hook (identified by the hook's own filename, same
# self-identifying trick the wall uses), a linked worktree that IS a pp-work workspace (its
# parent holds a `manifest`), a linked worktree that is NOT one, and a foreign repo.
#
# Failures do not abort the run: every case is reported, then exit 1. The mutation gate greps
# for one specific FAIL line, so every message carries STOP-GUARD.
set -u

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$HOOK_DIR/commit-before-stop.sh"

[ -f "$HOOK" ] || { echo "FAIL: STOP-GUARD hook not found at $HOOK"; exit 1; }
[ -x "$HOOK" ] || { echo "FAIL: STOP-GUARD hook is not executable: $HOOK"; exit 1; }

TMP="$(mktemp -d)"
cleanup() { [ -n "${TMP:-}" ] && rm -rf "$TMP"; }
trap cleanup EXIT

FAILURES=0
jstr() { python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1"; }

run_hook() {  # run_hook <cwd> <stop_hook_active:true|false>
  printf '{"cwd":%s,"stop_hook_active":%s,"session_id":"t","hook_event_name":"Stop"}' \
    "$(jstr "$1")" "$2" | bash "$HOOK" >/dev/null 2>&1
  echo $?
}

expect() {  # expect <want> <cwd> <active> <msg>
  local want="$1" cwd="$2" active="$3" msg="$4" got
  got="$(run_hook "$cwd" "$active")"
  if [ "$got" != "$want" ]; then
    echo "$msg (cwd=$cwd active=$active want exit $want, got $got)"
    FAILURES=$((FAILURES + 1))
  fi
}

# --- fixture: the repo that ships the hook ---
MAIN="$TMP/main"
git init -q "$MAIN"
git -C "$MAIN" config user.email harness@example.invalid
git -C "$MAIN" config user.name harness
mkdir -p "$MAIN/.claude/hooks"
cp "$HOOK" "$MAIN/.claude/hooks/commit-before-stop.sh"
printf 'seed\n' > "$MAIN/README.md"
printf 'ignored-dir/\n*.mp4\n' > "$MAIN/.gitignore"
git -C "$MAIN" add -A >/dev/null 2>&1
git -C "$MAIN" commit -qm seed >/dev/null 2>&1

# a linked worktree that IS a pp-work workspace: parent holds the manifest
WSPARENT="$TMP/ws/demo"
mkdir -p "$WSPARENT"
WS="$WSPARENT/repo"
git -C "$MAIN" worktree add -q "$WS" -b work/demo >/dev/null 2>&1
printf 'kind=code\nslug=demo\nbranch=work/demo\n' > "$WSPARENT/manifest"
[ -d "$WS" ] || { echo "FAIL: STOP-GUARD could not build the workspace fixture"; exit 1; }
mkdir -p "$WS/sub"

# a linked worktree that is NOT a pp-work workspace (no manifest beside it)
PLAIN="$TMP/plain"
git -C "$MAIN" worktree add -q "$PLAIN" -b harness/plain >/dev/null 2>&1

# a repo that does not ship the hook
FOREIGN="$TMP/foreign"
git init -q "$FOREIGN"
git -C "$FOREIGN" config user.email harness@example.invalid
git -C "$FOREIGN" config user.name harness
printf 'seed\n' > "$FOREIGN/README.md"
git -C "$FOREIGN" add -A >/dev/null 2>&1
git -C "$FOREIGN" commit -qm seed >/dev/null 2>&1
FWS="$TMP/fws/demo"; mkdir -p "$FWS"
git -C "$FOREIGN" worktree add -q "$FWS/repo" -b work/demo >/dev/null 2>&1
printf 'kind=code\nslug=demo\nbranch=work/demo\n' > "$FWS/manifest"
printf 'dirty\n' > "$FWS/repo/new.txt"

# --- the cases ---

# 1. a CLEAN workspace must let the turn end
expect 0 "$WS" false \
  'FAIL: STOP-GUARD blocked a turn on a CLEAN workspace'

# 2. a MODIFIED tracked file must block
printf 'changed\n' >> "$WS/README.md"
expect 2 "$WS" false \
  'FAIL: STOP-GUARD did not block a workspace with a modified tracked file'

# 3. it must block from a SUBDIRECTORY too — the position a naive check misses
expect 2 "$WS/sub" false \
  'FAIL: STOP-GUARD did not block from a workspace SUBDIRECTORY'

# 4. the loop guard: once the harness says it already blocked, the turn must be allowed out.
#    Without this a red-check turn (which commit-now forbids committing) blocks forever.
expect 0 "$WS" true \
  'FAIL: STOP-GUARD ignored stop_hook_active and would trap the turn in a loop'
git -C "$WS" checkout -- README.md >/dev/null 2>&1

# 5. a NEW untracked source file is uncommitted work too
printf 'new\n' > "$WS/added.txt"
expect 2 "$WS" false \
  'FAIL: STOP-GUARD ignored a new untracked file'
rm -f "$WS/added.txt"

# 6. GITIGNORED output must never block. A render or node_modules is not work to commit,
#    and blocking on one would nag on every single turn of a video run.
mkdir -p "$WS/ignored-dir"
printf 'x\n' > "$WS/ignored-dir/junk"
printf 'x\n' > "$WS/render.mp4"
expect 0 "$WS" false \
  'FAIL: STOP-GUARD blocked on gitignored output (a render would nag every turn)'
rm -rf "$WS/ignored-dir" "$WS/render.mp4"

# 7. a CLEAN main checkout must let the turn end. Main is shared and usually clean-ish;
#    nagging on nothing would make the whole main-checkout branch pure noise.
expect 0 "$MAIN" false \
  'FAIL: STOP-GUARD blocked in a CLEAN main checkout'

# 8. a dirty MAIN checkout must nag. Until 2026-08-23 it did not, and that was the hole: a
#    session that never claimed a workspace tripped NEITHER hook, because the wall waits for
#    a git verb that never comes and this hook exited early here. The nag asks for
#    relocation, not a commit — committing in main is still forbidden.
printf 'dirty\n' >> "$MAIN/README.md"
expect 2 "$MAIN" false \
  'FAIL: STOP-GUARD did not nag in a DIRTY main checkout (the silent hole is back)'

# 9. the loop guard has to hold in main too, or a turn whose dirty files ALL belong to
#    another session could never end.
expect 0 "$MAIN" true \
  'FAIL: STOP-GUARD ignored stop_hook_active in main and would trap the turn in a loop'

# 10. an UNTRACKED file in main is work in the wrong place, same as in a workspace.
git -C "$MAIN" checkout -- README.md >/dev/null 2>&1
printf 'new\n' > "$MAIN/stray.txt"
expect 2 "$MAIN" false \
  'FAIL: STOP-GUARD ignored an untracked file in the main checkout'
rm -f "$MAIN/stray.txt"

# 11. gitignored output in main must not nag either — a render sitting in main is not work.
mkdir -p "$MAIN/ignored-dir"
printf 'x\n' > "$MAIN/ignored-dir/junk"
printf 'x\n' > "$MAIN/render.mp4"
expect 0 "$MAIN" false \
  'FAIL: STOP-GUARD nagged on gitignored output in the main checkout'
rm -rf "$MAIN/ignored-dir" "$MAIN/render.mp4"

# 12. the main-checkout branch must still be repo-gated. The identity check moved ABOVE the
#     main-vs-worktree split to cover it; if it ever slips back below, every dirty ZluriHQ
#     work repo starts nagging.
printf 'dirty\n' >> "$FOREIGN/README.md"
expect 0 "$FOREIGN" false \
  'FAIL: STOP-GUARD nagged in the MAIN checkout of a repo that does not ship it'
git -C "$FOREIGN" checkout -- README.md >/dev/null 2>&1

# 13. a linked worktree that is NOT a pp-work workspace (a wt pool slot, the landing tree)
printf 'dirty\n' >> "$PLAIN/README.md"
expect 0 "$PLAIN" false \
  'FAIL: STOP-GUARD blocked in a non-workspace worktree (wt pool / landing tree)'

# 14. a repo that does not ship this hook must never be affected — ZluriHQ work repos
expect 0 "$FWS/repo" false \
  'FAIL: STOP-GUARD fired in a repo that does not ship it (work repos would be affected)'

# 15. a cwd that is not a git repo at all
expect 0 "$TMP" false \
  'FAIL: STOP-GUARD did not exit cleanly outside a git repository'

# --- sessions that run in main and edit a workspace by absolute path (2026-10-14) ---
# The Bash cwd resets after every call, so a session's cwd is main even while it works in a
# workspace. The hook must find those workspaces in the transcript.
git -C "$PLAIN" checkout -- README.md >/dev/null 2>&1
WSR="$(git -C "$WS" rev-parse --show-toplevel)"
PLAINR="$(git -C "$PLAIN" rev-parse --show-toplevel)"
T="$TMP/transcript.jsonl"

run_hook_t() {  # run_hook_t <cwd> <active> <transcript line>
  printf '%s\n' "$3" > "$T"
  printf '{"cwd":%s,"stop_hook_active":%s,"transcript_path":%s,"session_id":"t","hook_event_name":"Stop"}' \
    "$(jstr "$1")" "$2" "$(jstr "$T")" | bash "$HOOK" >/dev/null 2>&1
  echo $?
}
expect_t() {  # expect_t <want> <cwd> <active> <transcript line> <msg>
  local got; got="$(run_hook_t "$2" "$3" "$4")"
  if [ "$got" != "$1" ]; then
    echo "$5 (want exit $1, got $got)"
    FAILURES=$((FAILURES + 1))
  fi
}

EDIT_WS='{"type":"tool_use","name":"Edit","input":{"file_path":"'"$WSR"'/README.md"}}'
CD_WS='{"type":"tool_use","name":"Bash","input":{"command":"cd '"$WSR"' && git status"}}'
READ_WS='{"type":"tool_use","name":"Bash","input":{"command":"git -C '"$WSR"' status --porcelain"}}'

# 16. clean main, session edited a DIRTY workspace by path: must block
printf 'changed\n' >> "$WS/README.md"
expect_t 2 "$MAIN" false "$EDIT_WS" \
  'FAIL: STOP-GUARD missed a dirty workspace edited from main by absolute path'

# 17. same, via a Bash `cd <workspace>`
expect_t 2 "$MAIN" false "$CD_WS" \
  'FAIL: STOP-GUARD missed a dirty workspace a Bash command cd-ed into'

# 18. a session that only READ the workspace must not be blamed for its dirt
expect_t 0 "$MAIN" false "$READ_WS" \
  'FAIL: STOP-GUARD blamed a session that only read a dirty workspace'

# 19. the loop guard holds for the transcript check too
expect_t 0 "$MAIN" true "$EDIT_WS" \
  'FAIL: STOP-GUARD ignored stop_hook_active on the touched-workspace check'
git -C "$WS" checkout -- README.md >/dev/null 2>&1

# 20. a touched workspace that is CLEAN must let the turn end
expect_t 0 "$MAIN" false "$EDIT_WS" \
  'FAIL: STOP-GUARD blocked on a touched workspace that is clean'

# 21. a dirty worktree that is NOT a pp-work workspace stays out of scope
printf 'dirty\n' >> "$PLAIN/README.md"
expect_t 0 "$MAIN" false '{"type":"tool_use","name":"Edit","input":{"file_path":"'"$PLAINR"'/README.md"}}' \
  'FAIL: STOP-GUARD blocked on a touched non-workspace worktree'
git -C "$PLAIN" checkout -- README.md >/dev/null 2>&1

# 22-23. SubagentStop judges the subagent's own transcript, not its parent's
AT="$TMP/agent.jsonl"
run_sub() {  # run_sub <agent transcript line>
  printf '%s\n' "$EDIT_WS" > "$T"
  printf '%s\n' "$1" > "$AT"
  printf '{"cwd":%s,"stop_hook_active":false,"transcript_path":%s,"agent_transcript_path":%s,"session_id":"t","hook_event_name":"SubagentStop"}' \
    "$(jstr "$MAIN")" "$(jstr "$T")" "$(jstr "$AT")" | bash "$HOOK" >/dev/null 2>&1
  echo $?
}
printf 'changed\n' >> "$WS/README.md"
[ "$(run_sub "$READ_WS")" = 0 ] || { echo 'FAIL: STOP-GUARD blamed a read-only subagent for its parent'"'"'s edits'; FAILURES=$((FAILURES + 1)); }
[ "$(run_sub "$EDIT_WS")" = 2 ] || { echo 'FAIL: STOP-GUARD missed a subagent that edited a dirty workspace'; FAILURES=$((FAILURES + 1)); }
git -C "$WS" checkout -- README.md >/dev/null 2>&1

if [ "$FAILURES" -ne 0 ]; then
  echo "$FAILURES test(s) failed"
  exit 1
fi

echo "ALL TESTS PASSED"
