#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test lib/resolve.test.mjs lib/render.test.mjs lib/board.test.mjs lib/logos.test.mjs lib/lint.test.mjs lib/edit-delta.test.mjs lib/feedback-status.test.mjs lib/resolve-shots.test.mjs lib/lint-shots.test.mjs lib/avatar-render.test.mjs lib/assemble.test.mjs lib/transcript-text.test.mjs lib/captions.test.mjs lib/reference-moments.test.mjs lib/whip.test.mjs lib/bubble.test.mjs
node lib/check-rulebook.mjs
echo "visuals-flow check OK"
