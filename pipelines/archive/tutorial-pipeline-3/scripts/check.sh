#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test lib/*.test.mjs
bash scripts/test-run-sh.sh
echo "tutorial-pipeline-3 check OK"
