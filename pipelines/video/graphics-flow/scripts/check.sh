#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test lib/resolve.test.mjs lib/render.test.mjs lib/board.test.mjs lib/logos.test.mjs lib/lint.test.mjs lib/edit-delta.test.mjs lib/feedback-status.test.mjs
node lib/check-rulebook.mjs
echo "graphics-flow check OK"
