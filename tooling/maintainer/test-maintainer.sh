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
if [ "$jobs" != "artifacts bigfiles claude-health crons mcp memory routing skills token-budget uptime " ]; then
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
echo "$out" | grep -q '^uptime' || fail "session-start.sh did not print uptime row"
echo "$out" | grep -q '^crons' || fail "session-start.sh did not print crons row"
echo "$out" | grep -q '^claude-health' || fail "session-start.sh did not print claude-health row"
echo "$out" | grep -q '^token-budget' || fail "session-start.sh did not print token-budget row"

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

# The real repo run. A CRASH here is a code defect and stays fatal.
#
# Drift is NOT. `.mcp.json` is gitignored and, inside a worktree, a symlink to the
# owner's live file — it changes whenever a session adds or drops an MCP server.
# This suite is in tooling/cli/pp-land/verify-map.tsv, so a fatal drift assertion
# makes an unrelated land fail at random and spends the land sweep's real_attempts
# (capped at 2). Observed on PR#206: the same commit failed two different ways and
# then passed five times in a row.
#
# Reporting that drift is the mcp JOB's work, and it already does it. The suite's
# job is to prove the checker itself is sound, so drift is advisory here.
real="$(bash "$MAINT_DIR/jobs/mcp/check.sh" 2>&1)"
echo "$real" | grep -q 'unbound variable' && fail "mcp check hit an unbound variable on the real repo"
if echo "$real" | grep -q 'DROPPED-BY-REGEN'; then
  echo "NOTE: regen-mcp-json.sh would drop a live server — run the mcp job. Not a test failure:"
  echo "$real" | grep 'DROPPED-BY-REGEN' | sed 's/^/      /'
fi

# --- crons job: fixture launchd inventory -----------------------------------
CFIX="$TMP/cronfix"; mkdir -p "$CFIX"
cat > "$CFIX/MAC-LAUNCHD.md" <<EOF
## Logs
| Job | Log |
|---|---|
| present-job | \`$CFIX/present.log\` |
| missing-job | \`$CFIX/definitely-missing.log\` |
EOF
printf 'ran\n' > "$CFIX/present.log"

out="$(CRONS_LAUNCHD="$CFIX/MAC-LAUNCHD.md" bash "$MAINT_DIR/jobs/crons/check.sh" 2>&1)"
echo "$out" | grep -q 'NO-LOG missing-job'  || fail "crons check did not report the launchd job with no log"
echo "$out" | grep -q 'NO-LOG present-job'  && fail "crons check flagged a job whose log exists"
echo "$out" | grep -q 'NOT CHECKED'         || fail "crons check must say the VPS half was not checked"

# --- uptime job: fixture inventories, probing disabled ----------------------
UFIX="$TMP/upfix"; mkdir -p "$UFIX"
printf '# sites\n- https://a.example\n' > "$UFIX/sites.md"
printf '# infra\n- https://a.example\n- https://only-in-infra.example\n' > "$UFIX/infra.md"
out="$(UPTIME_SITES="$UFIX/sites.md" UPTIME_INFRA="$UFIX/infra.md" bash "$MAINT_DIR/jobs/uptime/check.sh" 2>&1)"
echo "$out" | grep -q 'IN-INFRA-NOT-SITES https://only-in-infra.example' || fail "uptime check did not report inventory drift"
echo "$out" | grep -q 'skipped' || fail "uptime check must skip the network probe by default"

# --- bigfiles job: a real little git repo with a seeded oversized file ------
BFIX="$TMP/bigfix"; mkdir -p "$BFIX"
( cd "$BFIX" && git init -q && git config user.email t@t && git config user.name t
  mkdir -p sub
  dd if=/dev/zero of=sub/large.bin bs=1024 count=200 2>/dev/null
  printf 'small\n' > sub/small.txt
  git add -A && git commit -qm seed )

out="$(BIGFILES_ROOT="$BFIX" BIGFILES_MAX_KB=100 bash "$MAINT_DIR/jobs/bigfiles/check.sh" 2>&1)"
echo "$out" | grep -q 'BIG-TRACKED sub/large.bin' || fail "bigfiles check did not report the seeded oversized tracked file"

# A finding MUST flip the exit code, or run-job.sh prints "clean" and never
# routes the owner to propose.sh. Both reporting loops are `| while` subshells,
# so `found=1` inside one does not survive; they flag through a file.
BIGFILES_ROOT="$BFIX" BIGFILES_MAX_KB=100 bash "$MAINT_DIR/jobs/bigfiles/check.sh" >/dev/null 2>&1
rc=$?
[ "$rc" = "1" ] || fail "bigfiles found an oversized file but exited $rc (must be 1)"

# ...and a repo with nothing oversized must still exit 0.
BIGFILES_ROOT="$BFIX" BIGFILES_MAX_KB=999999 bash "$MAINT_DIR/jobs/bigfiles/check.sh" >/dev/null 2>&1
rc=$?
[ "$rc" = "0" ] || fail "bigfiles found nothing but exited $rc (must be 0)"

echo "$out" | grep -q 'BIG-TRACKED sub/small.txt' && fail "bigfiles check flagged a small file"
echo "$out" | grep -q 'history scan skipped'       || fail "bigfiles check ran the slow scan by default"

# the rewrite generator must not change the pack
before="$(git count-objects -vH | grep size-pack)"
bash "$MAINT_DIR/jobs/bigfiles/rewrite-plan.sh" >/dev/null
after="$(git count-objects -vH | grep size-pack)"
[ "$before" = "$after" ] || fail "rewrite-plan.sh changed the pack — it must only write a plan"

# --- artifacts job: fixture registry + fixture cards, no network ------------
AFIX="$TMP/artfix"; mkdir -p "$AFIX"
cat > "$AFIX/registry.json" <<'EOF'
{"version":1,"videos":{
  "shipped-video":{"title":"Shipped","minted":"2026-07-01","aliases":[],"card_id":"row_1"},
  "still-editing":{"title":"WIP","minted":"2026-08-01","aliases":[],"card_id":"row_2"},
  "no-card-video":{"title":"Orphan","minted":"2026-08-01","aliases":[]},
  "test-01":{"title":"fixture","minted":"2026-07-18","aliases":[],"card_id":"row_3"}
}}
EOF
cat > "$AFIX/cards.json" <<'EOF'
[ {"id":"row_1","yt_link":"https://youtu.be/abc","yt_upload_status":"Done"},
  {"id":"row_2","yt_link":"","yt_upload_status":"In Progress"},
  {"id":"row_3","yt_link":"https://youtu.be/zzz","yt_upload_status":"Done"} ]
EOF

out="$(ARTIFACTS_REGISTRY="$AFIX/registry.json" ARTIFACTS_CARDS="$AFIX/cards.json" \
       bash "$MAINT_DIR/jobs/artifacts/check.sh" 2>&1)"
echo "$out" | grep -q 'PUBLISHED shipped-video' || fail "artifacts check did not report the seeded published video"
echo "$out" | grep -q 'PUBLISHED still-editing' && fail "artifacts check flagged an unpublished video"
echo "$out" | grep -q 'PUBLISHED test-01'       && fail "artifacts check flagged the test fixture"
echo "$out" | grep -q 'NO-CARD no-card-video'   || fail "artifacts check did not report the card-less entry"

# a link with no done status must NOT count as published
cat > "$AFIX/cards2.json" <<'EOF'
[ {"id":"row_1","yt_link":"https://youtu.be/abc","yt_upload_status":"In Review"} ]
EOF
out2="$(ARTIFACTS_REGISTRY="$AFIX/registry.json" ARTIFACTS_CARDS="$AFIX/cards2.json" \
        bash "$MAINT_DIR/jobs/artifacts/check.sh" 2>&1)"
echo "$out2" | grep -q 'PUBLISHED shipped-video' && fail "a draft upload was treated as published"

# --- claude-health + token-budget: stubbed CLIs -----------------------------
cat > "$STUB_DIR/claude" <<'EOF'
#!/bin/bash
case "$1" in
  doctor)    echo "stub doctor: all good"; exit 0 ;;
  --version) echo "1.2.3 (stub)"; exit 0 ;;
esac
exit 0
EOF
cat > "$STUB_DIR/rtk" <<'EOF'
#!/bin/bash
case "$1" in
  gain)     echo "Tokens saved: 999 (99.9%)"; exit 0 ;;
  discover) echo "stub: 2 missed opportunities"; exit 0 ;;
esac
exit 0
EOF
chmod +x "$STUB_DIR/claude" "$STUB_DIR/rtk"

out="$(PATH="$STUB_DIR:$PATH" bash "$MAINT_DIR/jobs/claude-health/check.sh" 2>&1)"
echo "$out" | grep -q 'stub doctor: all good' || fail "claude-health did not run claude doctor"
echo "$out" | grep -q 'SESSION-STEP'          || fail "claude-health must mark /doctor as a session step"

out="$(PATH="$STUB_DIR:$PATH" bash "$MAINT_DIR/jobs/token-budget/check.sh" 2>&1)"
echo "$out" | grep -q 'Tokens saved'          || fail "token-budget did not run rtk gain"
echo "$out" | grep -q 'missed opportunities'  || fail "token-budget did not run rtk discover"
echo "$out" | grep -q 'context breakdown — SESSION-STEP, not automatable' \
  || fail "token-budget check must mark the context breakdown as a session step"

# neither job may mutate anything
for j in claude-health token-budget; do
  grep -qE '\bclaude (update|install)\b|\bplugin (install|uninstall)\b' "$MAINT_DIR/jobs/$j/check.sh" \
    && fail "$j check.sh contains a mutating command"
done

# ---------------------------------------------------------------------------
# The propose -> approve -> apply loop.
#
# This block exists because propose.sh shipped with an unbound `$f_` under
# `set -u`. It crashed on EVERY job, left a 2-line stub behind, and then
# refused to regenerate it (the "a proposal already exists" guard). The whole
# approval loop was dead on arrival and every other test in this file passed.
# ---------------------------------------------------------------------------
SANDBOX="$(mktemp -d)"
FAKE_MAINT="$SANDBOX/maintainer"
mkdir -p "$FAKE_MAINT/bin" "$FAKE_MAINT/jobs/probe"
cp "$MAINT_DIR/bin/lib.sh" "$MAINT_DIR/bin/propose.sh" "$MAINT_DIR/bin/apply.sh" \
   "$MAINT_DIR/bin/run-job.sh" "$FAKE_MAINT/bin/"
printf '#!/bin/bash\necho "- PROBE finding"\nexit 1\n' > "$FAKE_MAINT/jobs/probe/check.sh"
chmod +x "$FAKE_MAINT/jobs/probe/check.sh"

bash "$FAKE_MAINT/bin/run-job.sh" probe >/dev/null 2>&1
rc=$?
[ "$rc" = "1" ] || fail "run-job.sh must exit 1 when a check reports findings (got $rc)"

out="$(bash "$FAKE_MAINT/bin/propose.sh" probe 2>&1)" || fail "propose.sh failed: $out"
case "$out" in *"unbound variable"*) fail "propose.sh has an unbound variable" ;; esac

prop="$(ls "$FAKE_MAINT"/state/proposals/*-probe.md 2>/dev/null | head -1)"
[ -n "$prop" ] || fail "propose.sh wrote no proposal file"
for section in 'Raw findings' '## Fix' '## Ask' '## Not touching' 'Decision:'; do
  grep -q "$section" "$prop" || fail "proposal missing '$section' — it was written truncated"
done

# THE safety property this whole agent rests on: with no Decision line, apply
# must refuse, loudly, and non-zero. Never soften this assertion.
bash "$FAKE_MAINT/bin/apply.sh" probe >/dev/null 2>&1
rc=$?
[ "$rc" = "2" ] || fail "apply.sh did NOT refuse an unapproved proposal (exit $rc)"

/bin/rm -r "$SANDBOX"

# Every shipped script must be executable. Every doc here says `bin/run-job.sh
# <job>`, and the whole set landed mode 644 — the suite missed it because the
# verify-map row and the internal callers both say `bash <script>`.
while IFS= read -r f; do
  [ -x "$f" ] || fail "not executable: $f (the docs invoke it directly)"
done < <(/usr/bin/find "$MAINT_DIR" -name '*.sh')

echo "ALL PASS"
