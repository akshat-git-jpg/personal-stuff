#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
slug="$1"; shift
cd "videos/$slug"
npx hyperframes@latest transcribe vo.mp3 --json -m small.en "$@"
