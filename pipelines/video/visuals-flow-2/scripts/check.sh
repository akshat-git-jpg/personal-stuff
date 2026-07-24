#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test lib/brand-inline.test.mjs lib/video-manifest.test.mjs lib/resolve.test.mjs lib/render.test.mjs lib/board.test.mjs lib/logos.test.mjs lib/lint.test.mjs lib/lint-concept.test.mjs lib/edit-delta.test.mjs lib/feedback-status.test.mjs lib/resolve-shots.test.mjs lib/lint-shots.test.mjs lib/avatar-render.test.mjs lib/assemble.test.mjs lib/transcript-text.test.mjs lib/captions.test.mjs lib/reference-moments.test.mjs lib/whip.test.mjs lib/bubble.test.mjs lib/effects.test.mjs lib/kinetic-sentence.test.mjs lib/export-timeline.test.mjs lib/qc-plan.test.mjs lib/render-fx.test.mjs scripts/promote-bespoke.test.mjs
node lib/check-rulebook.mjs
node lib/check-shot-rulebook.mjs
bash scripts/test-run-sh.sh
echo "visuals-flow check OK"
