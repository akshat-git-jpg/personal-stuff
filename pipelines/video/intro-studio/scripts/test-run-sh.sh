#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

SLUG=".test-tmp/driver-smoke"
mkdir -p "videos/$SLUG"

cleanup() {
  rm -rf "videos/$SLUG"
}
trap cleanup EXIT

bash run.sh "$SLUG" status > /dev/null

if bash run.sh "$SLUG" nonsense > /dev/null 2>&1; then
  echo "Expected nonsense to exit 1"
  exit 1
fi

render_out=$(bash run.sh "$SLUG" render 2>&1 || true)
if ! echo "$render_out" | grep -q "not built yet"; then
  echo "Expected 'not built yet' in output, got: $render_out"
  exit 1
fi
