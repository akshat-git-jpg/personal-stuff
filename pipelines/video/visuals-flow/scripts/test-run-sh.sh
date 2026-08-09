#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# What this file asserts, and why it changed shape (plan 191):
#
# It used to pin dispatch with `grep -q 'bash steps/020-transcribe-run/run.sh
# "$slug"' run.sh` — assertions on run.sh's SOURCE TEXT. Those failed on any
# correct rename while catching nothing about whether the verb actually
# dispatched, and they had already bent production code: run.sh carried a
# function whose comment said it existed so "the command reads literally ... to
# the grep in scripts/test-run-sh.sh that pins it."
#
# Now every verb is driven for real with VF_DRY_RUN=1, which prints the command
# it WOULD run and exits without running it. The table below is the contract:
# same commands as before the registry landed, resolved through the registry.

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

echo "Testing run.sh..."

# A fixture video, so the table below can drive every verb — including the ones
# behind a guard (`cut` wants approved cues, the intro verbs want intro:"film").
FIX=".test-run-sh-$$"
FIXDIR="videos/$FIX"
cleanup() { rm -rf "$FIXDIR"; }
trap cleanup EXIT
mkdir -p "$FIXDIR"
printf '{"engine":"heygen3","review":"full","intro":"film"}\n' > "$FIXDIR/run-config.json"
printf '{"approved":true,"cues":[]}\n' > "$FIXDIR/cues.json"

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

# A near-miss is named rather than just refused — the registry knows the list,
# so the driver can say what you meant.
out=$(bash run.sh . cuepass 2>&1 || true)
if [[ "$out" != *"did you mean: cue-pass"* ]]; then
  fail "a near-miss verb should suggest the real one, got: $out"
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

# ---------------------------------------------------------------------------
# THE VERB -> DISPATCH TABLE. One entry per line: <verb> then the command(s) it
# must dispatch, tab-separated. Asserted by running the verb, not by reading
# this file's neighbour.
# ---------------------------------------------------------------------------
expect_dry() {
  local verb="$1"; shift
  local out line
  out="$(VF_DRY_RUN=1 bash run.sh "$FIX" "$verb" 2>&1)" \
    || fail "$verb: dry run exited non-zero — $out"
  for line in "$@"; do
    grep -qxF "DRY: $line" <<<"$out" \
      || fail "$verb must dispatch [$line], got:\n$out"
  done
}

expect_dry configure "node lib/run-config.mjs $FIX"
expect_dry transcribe "record_step 020 -- bash steps/020-transcribe-run/run.sh $FIX"
expect_dry segments "record_step 040 -- node lib/segments.mjs $FIX --propose"
expect_dry intro-film "cat steps/130-author-intro-screenplay-llm/AUTHORING.md | sed s/<slug>/$FIX/g"
expect_dry intro-review "node lib/intro-film/review-film.mjs $FIX"
# No requireIntroApproved here: rendering is how the owner gets a film to
# watch, so gating it on approval deadlocked the review. Approval guards
# assembly instead (lib/assemble.mjs, owner report 2026-08-06).
expect_dry intro-render "node lib/intro-film/render-film.mjs $FIX"
expect_dry validate "record_step 230 -- node lib/resolve.mjs $FIX --validate-only"
expect_dry resolve "record_step 310 -- node lib/resolve.mjs $FIX && node lib/lint-cues.mjs $FIX"
expect_dry card-plan "node lib/card-plan.mjs $FIX"
expect_dry outline "node lib/card-plan.mjs $FIX --outline"
expect_dry board "bash steps/340-approve-storyboard-human/run.sh $FIX"
expect_dry render "record_step 410 -- bash steps/410-render-graphics-run/run.sh $FIX"
expect_dry fold "record 630 running + node lib/feedback-status.mjs"
expect_dry sound "record_step 450 -- node lib/sound/sfx-plan.mjs $FIX"
expect_dry mix "record_step 460 -- node lib/sound/build-mix.mjs $FIX"
expect_dry storyboard-check "record_step 330 -- storyboard-check"
# No default template. The approved character in avatar-plan.json is the
# template; run.sh used to hardcode "specs-man", which silently overrode the
# owner's board pick and would have rendered the wrong presenter on the METERED
# engine (2026-08-08).
expect_dry avatar "record_step 430 -- bash steps/430-render-avatar-run/run.sh $FIX --submit --spans-only"
expect_dry avatar-download "record_step 430 -- bash steps/430-render-avatar-run/run.sh $FIX --download"
expect_dry assemble "record_step 510 -- bash steps/510-assemble-video-run/run.sh $FIX"
expect_dry deliver "record_step 620 -- bash steps/620-deliver-drive-run/run.sh $FIX"
expect_dry export "record_step 610 -- bash steps/610-davinci-export-run/run.sh $FIX"
expect_dry qc "bash scripts/qc-video.sh $FIX"

# cut is a composite: the whole sequence, in order, is the contract.
expect_dry cut \
  "record_step 410 -- bash steps/410-render-graphics-run/run.sh $FIX" \
  "node lib/effects-plan.mjs $FIX" \
  "node lib/sound/sfx-plan.mjs $FIX" \
  "node lib/sound/build-mix.mjs $FIX" \
  "if avatar-jobs.json: bash steps/430-render-avatar-run/run.sh $FIX --download" \
  "record_step 510 -- bash steps/510-assemble-video-run/run.sh $FIX --draft"

# The AVATAR_TEMPLATE override still reaches the command.
out="$(AVATAR_TEMPLATE=other-face VF_DRY_RUN=1 bash run.sh "$FIX" avatar 2>&1)"
[[ "$out" == *"--template other-face"* ]] || fail "avatar must pass AVATAR_TEMPLATE through, got: $out"

# cut refuses on unapproved cues — the exit-code check, not a string compare.
printf '{"approved":false,"cues":[]}\n' > "$FIXDIR/cues.json"
out="$(VF_DRY_RUN=1 bash run.sh "$FIX" cut 2>&1 || true)"
[[ "$out" == *"approve the storyboard first"* ]] || fail "cut must refuse unapproved cues, got: $out"
printf '{"approved":true,"cues":[]}\n' > "$FIXDIR/cues.json"


printf '{"engine":"heygen3","review":"full","intro":"film"}\n' > "$FIXDIR/run-config.json"

# ---------------------------------------------------------------------------
# Registry <-> driver: neither list may grow past the other.
# ---------------------------------------------------------------------------
verbs="$(node lib/steps.mjs verbs)"
[[ -n "$verbs" ]] || fail "the registry returned no verbs"

# Usage prints every verb the registry declares, and nothing it does not.
# run.sh with no args exits 2 by design, hence the `|| true` before the pipe.
usage_verbs="$( { bash run.sh 2>&1 || true; } | sed -n 's/^  \([a-z][a-z-]*\).*/\1/p')"
if [[ "$(sort <<<"$verbs")" != "$(sort <<<"$usage_verbs")" ]]; then
  fail "usage and the registry disagree:\nregistry: $(tr '\n' ' ' <<<"$verbs")\nusage:    $(tr '\n' ' ' <<<"$usage_verbs")"
fi

# Every declared verb reaches a branch. A verb added to step.json with no
# dispatch in run.sh lands in the catch-all, and this is what catches it.
while read -r v; do
  [[ -z "$v" ]] && continue
  out="$(VF_DRY_RUN=1 bash run.sh "$FIX" "$v" 2>&1 || true)"
  [[ "$out" == *"unknown step"* ]] && fail "$v is in the registry but run.sh does not dispatch it"
  [[ "$out" == *"has no branch in run.sh"* ]] && fail "$v is in the registry but run.sh does not dispatch it"
done <<<"$verbs"

# Every step folder the driver names is resolved through the registry, so a
# renumber cannot leave a dangling path. Prove the resolved folders exist.
while read -r d; do
  [[ -d "$d" ]] || fail "run.sh dispatches into $d, which does not exist"
done < <(VF_DRY_RUN=1 bash run.sh "$FIX" cut 2>&1 | grep -o 'steps/[0-9a-z-]*' | sort -u)

echo "run.sh test OK"

# A session verb hands out a prompt; there is no process for record_step to wrap,
# so the verb itself must file the step as running. Without this the `running`
# state depends on the model remembering, which is how five steps of real work
# ended up with no ledger entry at all.
tmpwd=$(mktemp -d)
bash run.sh "$tmpwd" cue-pass >/dev/null
grep -q '"210-author-body-cues-llm"' "$tmpwd/run-log.json" \
  || fail "cue-pass must record 210 in the ledger"
grep -q '"status": "running"' "$tmpwd/run-log.json" \
  || fail "cue-pass must record 210 as running"
rm -rf "$tmpwd"

# The same, for every other verb that hands out a prompt instead of running a
# command. Asserted through the ledger it writes, not through run.sh's source.
for pair in "concept-pass 050" "zone-pass 220" "shot-pass 320"; do
  set -- $pair
  tmpwd=$(mktemp -d)
  bash run.sh "$tmpwd" "$1" >/dev/null
  slug_for_step="$(node lib/steps.mjs slug "$2")"
  grep -q "\"$slug_for_step\"" "$tmpwd/run-log.json" \
    || fail "$1 must record $2 ($slug_for_step) in the ledger"
  grep -q '"status": "running"' "$tmpwd/run-log.json" \
    || fail "$1 must record $2 as running"
  rm -rf "$tmpwd"
done

# ...but never into the pipeline root: this harness drives verbs with slug "." and
# resolveWorkdir(".") is the root, so an unguarded write litters a run-log.json
# beside run.sh that records nothing and is not gitignored.
rm -f run-log.json
bash run.sh . cue-pass >/dev/null
[[ -f run-log.json ]] && { rm -f run-log.json; fail "run.sh . cue-pass must not write run-log.json into the pipeline root"; }


# EVERY step-backed verb must record itself in the ledger.
#
# Five verbs shipped without a record_step wrapper (validate/230,
# storyboard-check/330, intro-rerender/440, sound/450, mix/460). Each one ran
# fine and then showed "todo" in the ledger afterwards, so the owner — who
# follows a run from the board's Run tab, not the terminal — could not tell the
# step had happened. Sessions papered over it by hand-writing entries, which is
# how the same gap survived five times. A wrapper is now a test failure, not a
# convention (2026-08-08).
echo "Checking every step-backed verb records itself..."
# intro-rerender refuses before it dispatches unless a real avatar exists, so
# the fixture needs one for the wrapper to be observable at all.
touch "$FIXDIR/avatar.mp4"
for pair in \
  "validate:230" "resolve:310" "storyboard-check:330" "render:410" \
  "avatar:430" "avatar-download:430" "intro-rerender:440" \
  "sound:450" "mix:460" "assemble:510" "transcribe:020" "segments:040"; do
  verb="${pair%%:*}"; num="${pair##*:}"
  out="$(VF_DRY_RUN=1 bash run.sh "$FIX" "$verb" 2>&1 || true)"
  [[ "$out" == *"record_step $num"* ]] \
    || fail "verb '$verb' must dispatch through record_step $num so the ledger shows it ran; got: $out"
done
echo "run.sh record_step coverage OK"

echo "run.sh session-ledger tests OK"
