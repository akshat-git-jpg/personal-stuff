#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test lib/workdir.test.mjs lib/intake.test.mjs lib/intake.roundtrip.test.mjs lib/transcript.test.mjs lib/avatar.test.mjs lib/screenplay-schema.test.mjs lib/lint-screenplay.test.mjs lib/render-film.test.mjs lib/frames.test.mjs lib/film-gate.test.mjs lib/contact-sheet.test.mjs lib/render.roundtrip.test.mjs
node lib/check-prompt.mjs
node lib/check-rubric.mjs
bash scripts/test-run-sh.sh
echo "intro-studio check OK"
