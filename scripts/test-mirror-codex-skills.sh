#!/usr/bin/env bash
# Tests for scripts/mirror-codex-skills.sh. Runs in a throwaway fake repo, so it
# never touches the real .agents/skills. Covers the Windows cases that a Mac run
# cannot reach: a junction-shaped entry (a REAL DIR, which [ -L ] misses) and a
# git-degraded symlink (a plain text file).
set -euo pipefail
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIRROR="$SCRIPTS_DIR/mirror-codex-skills.sh"
fails=0
ok()   { echo "  ok   $1"; }
bad()  { echo "  FAIL $1" >&2; fails=$((fails + 1)); }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

new_repo() {
  rm -rf "$TMP/repo"; mkdir -p "$TMP/repo/scripts" "$TMP/repo/.claude/skills" "$TMP/repo/.agents/skills"
  cp "$MIRROR" "$TMP/repo/scripts/"
  mkdir -p "$TMP/repo/.claude/skills/alpha"; echo "# alpha" > "$TMP/repo/.claude/skills/alpha/SKILL.md"
  mkdir -p "$TMP/repo/pipelines/.claude/skills/beta"; echo "# beta" > "$TMP/repo/pipelines/.claude/skills/beta/SKILL.md"
  ln -sfn ../../pipelines/.claude/skills/beta "$TMP/repo/.claude/skills/beta"
}
run() { ( cd "$TMP/repo" && ./scripts/mirror-codex-skills.sh 2>&1 ); }

echo "1. links both a plain skill and a symlinked one"
new_repo; run >/dev/null
[[ -f "$TMP/repo/.agents/skills/alpha/SKILL.md" ]] && ok "alpha resolves" || bad "alpha resolves"
[[ -f "$TMP/repo/.agents/skills/beta/SKILL.md" ]]  && ok "beta resolves"  || bad "beta resolves"
[[ "$(readlink "$TMP/repo/.agents/skills/beta")" == "../../pipelines/.claude/skills/beta" ]] \
  && ok "beta points at pipelines directly, no chain" || bad "beta points at pipelines directly"

echo "2. prunes a stale symlink"
new_repo; run >/dev/null
ln -sfn ../../.claude/skills/gone "$TMP/repo/.agents/skills/gone"
run >/dev/null
[[ -L "$TMP/repo/.agents/skills/gone" ]] && bad "stale symlink pruned" || ok "stale symlink pruned"

echo "3. WINDOWS: a stale entry that [ -L ] cannot see is still NOTICED"
# macOS cannot create a true NTFS junction, and no plain-dir fixture reproduces one
# faithfully: through a junction SKILL.md is visible AND rmdir still removes only
# the link. So this asserts the half that IS reachable here — a [ -L ]-false entry
# is recognized as managed and acted on. Before the junction fallback, the prune
# loop's `[[ -L ]] || continue` skipped it in total silence, which is the
# regression being guarded. On real Windows the rmdir then succeeds and it prunes.
new_repo; run >/dev/null
mkdir -p "$TMP/repo/.agents/skills/junk"; echo "# junk" > "$TMP/repo/.agents/skills/junk/SKILL.md"
[[ -L "$TMP/repo/.agents/skills/junk" ]] && bad "fixture is [ -L ]-false" || ok "fixture is [ -L ]-false"
out3="$(run 2>&1 || true)"
grep -q "junk" <<<"$out3" && ok "stale non-symlink entry noticed, not silently skipped" \
                          || bad "stale non-symlink entry noticed, not silently skipped"

echo "4. never deletes a real dir that still has content besides SKILL.md"
new_repo; run >/dev/null
mkdir -p "$TMP/repo/.agents/skills/keep/refs"; echo "# keep" > "$TMP/repo/.agents/skills/keep/SKILL.md"
echo "data" > "$TMP/repo/.agents/skills/keep/refs/notes.md"
run >/dev/null 2>&1 || true
[[ -f "$TMP/repo/.agents/skills/keep/refs/notes.md" ]] && ok "non-empty real dir survived" || bad "non-empty real dir survived"

echo "5. WINDOWS: reports a git-degraded symlink instead of linking to nothing"
new_repo
rm "$TMP/repo/.claude/skills/beta"
printf '../../pipelines/.claude/skills/beta' > "$TMP/repo/.claude/skills/beta"   # what git writes without core.symlinks
out="$(run || true)"
grep -q "degraded symlink" <<<"$out" && ok "degraded source reported" || bad "degraded source reported"
grep -q "1 degraded" <<<"$out" && ok "degraded counted" || bad "degraded counted"
( cd "$TMP/repo" && ./scripts/mirror-codex-skills.sh >/dev/null 2>&1 ) && bad "exits non-zero on degraded" || ok "exits non-zero on degraded"

echo "6. idempotent"
new_repo; run >/dev/null; a="$(run)"; b="$(run)"
[[ "$a" == "$b" ]] && ok "second run matches first" || bad "second run matches first"

echo
[[ "$fails" -eq 0 ]] && { echo "mirror-codex-skills tests: all passed"; exit 0; }
echo "mirror-codex-skills tests: $fails FAILED" >&2; exit 1
