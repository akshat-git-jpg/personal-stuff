#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test lib/flags.test.mjs lib/schema.test.mjs lib/lint-script.test.mjs lib/init-video.test.mjs
bash scripts/test-run-sh.sh
echo "tutorial-pipeline-3 check OK"
