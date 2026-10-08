#!/usr/bin/env bash
# Thin dispatcher: every verb lives in lib/run.mjs. On Windows without bash, run
#   node lib/run.mjs <slug> <verb> [flags]
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
# hyperframes needs Node >= 22; the transcriber reads GROQ_API_KEY from ~/.zshenv.
source ../../../scripts/node22-path.sh 2>/dev/null || true
[ -z "${GROQ_API_KEY:-}" ] && [ -f "$HOME/.zshenv" ] && source "$HOME/.zshenv" 2>/dev/null || true
exec node lib/run.mjs "$@"
