#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
if ! node lib/audit-gate.mjs "$1"; then
  echo "AUDIT GATE: re-author labelled fullframe cues, re-run resolve + audit, then board"
  exit 1
fi
ui_dir="$(dirname "$0")/../../board-ui"
if [ ! -d "$ui_dir/node_modules" ]; then (cd "$ui_dir" && npm ci); fi
if [ ! -f "$ui_dir/dist/index.html" ] || [ -n "$(find "$ui_dir/src" -newer "$ui_dir/dist/index.html" -print -quit)" ]; then
  (cd "$ui_dir" && npm run build)
fi
node lib/board.mjs "$@"
