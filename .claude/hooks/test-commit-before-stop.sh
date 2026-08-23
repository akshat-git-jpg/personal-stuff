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

# 7. the MAIN checkout is never nagged: the wall forbids committing there, so a block
#    would be a dead end with no way out.
printf 'dirty\n' >> "$MAIN/README.md"
expect 0 "$MAIN" false \
  'FAIL: STOP-GUARD blocked in the main checkout, where committing is forbidden anyway'
git -C "$MAIN" checkout -- README.md >/dev/null 2>&1

# 8. a linked worktree that is NOT a pp-work workspace (a wt pool slot, the landing tree)
printf 'dirty\n' >> "$PLAIN/README.md"
expect 0 "$PLAIN" false \
  'FAIL: STOP-GUARD blocked in a non-workspace worktree (wt pool / landing tree)'

# 9. a repo that does not ship this hook must never be affected — ZluriHQ work repos
expect 0 "$FWS/repo" false \
  'FAIL: STOP-GUARD fired in a repo that does not ship it (work repos would be affected)'

# 10. a cwd that is not a git repo at all
expect 0 "$TMP" false \
  'FAIL: STOP-GUARD did not exit cleanly outside a git repository'

if [ "$FAILURES" -ne 0 ]; then
  echo "$FAILURES test(s) failed"
  exit 1
fi

echo "ALL TESTS PASSED"
