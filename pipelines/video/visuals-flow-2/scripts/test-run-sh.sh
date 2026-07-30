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

# bash run.sh . bogus exits 2 and contains unknown step
out=$(bash run.sh . bogus 2>&1 || true)
if [[ "$out" != *"unknown step"* ]]; then
  fail "bogus step should print unknown step, got: $out"
fi
if bash run.sh . bogus >/dev/null 2>&1; then
  fail "bogus step should exit 2"
fi

# bash run.sh nosuchvideo status exits 1
if bash run.sh nosuchvideo status >/dev/null 2>&1; then
  fail "nosuchvideo status should exit 1"
fi

# bash run.sh . status exits 0 and contains next:
out=$(bash run.sh . status)
if [[ "$out" != *"next:"* ]]; then
  fail ". status should contain next:, got: $out"
fi

# bash run.sh . cue-pass exits 0 and contains plan-skeleton
out=$(bash run.sh . cue-pass)
if [[ "$out" != *"plan-skeleton"* ]]; then
  fail ". cue-pass should contain plan-skeleton, got: $out"
fi

# assert underlying commands are in run.sh
grep -q 'bash steps/010-transcribe-run/run.sh "$slug"' run.sh || fail "missing transcribe command"
grep -q 'node lib/resolve.mjs "$slug" && node lib/lint-cues.mjs "$slug"' run.sh || fail "missing resolve command"
grep -q 'bash steps/080-approve-storyboard-human/run.sh "$slug"' run.sh || fail "missing board command"
grep -q 'bash steps/090-render-graphics-run/run.sh "$slug"' run.sh || fail "missing render command"
grep -q 'node lib/feedback-status.mjs' run.sh || fail "missing fold command"
grep -q 'node lib/resolve-shots.mjs "$slug" && node lib/lint-shots.mjs "$slug"' run.sh || fail "missing shots command"
grep -q 'bash steps/100-render-avatar-run/run.sh "$slug"' run.sh || fail "missing avatar command"
grep -q 'bash steps/110-build-video-run/run.sh "$slug"' run.sh || fail "missing assemble command"
grep -q 'bash steps/140-davinci-export-run/run.sh "$slug"' run.sh || fail "missing export command"
grep -q 'bash scripts/qc-video.sh "$slug"' run.sh || fail "missing qc command"
grep -q 'bash steps/110-build-video-run/run.sh "$slug" --draft' run.sh || fail "missing cut command"

echo "run.sh test OK"

# A session verb hands out a prompt; there is no process for record_step to wrap,
# so the verb itself must file the step as running. Without this the `running`
# state depends on the model remembering, which is how five steps of real work
# ended up with no ledger entry at all.
tmpwd=$(mktemp -d)
bash run.sh "$tmpwd" cue-pass >/dev/null
grep -q '"030-pick-or-propose-graphics-llm"' "$tmpwd/run-log.json" \
  || fail "cue-pass must record 030 in the ledger"
grep -q '"status": "running"' "$tmpwd/run-log.json" \
  || fail "cue-pass must record 030 as running"
for v in concept-pass zone-pass audit shot-pass; do
  grep -qE "^    record [0-9]{3} running$" <(sed -n "/^  $v)\$/,+1p" run.sh) \
    || fail "$v must record its step as running"
done
rm -rf "$tmpwd"

# ...but never into the pipeline root: this harness drives verbs with slug "." and
# resolveWorkdir(".") is the root, so an unguarded write litters a run-log.json
# beside run.sh that records nothing and is not gitignored.
rm -f run-log.json
bash run.sh . cue-pass >/dev/null
[[ -f run-log.json ]] && { rm -f run-log.json; fail "run.sh . cue-pass must not write run-log.json into the pipeline root"; }

echo "run.sh session-ledger tests OK"
