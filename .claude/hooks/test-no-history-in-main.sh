#!/usr/bin/env bash
# Behavioural harness for the wall (.claude/hooks/no-history-in-main.sh).
#
# Every case feeds the REAL hook REAL PreToolUse JSON on stdin and checks the REAL exit
# code. Nothing here inspects the hook's source text — a source-text assertion would pass
# for a hook that never runs.
#
# It builds a throwaway repo in mktemp -d and plants a copy of the hook's own filename in
# it, because the wall identifies its repo by that marker rather than by a hardcoded path.
# A second throwaway repo WITHOUT the marker stands in for a ZluriHQ work repo.
#
# Failures do NOT abort the run: every case is reported, then the script exits 1. That
# matters because the mutation gate greps for one specific FAIL line.
set -u

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$HOOK_DIR/no-history-in-main.sh"
REPO_ROOT="$(dirname "$HOOK_DIR")"
REPO_ROOT="$(dirname "$REPO_ROOT")"

[ -f "$HOOK" ] || { echo "FAIL: hook not found at $HOOK"; exit 1; }
[ -x "$HOOK" ] || { echo "FAIL: hook is not executable: $HOOK"; exit 1; }

# Run from the repo root so results never depend on the caller's cwd.
cd "$REPO_ROOT" || exit 1

TMP="$(mktemp -d)"
cleanup() { [ -n "${TMP:-}" ] && rm -rf "$TMP"; }
trap cleanup EXIT

FAILURES=0

jstr() { python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1"; }

run_hook() {  # run_hook <cwd> <command> ; echoes the hook's exit code
  printf '{"tool_input":{"command":%s},"cwd":%s,"session_id":"t"}' \
    "$(jstr "$2")" "$(jstr "$1")" \
    | bash "$HOOK" >/dev/null 2>&1
  echo $?
}

expect() {  # expect <want> <cwd> <command> <fail message>
  local want="$1" cwd="$2" cmd="$3" msg="$4" got
  got="$(run_hook "$cwd" "$cmd")"
  if [ "$got" != "$want" ]; then
    echo "$msg (cwd=$cwd cmd=[$cmd] want exit $want, got $got)"
    FAILURES=$((FAILURES + 1))
  fi
}

# --- fixture: a repo that ships the wall, plus a linked worktree ---
MAIN="$TMP/main"
git init -q "$MAIN" >/dev/null 2>&1
git -C "$MAIN" config user.email harness@example.invalid
git -C "$MAIN" config user.name harness
mkdir -p "$MAIN/.claude/hooks" "$MAIN/pipelines"
printf '#!/usr/bin/env bash\nexit 0\n' > "$MAIN/.claude/hooks/no-history-in-main.sh"
printf 'seed\n' > "$MAIN/README.md"
git -C "$MAIN" add -A >/dev/null 2>&1
git -C "$MAIN" commit -qm seed >/dev/null 2>&1
MAIN_SUB="$MAIN/pipelines"

WT="$TMP/wt"
git -C "$MAIN" worktree add -q "$WT" -b harness/wt >/dev/null 2>&1
[ -d "$WT" ] || { echo "FAIL: could not create the linked worktree fixture"; exit 1; }
mkdir -p "$WT/pipelines"
WT_SUB="$WT/pipelines"

# --- fixture: a repo that does NOT ship the wall (the ZluriHQ case) ---
FOREIGN="$TMP/foreign"
git init -q "$FOREIGN" >/dev/null 2>&1
git -C "$FOREIGN" config user.email harness@example.invalid
git -C "$FOREIGN" config user.name harness
printf 'seed\n' > "$FOREIGN/README.md"
git -C "$FOREIGN" add -A >/dev/null 2>&1
git -C "$FOREIGN" commit -qm seed >/dev/null 2>&1

# --- the cases ---

# 1. main toplevel, a plain commit
expect 2 "$MAIN" 'git commit -m x' \
  'FAIL: wall did not fire at the TOPLEVEL of the main worktree'

# 2. main SUBDIRECTORY — the position a raw rev-parse compare silently fails open in
expect 2 "$MAIN_SUB" 'git commit -m x' \
  'FAIL: wall did not fire in a SUBDIRECTORY of the main worktree'

# 3-5. the three flag forms that sail straight through branch-guard.sh's `\s+[^-]`
expect 2 "$MAIN" 'git checkout -q main' \
  'FAIL: wall did not fire on `git checkout -q main` (flag form)'
expect 2 "$MAIN" 'git checkout -b feature/x' \
  'FAIL: wall did not fire on `git checkout -b` (new-branch form)'
expect 2 "$MAIN" 'git switch -c feature/x' \
  'FAIL: wall did not fire on `git switch -c` (new-branch form)'

# 6. flag-with-value form
expect 2 "$MAIN" 'git -C /some/path commit -m x' \
  'FAIL: wall did not fire on the `git -C <path> commit` flag-with-value form'

# 7-8. a linked worktree is the sanctioned place to record history — never blocked
expect 0 "$WT" 'git commit -m x' \
  'FAIL: wall BLOCKED a commit at a linked worktree toplevel'
expect 0 "$WT_SUB" 'git commit -m x' \
  'FAIL: wall BLOCKED a commit in a linked worktree subdirectory'

# 9. a script that commits internally is invisible to a command-string matcher, which is
#    exactly why boss and secretary need no changes
expect 0 "$MAIN" 'bash tooling/boss/bin/boss-merge.sh 1' \
  'FAIL: wall blocked a script invocation (a command-string matcher cannot see inside it)'

# 10. read-only verbs are untouched
expect 0 "$MAIN" 'git status' \
  'FAIL: wall blocked a read-only git verb'

# 11. a path restore is not history
expect 0 "$MAIN" 'git checkout -- README.md' \
  'FAIL: wall blocked a path restore (`git checkout -- <path>`)'

# 12. the deliberate one-off override
expect 0 "$MAIN" 'GUARD_OK=1 git commit -m x' \
  'FAIL: GUARD_OK=1 override did not let the command through'

# 13. writes stay free — the commit is the chokepoint, not the write
expect 0 "$MAIN" 'echo hello > f.txt' \
  'FAIL: wall blocked a plain file write'

# 14. a repo that does not ship the wall is never blocked
expect 0 "$FOREIGN" 'git commit -m x' \
  'FAIL: wall fired in a repo that does not ship it (ZluriHQ repos would be affected)'

if [ "$FAILURES" -ne 0 ]; then
  echo "$FAILURES test(s) failed"
  exit 1
fi

echo "ALL TESTS PASSED"
