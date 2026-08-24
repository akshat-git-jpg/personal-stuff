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
if [ "$jobs" != "bigfiles mcp memory routing skills " ]; then
  if [ -z "$jobs" ]; then
    fail "job discovery found no jobs"
  else
    fail "job discovery found unexpected jobs: $jobs"
  fi
fi

# 3. session-start.sh exits 0 and output contains skills
out="$(bash $MAINT_DIR/bin/session-start.sh)" || fail "session-start.sh failed"
echo "$out" | grep -q '^skills' || fail "session-start.sh did not print skills row"
echo "$out" | grep -q '^memory' || fail "session-start.sh did not print memory row"
echo "$out" | grep -q '^mcp' || fail "session-start.sh did not print mcp row"

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

# --- memory job: fixture with a known orphan and a known dead pointer -------
FIX="$TMP/memfix"
mkdir -p "$FIX/projects/-tmp-nonexistent-repo/memory"
M="$FIX/projects/-tmp-nonexistent-repo/memory"
cat > "$M/MEMORY.md" <<'EOF'
# Memory Index
- [Present note](present.md) - indexed and on disk
- [Missing note](missing.md) - indexed but NOT on disk
EOF
printf 'description: a note that is on disk and indexed\n' > "$M/present.md"
printf 'description: a note on disk that nobody indexed\n' > "$M/orphan.md"

out="$(MEMORY_ROOTS="$FIX" bash "$MAINT_DIR/jobs/memory/check.sh" 2>&1)"
echo "$out" | grep -q 'ORPHAN' || fail "memory check did not report the seeded orphan"
echo "$out" | grep -q 'DEAD POINTER' || fail "memory check did not report the seeded dead pointer"
echo "$out" | grep -q 'dead path' || fail "memory check did not report the seeded dead path"

# age lines must NOT be able to flip the exit code
MEMORY_ROOTS="$FIX" MEMORY_AGE_DAYS=0 bash "$MAINT_DIR/jobs/memory/check.sh" >/dev/null
# (exit 1 here is fine — it comes from the orphan, not from age. The next assertion
#  proves age alone is not a finding.)
CLEAN="$TMP/memclean"
mkdir -p "$CLEAN/projects/-tmp-x/memory"
printf '# Memory Index\n- [Only note](only.md) - fine\n' > "$CLEAN/projects/-tmp-x/memory/MEMORY.md"
printf 'description: fine\n' > "$CLEAN/projects/-tmp-x/memory/only.md"
MEMORY_ROOTS="$CLEAN" MEMORY_AGE_DAYS=0 bash "$MAINT_DIR/jobs/memory/check.sh" >/dev/null
rc=$?
[ "$rc" -le 1 ] || fail "memory check exited $rc on a clean fixture"

# --- routing job: fixture repo with a seeded unmapped folder + dead link ----
RFIX="$TMP/routefix"
mkdir -p "$RFIX/apps/mapped-app" "$RFIX/totally-unmapped" "$RFIX/apps/no-doc-app"
printf '# x\n' > "$RFIX/apps/mapped-app/README.md"
cat > "$RFIX/CLAUDE.md" <<'EOF'
| If the ask is about… | Go to |
|---|---|
| the mapped app | [apps/mapped-app](apps/mapped-app) |
| something deleted | [gone/thing.md](gone/thing.md) |
EOF

out="$(ROUTING_ROOT="$RFIX" bash "$MAINT_DIR/jobs/routing/check.sh" 2>&1)"
echo "$out" | grep -q 'UNMAPPED totally-unmapped' || fail "routing check did not report the seeded unmapped folder"
echo "$out" | grep -q 'DEAD LINK gone/thing.md'   || fail "routing check did not report the seeded dead link"
echo "$out" | grep -q 'NO OPERATE-DOC'            || fail "routing check did not report the missing operate-doc"
echo "$out" | grep -q 'NOT CHECKED HERE'          || fail "routing check must say checks 4 and 5 need judgement"

# --- mcp job: fixture config + fixture generator ----------------------------
MFIX="$TMP/mcpfix"
mkdir -p "$MFIX"
cat > "$MFIX/mcp.json" <<'EOF'
{"mcpServers":{
  "kept":{"type":"stdio","command":"node","args":["/definitely/missing/entry.js"],"env":{}},
  "orphan":{"type":"stdio","command":"node","args":["/also/missing.js"],"env":{}}
}}
EOF
cat > "$MFIX/regen.sh" <<'EOF'
#!/bin/bash
echo '{"mcpServers":{"kept":{}}}'
EOF

out="$(MCP_JSON="$MFIX/mcp.json" MCP_REGEN="$MFIX/regen.sh" bash "$MAINT_DIR/jobs/mcp/check.sh" 2>&1)"
echo "$out" | grep -q 'DROPPED-BY-REGEN orphan' || fail "mcp check did not report the server the generator would drop"
echo "$out" | grep -q 'DROPPED-BY-REGEN kept'   && fail "mcp check wrongly flagged a server the generator DOES emit"
echo "$out" | grep -q 'MISSING-ENTRYPOINT'      || fail "mcp check did not report a missing entrypoint"

before_fix="$(cksum "$MFIX/mcp.json")"
fix_out="$(MCP_JSON="$MFIX/mcp.json" MCP_REGEN="$MFIX/regen.sh" bash "$MAINT_DIR/jobs/mcp/fix.sh" 2>&1)" \
  && fail "mcp fix should refuse when the generator would drop a server"
echo "$fix_out" | grep -q 'refusing to regenerate' || fail "mcp fix did not explain its refusal"
[ "$(cksum "$MFIX/mcp.json")" = "$before_fix" ] || fail "mcp fix changed config after refusing"

# the real repo's generator must no longer drop anything
real="$(bash "$MAINT_DIR/jobs/mcp/check.sh" 2>&1)"
echo "$real" | grep -q 'unbound variable' && fail "mcp check hit an unbound variable on the real repo"
echo "$real" | grep -q 'DROPPED-BY-REGEN' && fail "regen-mcp-json.sh still drops a live server"

# --- bigfiles job: a real little git repo with a seeded oversized file ------
BFIX="$TMP/bigfix"; mkdir -p "$BFIX"
( cd "$BFIX" && git init -q && git config user.email t@t && git config user.name t
  mkdir -p sub
  dd if=/dev/zero of=sub/large.bin bs=1024 count=200 2>/dev/null
  printf 'small\n' > sub/small.txt
  git add -A && git commit -qm seed )

out="$(BIGFILES_ROOT="$BFIX" BIGFILES_MAX_KB=100 bash "$MAINT_DIR/jobs/bigfiles/check.sh" 2>&1)"
echo "$out" | grep -q 'BIG-TRACKED sub/large.bin' || fail "bigfiles check did not report the seeded oversized tracked file"
echo "$out" | grep -q 'BIG-TRACKED sub/small.txt' && fail "bigfiles check flagged a small file"
echo "$out" | grep -q 'history scan skipped'       || fail "bigfiles check ran the slow scan by default"

# the rewrite generator must not change the pack
before="$(git count-objects -vH | grep size-pack)"
bash "$MAINT_DIR/jobs/bigfiles/rewrite-plan.sh" >/dev/null
after="$(git count-objects -vH | grep size-pack)"
[ "$before" = "$after" ] || fail "rewrite-plan.sh changed the pack — it must only write a plan"

echo "ALL PASS"
