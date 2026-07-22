#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

echo "Testing run.sh..."

# bash run.sh exits 2
if bash run.sh >/dev/null 2>&1; then
  fail "bash run.sh should exit 2"
fi

# bash run.sh test-02 bogus exits 2 and contains unknown step
out=$(bash run.sh test-02 bogus 2>&1 || true)
if [[ "$out" != *"unknown step"* ]]; then
  fail "bogus step should print unknown step, got: $out"
fi
if bash run.sh test-02 bogus >/dev/null 2>&1; then
  fail "bogus step should exit 2"
fi

# bash run.sh nosuchvideo status exits 1
if bash run.sh nosuchvideo status >/dev/null 2>&1; then
  fail "nosuchvideo status should exit 1"
fi

# bash run.sh test-02 status exits 0 and contains next:
out=$(bash run.sh test-02 status)
if [[ "$out" != *"next:"* ]]; then
  fail "test-02 status should contain next:, got: $out"
fi

# bash run.sh test-02 cue-pass exits 0 and contains plan-skeleton
out=$(bash run.sh test-02 cue-pass)
if [[ "$out" != *"plan-skeleton"* ]]; then
  fail "test-02 cue-pass should contain plan-skeleton, got: $out"
fi

# assert underlying commands are in run.sh
grep -q 'bash steps/010-transcribe-run/run.sh "$slug"' run.sh || fail "missing transcribe command"
grep -q 'node lib/resolve.mjs "$slug" && node lib/lint-cues.mjs "$slug"' run.sh || fail "missing resolve command"
grep -q 'bash steps/040-storyboard-review-owner/run.sh "$slug"' run.sh || fail "missing board command"
grep -q 'bash steps/050-render-run/run.sh "$slug"' run.sh || fail "missing render command"
grep -q 'node lib/feedback-status.mjs' run.sh || fail "missing fold command"
grep -q 'node lib/resolve-shots.mjs "$slug" && node lib/lint-shots.mjs "$slug"' run.sh || fail "missing shots command"
grep -q 'bash steps/080-avatar-render-run/run.sh "$slug"' run.sh || fail "missing avatar command"
grep -q 'bash steps/090-assemble-run/run.sh "$slug"' run.sh || fail "missing assemble command"
grep -q 'bash steps/095-resolve-export-run/run.sh "$slug"' run.sh || fail "missing export command"
grep -q 'bash scripts/qc-video.sh "$slug"' run.sh || fail "missing qc command"

echo "run.sh test OK"
