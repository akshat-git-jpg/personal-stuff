#!/usr/bin/env bash
# Paste a handoff prompt into Antigravity and submit it — removes the human
# copy-paste step. Clipboard + Cmd+V is deliberate: robust for large prompts
# where synthetic typing is not.
#
# Usage: ag-handoff.sh <prompt-file>
# Env:
#   AG_APP        — app to drive (default "Antigravity IDE"; the other install
#                   on this machine is "Antigravity.app", NOT the default)
#   AG_FOCUS_KEY  — key pressed with Cmd before pasting, to focus the agent
#                   input (default "l"). Set AG_FOCUS_KEY="" to skip if focus
#                   is already correct.
#
# First-time setup (one-time, manual):
#   1. System Settings → Privacy & Security → Accessibility: enable the app
#      hosting this terminal (osascript keystrokes are blocked without it).
#   2. Dry-run with a tiny prompt file and verify the text lands in
#      Antigravity's AGENT INPUT — not an editor pane. Adjust AG_FOCUS_KEY
#      if it lands in the wrong place.
set -euo pipefail

PROMPT_FILE="${1:?usage: ag-handoff.sh <prompt-file>}"
AG_APP="${AG_APP:-Antigravity IDE}"
AG_FOCUS_KEY="${AG_FOCUS_KEY-l}"

[ -s "$PROMPT_FILE" ] || { echo "ERROR: prompt file missing or empty: $PROMPT_FILE" >&2; exit 1; }

pbcopy < "$PROMPT_FILE"

if ! osascript <<EOF
tell application "$AG_APP" to activate
delay 1.5
tell application "System Events"
  $( [ -n "$AG_FOCUS_KEY" ] && echo "keystroke \"$AG_FOCUS_KEY\" using {command down}
  delay 0.7" )
  keystroke "v" using {command down}
  delay 0.7
  key code 36 -- Enter
end tell
EOF
then
  cat >&2 <<'MSG'
ERROR: osascript failed. Most likely cause: Accessibility permission not
granted to this terminal's host app (System Settings → Privacy & Security →
Accessibility). The prompt IS on your clipboard — paste it into Antigravity
manually (Cmd+V, Enter) to proceed with this run.
MSG
  exit 1
fi

echo "handoff pasted + submitted to '$AG_APP' ($(wc -c < "$PROMPT_FILE" | tr -d ' ') bytes)"
