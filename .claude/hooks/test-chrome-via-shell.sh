#!/usr/bin/env bash
# Behavioural harness for .claude/hooks/chrome-via-shell.sh: real PreToolUse JSON in, real exit code out.
set -u
HOOK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/chrome-via-shell.sh"
[ -x "$HOOK" ] || { echo "FAIL: hook missing or not executable: $HOOK"; exit 1; }
FAILURES=0
jstr() { python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1"; }
expect() {  # expect <rc> <label> <command>
  local got
  got=$(printf '{"tool_input":{"command":%s}}' "$(jstr "$3")" | bash "$HOOK" >/dev/null 2>&1; echo $?)
  if [ "$got" = "$1" ]; then echo "ok   $2"; else echo "FAIL $2 (want $1, got $got)"; FAILURES=$((FAILURES + 1)); fi
}
APP='"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"'

expect 2 "full app --dump-dom"            "$APP --headless=new --dump-dom https://x.test"
expect 2 "full app --screenshot"          "cd /tmp && $APP --headless --screenshot=a.png file:///a.html"
expect 2 "full app via rtk"               "rtk $APP --headless --print-to-pdf=a.pdf a.html"
expect 2 "windows chrome.exe"             "'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' --headless --dump-dom x"
expect 0 "headless shell"                 '"$(node scripts/lib/chrome.mjs path)" --headless --dump-dom https://x.test'
expect 0 "full app, not headless"         "$APP --version"
expect 0 "grep for the string"            "grep -rn \"Google Chrome.app/Contents/MacOS/Google Chrome\" --include=*.mjs . | grep -- --headless"
expect 0 "rtk proxy grep"                 "rtk proxy grep -E 'Google Chrome.app/Contents/MacOS/Google Chrome --headless' x"
expect 0 "override"                       "GUARD_OK=1 $APP --headless --dump-dom x"
expect 0 "unrelated command"              "ls -la"

[ "$FAILURES" -eq 0 ] && echo "chrome-via-shell: all cases pass" || { echo "chrome-via-shell: $FAILURES failing"; exit 1; }
