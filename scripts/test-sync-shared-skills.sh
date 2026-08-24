#!/usr/bin/env bash
# Tests for scripts/sync-shared-skills.sh. Runs against throwaway directories, so the
# real work-skills checkout is never touched.
#
# The load-bearing case is 4: a missing work-skills checkout must be a no-op, not a
# failure. The VPS and a fresh clone both hit it, and this script runs from relink.sh
# and the repo hygiene gate.
set -euo pipefail
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC="$SCRIPTS_DIR/sync-shared-skills.sh"
fails=0
ok()  { echo "  ok   $1"; }
bad() { echo "  FAIL $1" >&2; fails=$((fails + 1)); }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
SHARED="claude-router github-router humanizer i-have-adhd session-handoff"

new_env() {
  rm -rf "$TMP/repo" "$TMP/plugin"
  mkdir -p "$TMP/repo/scripts" "$TMP/repo/.claude/skills" "$TMP/plugin/skills"
  cp "$SYNC" "$TMP/repo/scripts/"
  for n in $SHARED; do
    mkdir -p "$TMP/repo/.claude/skills/$n"
    echo "# $n v1" > "$TMP/repo/.claude/skills/$n/SKILL.md"
  done
  # a skill that is NOT shared: it must never be copied
  mkdir -p "$TMP/repo/.claude/skills/commit-now"
  echo "# private" > "$TMP/repo/.claude/skills/commit-now/SKILL.md"
}
run()   { WORK_SKILLS_DIR="$TMP/plugin" "$TMP/repo/scripts/sync-shared-skills.sh" "$@" 2>&1; }
rc_of() { set +e; run "$@" >/dev/null 2>&1; local r=$?; set -e; echo "$r"; }

echo "1. copies the shared skills into the plugin"
new_env; run >/dev/null
n=0; for s in $SHARED; do [ -f "$TMP/plugin/skills/$s/SKILL.md" ] && n=$((n+1)); done
[ "$n" -eq 5 ] && ok "all five copied" || bad "all five copied (got $n)"
[ -e "$TMP/plugin/skills/commit-now" ] && bad "an unshared skill leaked" || ok "unshared skills not copied"

echo "2. --check reports drift and changes nothing"
new_env
echo "# humanizer EDITED" > "$TMP/repo/.claude/skills/humanizer/SKILL.md"
[ "$(rc_of --check)" = "1" ] && ok "drift exits 1" || bad "drift exits 1"
[ -e "$TMP/plugin/skills/humanizer" ] && bad "--check wrote to the plugin" || ok "--check wrote nothing"

echo "3. --check passes once synced, and is idempotent"
new_env; run >/dev/null
[ "$(rc_of --check)" = "0" ] && ok "in sync exits 0" || bad "in sync exits 0"
a="$(run)"; b="$(run)"; [ "$a" = "$b" ] && ok "second run matches first" || bad "second run matches first"

echo "4. a MISSING plugin checkout is a no-op, not a failure"
#    relink.sh and the hygiene gate both call this on machines that have no
#    work-skills clone (the VPS, a fresh laptop). Exiting non-zero there would
#    break the relink for everyone who does not have the private repo.
new_env; rm -rf "$TMP/plugin"
[ "$(rc_of)" = "0" ] && ok "sync exits 0 with no plugin" || bad "sync exits 0 with no plugin"
[ "$(rc_of --check)" = "0" ] && ok "--check exits 0 with no plugin" || bad "--check exits 0 with no plugin"

echo "5. a stale file in the plugin copy is removed, not merged"
new_env; run >/dev/null
echo "leftover" > "$TMP/plugin/skills/humanizer/STALE.md"
run >/dev/null
[ -e "$TMP/plugin/skills/humanizer/STALE.md" ] && bad "stale file removed" || ok "stale file removed"

echo "6. a missing SOURCE skill is reported, not silently skipped"
new_env; rm -rf "$TMP/repo/.claude/skills/humanizer"
out="$(run || true)"
grep -q "MISSING source" <<<"$out" && ok "missing source reported" || bad "missing source reported"

echo
[ "$fails" -eq 0 ] && echo "sync-shared-skills tests: all passed" || { echo "sync-shared-skills tests: $fails FAILED" >&2; exit 1; }
