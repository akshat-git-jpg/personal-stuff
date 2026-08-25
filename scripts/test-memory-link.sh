#!/usr/bin/env bash
#
# Tests for link_shared_memory in relink.sh.
#
# The refusal cases are the point. This function deletes and re-creates directories
# under both Claude config dirs, unattended, on every relink. What it must NOT touch
# matters more than what it links.
#
#   bash scripts/test-memory-link.sh
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELINK="$HERE/relink.sh"
fails=0

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; fails=$((fails + 1)); }

# Pull just the function out of relink.sh so the test never runs the skill-linking,
# description guards, codex mirror or push-gate install.
FN="$(mktemp)"
trap 'rm -f "$FN"' EXIT
sed -n '/^link_shared_memory() {/,/^}$/p' "$RELINK" > "$FN"
[ -s "$FN" ] || { echo "FAIL: could not extract link_shared_memory from $RELINK"; exit 1; }

# A fake repo whose main worktree is itself, so the slug is predictable.
REPO="$(mktemp -d)/personal-stuff"
mkdir -p "$REPO"
git -C "$REPO" init -q 2>/dev/null
# macOS resolves /var -> /private/var, and `git worktree list` reports the RESOLVED
# path. The slug must be built from the same string the function will compute, or
# every assertion below looks at a directory nobody created.
REPO="$(cd "$REPO" && pwd -P)"
SLUG="$(printf '%s' "$REPO" | sed 's|/|-|g')"

setup() {
  W="$(mktemp -d)"; P="$(mktemp -d)"
  mkdir -p "$W/projects/$SLUG" \
           "$W/projects/$SLUG-tooling-boss" \
           "$W/projects/$SLUG-apps-gym-app" \
           "$W/projects/-Users-somewhere-worktrees-slot1-personal-stuff" \
           "$W/projects/-Users-kbtg-codebase-dashboard-api" \
           "$P/projects/$SLUG" \
           "$P/projects/$SLUG-tooling-boss"
}

run() {
  # shellcheck disable=SC1090
  ( REPO_ROOT="$REPO" \
    CLAUDE_WORK_CONFIG_DIR="$W" \
    CLAUDE_PERSONAL_CONFIG_DIR="$P" \
    bash -c 'source "$1"; link_shared_memory' _ "$FN" ) 2>&1
}

CANON_OF() { printf '%s/projects/%s/memory' "$W" "$SLUG"; }

# --- (1) the canonical store is created and is a REAL directory --------------
setup; run >/dev/null
canon="$(CANON_OF)"
if [ -d "$canon" ] && [ ! -L "$canon" ]; then
  pass "the canonical store is a real directory, not a link to itself"
else
  fail "canonical store wrong: $(ls -ld "$canon" 2>&1)"
fi

# --- (2) a repo SUBFOLDER store is linked ------------------------------------
[ "$(readlink "$W/projects/$SLUG-tooling-boss/memory")" = "$canon" ] \
  && pass "a subfolder store (tooling-boss) is linked" \
  || fail "subfolder store not linked"

# --- (3) the OTHER account is linked -----------------------------------------
[ "$(readlink "$P/projects/$SLUG/memory")" = "$canon" ] \
  && pass "the personal account root store is linked" \
  || fail "personal account store not linked"

# --- (4) a subfolder under the OTHER account is linked -----------------------
[ "$(readlink "$P/projects/$SLUG-tooling-boss/memory")" = "$canon" ] \
  && pass "a subfolder under the personal account is linked" \
  || fail "personal subfolder not linked"

# --- (5) a WORKTREE checkout of the same repo is linked ----------------------
[ "$(readlink "$W/projects/-Users-somewhere-worktrees-slot1-personal-stuff/memory")" = "$canon" ] \
  && pass "a worktree checkout of the same repo is linked" \
  || fail "worktree checkout not linked"

# --- (6) THE IMPORTANT ONE: an UNRELATED repo is never touched ---------------
[ ! -e "$W/projects/-Users-kbtg-codebase-dashboard-api/memory" ] \
  && pass "an unrelated repo (dashboard-api) is left alone" \
  || fail "linked a store belonging to another repo"

# --- (7) a non-empty REAL store is refused, not clobbered --------------------
setup
mkdir -p "$P/projects/$SLUG/memory"
printf 'precious\n' > "$P/projects/$SLUG/memory/keep.md"
out="$(run)"; rc=$?
if [ -f "$P/projects/$SLUG/memory/keep.md" ] && [ "$rc" -ne 0 ]; then
  pass "a non-empty real store is refused, exits non-zero, and survives"
else
  fail "a non-empty real store was clobbered or silently accepted (rc=$rc)"
fi

# --- (8) ...and the refusal does not stop the OTHER stores linking -----------
[ -L "$P/projects/$SLUG-tooling-boss/memory" ] \
  && pass "one refusal does not abort the remaining links" \
  || fail "a refusal stopped the loop"

# --- (9) an EMPTY real store is replaced by the link ------------------------
setup
mkdir -p "$P/projects/$SLUG/memory"
run >/dev/null
[ -L "$P/projects/$SLUG/memory" ] \
  && pass "an empty real store is replaced by the link" \
  || fail "an empty real store was not replaced"

# --- (10) idempotent: a second run changes nothing and exits 0 --------------
setup; run >/dev/null
before="$(find "$W/projects" "$P/projects" -name memory | sort)"
run >/dev/null; rc=$?
after="$(find "$W/projects" "$P/projects" -name memory | sort)"
[ "$before" = "$after" ] && [ "$rc" -eq 0 ] \
  && pass "a second run is a no-op and exits 0" \
  || fail "not idempotent (rc=$rc)"

# --- (11) a stale link pointing elsewhere is repaired -----------------------
setup
canon="$(CANON_OF)"   # setup makes a FRESH sandbox, so recompute
ln -sfn /tmp/some-other-place "$P/projects/$SLUG/memory"
run >/dev/null
[ "$(readlink "$P/projects/$SLUG/memory")" = "$canon" ] \
  && pass "a link pointing somewhere else is repaired" \
  || fail "stale link not repaired"

echo
if [ "$fails" -eq 0 ]; then echo "ALL TESTS PASSED"; exit 0; fi
echo "$fails TEST(S) FAILED"; exit 1
