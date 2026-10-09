#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Glob, never an enumerated list: an enumerated gate silently skips every test
# file added after it was written (decisions.md 2026-08-02). Never `node --test
# lib/` either — a directory arg fails on node 22.14 (LESSONS 2026-07-09).
# Tests never read the owner's real word-check queue or approvals.
export WORD_CHECK_DIR="$(mktemp -d)"
node --test lib/*.test.mjs word-check/*.test.mjs
echo "video/tts check OK"
