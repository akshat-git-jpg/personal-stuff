#!/usr/bin/env bash
# Refuses ad-hoc headless runs of the full Chrome app; points at the cached headless shell instead.
# Why: the full app takes 50-120s to start on this Mac, the shell <1s (2026-10-08). Override: GUARD_OK=1.
set -u
INPUT="$(cat)"

if command -v python3 >/dev/null 2>&1; then
  CMD="$(printf '%s' "$INPUT" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("tool_input",{}).get("command",""))
except Exception: pass' 2>/dev/null)"
elif command -v node >/dev/null 2>&1; then
  CMD="$(printf '%s' "$INPUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).tool_input.command||"")}catch(e){}})' 2>/dev/null)"
else
  exit 0  # a speed guard, not a safety wall: fail open
fi
[ -n "$CMD" ] || exit 0
printf '%s' "$CMD" | grep -q 'GUARD_OK=1' && exit 0

FULL='(Google Chrome\.app/Contents/MacOS/Google Chrome|[\\/]chrome\.exe)'
FLAGS='--(headless|dump-dom|screenshot|print-to-pdf|remote-debugging-port)'
printf '%s' "$CMD" | grep -Eq "$FULL" || exit 0
printf '%s' "$CMD" | grep -Eq -- "$FLAGS" || exit 0
# Searching for the string is fine; only running it is refused.
first="$(printf '%s' "$CMD" | sed -E 's/^[[:space:]]*(rtk[[:space:]]+(proxy[[:space:]]+)?)?//' | awk '{print $1}')"
case "$first" in grep|egrep|rg|git|sed|awk|cat|less|head|tail|find|echo|printf) exit 0 ;; esac

cat >&2 <<'MSG'
chrome-via-shell: this runs the FULL Chrome app headless. It takes 50-120s to start on this Mac.
Use the cached headless shell instead. The same flags work:
  "$(node scripts/lib/chrome.mjs path)" --headless --dump-dom <url>
In node code: puppeteer.launch(launchOptions()) from scripts/lib/chrome.mjs.
Deliberate one-off override: prefix the command with GUARD_OK=1
MSG
exit 2
