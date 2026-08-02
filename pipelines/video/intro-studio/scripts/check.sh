#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Glob, not a hand-kept list: an enumerated gate silently skips every test file
# added after it was written, which is a gate that gets weaker over time.
node --test "lib/*.test.mjs"
node lib/check-prompt.mjs
node lib/check-rubric.mjs
bash scripts/test-run-sh.sh
echo "intro-studio check OK"
