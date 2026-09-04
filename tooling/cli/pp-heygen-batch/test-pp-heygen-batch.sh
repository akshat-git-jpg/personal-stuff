#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Run every unit test suite in the folder.
for f in test/*.test.mjs; do
  node --test "$f"
done

# Sanity: CLI wrapper --help returns 0.
./pp-heygen-batch --help > /dev/null

echo "ok: pp-heygen-batch tests passed"
