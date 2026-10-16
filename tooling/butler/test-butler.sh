#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
python3 -m unittest discover -s tooling/butler/tests -p 'test_*.py'
python3 -m unittest discover -s tooling/cli/lists -p 'test_*.py'
python3 -m unittest discover -s tooling/cli/calendar -p 'test_*.py'
echo "butler tests: OK"
