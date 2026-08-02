#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test lib/workdir.test.mjs lib/intake.test.mjs lib/intake.roundtrip.test.mjs lib/transcript.test.mjs lib/avatar.test.mjs
bash scripts/test-run-sh.sh
echo "intro-studio check OK"
