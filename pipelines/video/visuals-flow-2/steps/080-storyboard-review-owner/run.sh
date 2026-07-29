#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
if ! node lib/audit-gate.mjs "$1"; then
  echo "AUDIT GATE: re-author labelled fullframe cues, re-run resolve + audit, then board"
  exit 1
fi
node lib/board.mjs "$@"
