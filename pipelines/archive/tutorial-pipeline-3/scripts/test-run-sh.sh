#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

export TP3_ROOT="$(node -e "console.log(require('fs').mkdtempSync(require('os').tmpdir() + '/tp3-smoke-'))")"

bash run.sh zz-smoke-test 010

if [ ! -f "$TP3_ROOT/videos/zz-smoke-test/inputs/topic.md" ]; then
  echo "smoke test failed: topic.md missing"
  exit 1
fi

bash run.sh zz-smoke-test status

rm -rf "$TP3_ROOT"
