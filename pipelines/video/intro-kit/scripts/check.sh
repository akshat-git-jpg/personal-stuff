#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[ -d node_modules ] || npm ci --no-audit --no-fund
node lib/check-kit.mjs
echo "intro-kit check OK"
