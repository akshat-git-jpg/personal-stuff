#!/usr/bin/env bash
# Behavioural harness for the wall (.claude/hooks/no-global-gh-switch.sh).
#
# Every case feeds the REAL hook REAL PreToolUse JSON on stdin and checks the REAL exit
# code. Nothing here inspects the hook's source text — a source-text assertion would pass
# for a hook that never runs.
#
# Failures do NOT abort the run: every case is reported, then the script exits 1.
set -u

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$HOOK_DIR/no-global-gh-switch.sh"

[ -f "$HOOK" ] || { echo "FAIL: hook not found at $HOOK"; exit 1; }
[ -x "$HOOK" ] || { echo "FAIL: hook is not executable: $HOOK"; exit 1; }

FAILURES=0
jstr() { python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1"; }

run_hook() {  # run_hook <command> ; echoes the hook's exit code
  printf '{"tool_input":{"command":%s},"cwd":"/Users/kbtg/codebase/dashboard-api","session_id":"t"}' \
    "$(jstr "$1")" | bash "$HOOK" >/dev/null 2>&1
  echo $?
}

expect() {  # expect <want> <command> <message>
  local want="$1" cmd="$2" msg="$3" got
  got="$(run_hook "$cmd")"
  if [ "$got" != "$want" ]; then
    echo "FAIL: $msg (want exit $want, got $got) — cmd: $cmd"
    FAILURES=$((FAILURES + 1))
  else
    echo "ok: $msg"
  fi
}

echo "--- (1) gh auth switch is blocked in every shape ---"
expect 2 'gh auth switch -u akshat-git-jpg'                 'bare switch'
expect 2 'gh auth switch --hostname github.com --user koala25' 'switch with long flags'
expect 2 'rtk gh auth switch -u kushal-zluri'               'switch behind the rtk proxy'
expect 2 'cd /tmp && gh auth switch -u koala25'             'switch after a cd'
expect 2 'echo hi; gh auth switch -u koala25'               'switch after a semicolon'
expect 2 'foo | gh auth switch -u koala25'                  'switch after a pipe'

echo "--- (2) gh auth login is blocked (needs a browser, also moves the account) ---"
expect 2 'gh auth login -h github.com -p https -w'          'interactive login'
expect 2 'rtk gh auth login'                                'login behind the rtk proxy'

echo "--- (3) global identity writes are blocked ---"
expect 2 'git config --global user.email "x@y.com"'         'global user.email write'
expect 2 'git config --global user.name "Someone"'          'global user.name write'
expect 2 'git config --system user.email "x@y.com"'         'system user.email write'
expect 2 'rtk git config --global user.email x@y.com'       'global write behind rtk'

echo "--- (4) reads and repo-scoped writes still pass ---"
expect 0 'git config --global --get user.email'             'reading the global email'
expect 0 'git config --global --list'                       'listing global config'
expect 0 'git config user.email "x@y.com"'                  'repo-local email write'
expect 0 'git config --local user.email "x@y.com"'          'explicit --local email write'
expect 0 'git -C /tmp/repo config user.email "x@y.com"'     'repo-local write via -C'
expect 0 'git config --global core.editor vim'              'unrelated global key'
expect 0 'git config --global --unset user.email'           'unsetting is a cleanup, not a switch'

echo "--- (5) the safe replacements are never blocked ---"
expect 0 'eval "$(gh-acct export)"'                         'gh-acct export'
expect 0 'gh-acct check'                                    'gh-acct check'
expect 0 'gh-acct who -C /tmp/repo'                         'gh-acct who'
expect 0 'gh auth status'                                   'gh auth status'
expect 0 'gh auth token -u koala25'                         'gh auth token'
expect 0 'gh pr create --fill'                              'an ordinary gh write'
expect 0 'git commit -m "fix(x): y"'                        'an ordinary commit'

echo "--- (6) the documented override works ---"
expect 0 'GUARD_OK=1 gh auth switch -u koala25'             'override on switch'
expect 0 'GUARD_OK=1 git config --global user.email x@y.com' 'override on global write'

echo
if [ "$FAILURES" -ne 0 ]; then
  echo "FAIL: $FAILURES case(s) failed"
  exit 1
fi
echo "PASS: no-global-gh-switch blocks every global identity write and nothing else"
