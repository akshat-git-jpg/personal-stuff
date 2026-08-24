#!/bin/bash
# Self-test for the maintainer.
set -uo pipefail

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

MAINT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

STUB_DIR="$TMP/stub"
mkdir -p "$STUB_DIR"
export PATH="$STUB_DIR:$PATH"

# Setup state dir for testing
export MAINT_DIR

# We will test lib.sh functions by sourcing it in a subshell
jobs="$(bash -c "source $MAINT_DIR/bin/lib.sh; discover_jobs" | sort | tr '\n' ' ')"
if [ "$jobs" != "skills " ]; then
  if [ -z "$jobs" ]; then
    fail "job discovery found no jobs"
  else
    fail "job discovery found unexpected jobs: $jobs"
  fi
fi

# 3. session-start.sh exits 0 and output contains skills
out="$(bash $MAINT_DIR/bin/session-start.sh)" || fail "session-start.sh failed"
echo "$out" | grep -q '^skills' || fail "session-start.sh did not print skills row"

# 4. session-start.sh prints job discovery found no jobs and exits 2 when jobs/ is empty
mkdir -p "$TMP/empty_jobs_test/jobs"
mkdir -p "$TMP/empty_jobs_test/bin"
mkdir -p "$TMP/empty_jobs_test/state"
cp $MAINT_DIR/bin/* "$TMP/empty_jobs_test/bin/"
out="$(bash $TMP/empty_jobs_test/bin/session-start.sh 2>&1)" && fail "session-start.sh should exit 2 on empty jobs"
echo "$out" | grep -q "job discovery found no jobs" || fail "session-start.sh did not print job discovery found no jobs"

# 5. run-job.sh with no argument exits 2
bash $MAINT_DIR/bin/run-job.sh >/dev/null 2>&1 && fail "run-job.sh with no arg should exit 2"
rc=$?
[ $rc -eq 2 ] || fail "run-job.sh with no arg exited with $rc instead of 2"

# 6. run-job.sh nosuchjob exits 2
bash $MAINT_DIR/bin/run-job.sh nosuchjob >/dev/null 2>&1 && fail "run-job.sh nosuchjob should exit 2"
rc=$?
[ $rc -eq 2 ] || fail "run-job.sh nosuchjob exited with $rc instead of 2"

# 7. run-job.sh skills exits 0 or 1, never 2, and creates a findings file
bash $MAINT_DIR/bin/run-job.sh skills >/dev/null 2>&1
rc=$?
[ $rc -eq 2 ] && fail "run-job.sh skills exited 2 (check broke)"
findings="$(bash -c "source $MAINT_DIR/bin/lib.sh; findings_file skills")"
[ -f "$findings" ] || fail "run-job.sh skills did not create a findings file"

# 8. apply.sh skills exits 2 when no proposal exists
# Ensure no proposal
prop="$(bash -c "source $MAINT_DIR/bin/lib.sh; proposal_file skills")"
rm -f "$prop"
bash $MAINT_DIR/bin/apply.sh skills >/dev/null 2>&1 && fail "apply.sh skills should exit 2 with no proposal"
rc=$?
[ $rc -eq 2 ] || fail "apply.sh skills with no proposal exited with $rc instead of 2"

# 9. apply.sh skills exits 2 when a proposal exists without a Decision: line
echo "dummy proposal" > "$prop"
bash $MAINT_DIR/bin/apply.sh skills >/dev/null 2>&1 && fail "apply.sh skills should exit 2 with no decision"
rc=$?
[ $rc -eq 2 ] || fail "apply.sh skills with no decision exited with $rc instead of 2"
rm -f "$prop"

# 10. jobs/skills/check.sh never emits a "- " finding line for a zero-reference skill
# We check this by running check.sh and ensuring it doesn't emit "- zero repo references" or similar
out="$(bash $MAINT_DIR/jobs/skills/check.sh)"
echo "$out" | grep -E "^- zero repo references:" && fail "check.sh emitted a finding line for zero-reference skills"

echo "ALL PASS"
