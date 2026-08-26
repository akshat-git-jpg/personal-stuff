#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Glob, never an enumerated list: an enumerated gate silently skips every test
# file added after it was written (decisions.md 2026-08-02). Never `node --test
# lib/` either — a directory arg fails on node 22.14 (LESSONS 2026-07-09).
node --test lib/*.test.mjs
echo "video/tts check OK"
