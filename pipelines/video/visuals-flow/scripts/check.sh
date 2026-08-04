#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# board-ui FIRST: board.test.mjs's cutover tests fetch `/`, which serves
# board-ui/dist — on a fresh checkout (dist is gitignored) the suite fails
# without this build, so it must precede `node --test` (found 2026-07-31).
( cd board-ui && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npx vitest run && npm run build )
# card-library's deps too: lib/frame-gate.mjs imports card-library's
# overflow-probe.mjs, which needs puppeteer-core. On a checkout where those
# deps are absent the suite fails with ERR_MODULE_NOT_FOUND on ONE file while
# everything else passes — it reads as a flaky test rather than a missing
# install, and cost three gate runs to pin down (2026-08-03).
( cd ../card-library && { [ -d node_modules/puppeteer-core ] || npm ci --no-audit --no-fund; } )
node --test lib/source-structure.test.mjs lib/brand-inline.test.mjs lib/video-manifest.test.mjs lib/resolve.test.mjs lib/render.test.mjs lib/board.test.mjs lib/board-api.test.mjs lib/logos.test.mjs lib/lint-cues.test.mjs lib/lint-concept.test.mjs lib/edit-delta.test.mjs lib/feedback-status.test.mjs lib/resolve-shots.test.mjs lib/lint-shots.test.mjs lib/avatar-render.test.mjs lib/assemble.test.mjs lib/transcript-text.test.mjs lib/transcript-quality.test.mjs lib/captions.test.mjs lib/reference-moments.test.mjs lib/whip.test.mjs lib/bubble.test.mjs lib/effects.test.mjs lib/kinetic-sentence.test.mjs lib/export-timeline.test.mjs lib/qc-plan.test.mjs lib/render-fx.test.mjs lib/card-plan.test.mjs lib/run-log.test.mjs lib/sound/sfx-plan.test.mjs lib/sound/build-mix.test.mjs lib/sound/sound-constants.test.mjs lib/audit-gate.test.mjs lib/final-cut.test.mjs lib/zone-lint.test.mjs lib/frame-gate.test.mjs lib/run-config.test.mjs lib/transcript-suspect.test.mjs lib/transcribe-groq.test.mjs
node --test "lib/intro-film/"*.test.mjs
node lib/check-rulebook.mjs
node lib/check-shot-rulebook.mjs
node lib/check-zone-rulebook.mjs
node lib/intro-film/check-taste-intro.mjs
bash scripts/test-run-sh.sh
node scripts/board-ui-smoke.mjs
echo "visuals-flow check OK"
