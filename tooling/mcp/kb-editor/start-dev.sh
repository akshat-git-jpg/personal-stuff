#!/bin/sh
# Starts the kb-editor dev build (what `launch_weftcut` runs when no installed app exists). Log: ~/Library/Logs/kb-editor-dev.log
DIR="${KB_EDITOR_DIR:-$HOME/codebase/kb-editor}"
LOG="$HOME/Library/Logs/kb-editor-dev.log"
mkdir -p "$(dirname "$LOG")"
cd "$DIR" || exit 1
. kb/dev-env.sh
exec npm run dev >>"$LOG" 2>&1
