#!/usr/bin/env bash
# animate-flow gate: its own tests, the kit's tests, and the recipe isolation test.
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
source "$root/scripts/node22-path.sh"
cd "$(dirname "$0")/.."
find lib -name '*.test.mjs' -print0 | sort -z | xargs -0 node --test
( cd ../visuals-flow && node --test lib/recipe-isolation.test.mjs lib/kit/*.test.mjs )
echo "animate-flow check OK"
