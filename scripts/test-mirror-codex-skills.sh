#!/usr/bin/env bash
# Tests for scripts/mirror-codex-skills.sh. Runs against a throwaway repo and a
# throwaway CODEX_HOME, so the real ~/.codex/skills is never touched.
#
# The load-bearing cases are 3 and 4: $CODEX_HOME/skills is SHARED with skills
# owned by other tools, so the script must never overwrite or prune a foreign
# entry, however it is shaped.
set -euo pipefail
export MSYS="${MSYS:-} winsymlinks:nativestrict"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIRROR="$SCRIPTS_DIR/mirror-codex-skills.sh"
fails=0
ok()  { echo "  ok   $1"; }
bad() { echo "  FAIL $1" >&2; fails=$((fails + 1)); }

TMP="$(mktemp -d)"; trap 'chmod -R u+w "$TMP" 2>/dev/null; rm -rf "$TMP"' EXIT

new_env() {
  rm -rf "$TMP/repo" "$TMP/home" "$TMP/foreign"
  mkdir -p "$TMP/repo/scripts" "$TMP/repo/.claude/skills" "$TMP/home/skills" "$TMP/foreign"
  cp "$MIRROR" "$TMP/repo/scripts/"
  printf 'alpha\nbeta\n' > "$TMP/repo/.claude/codex-skills.txt"
  mkdir -p "$TMP/repo/.claude/skills/alpha"; echo "# alpha" > "$TMP/repo/.claude/skills/alpha/SKILL.md"
  mkdir -p "$TMP/repo/pipelines/.claude/skills/beta"; echo "# beta" > "$TMP/repo/pipelines/.claude/skills/beta/SKILL.md"
  ln -sfn ../../pipelines/.claude/skills/beta "$TMP/repo/.claude/skills/beta"
}
run() { ( cd "$TMP/repo" && CODEX_HOME="$TMP/home" ./scripts/mirror-codex-skills.sh 2>&1 ); }

echo "1. links repo skills into \$CODEX_HOME/skills"
new_env; run >/dev/null
[[ -f "$TMP/home/skills/alpha/SKILL.md" ]] && ok "alpha resolves" || bad "alpha resolves"
[[ -f "$TMP/home/skills/beta/SKILL.md" ]]  && ok "beta (a repo symlink) resolves" || bad "beta resolves"

echo "2. prunes our own link when the source skill is deleted"
new_env; run >/dev/null
rm -rf "$TMP/repo/.claude/skills/alpha"
run >/dev/null
[[ -e "$TMP/home/skills/alpha" ]] && bad "stale repo link pruned" || ok "stale repo link pruned"

echo "3. NEVER overwrites a foreign entry that shares a name"
new_env
mkdir -p "$TMP/foreign/alpha"; echo "# FOREIGN" > "$TMP/foreign/alpha/SKILL.md"
ln -sfn "$TMP/foreign/alpha" "$TMP/home/skills/alpha"          # foreign symlink
mkdir -p "$TMP/home/skills/beta"; echo "# FOREIGN-DIR" > "$TMP/home/skills/beta/SKILL.md"  # foreign real dir
out="$(run || true)"
grep -q "# FOREIGN"     "$TMP/home/skills/alpha/SKILL.md" && ok "foreign symlink untouched"  || bad "foreign symlink untouched"
grep -q "# FOREIGN-DIR" "$TMP/home/skills/beta/SKILL.md"  && ok "foreign real dir untouched" || bad "foreign real dir untouched"
grep -q "skip alpha" <<<"$out" && ok "collision reported" || bad "collision reported"

echo "4. NEVER prunes a foreign entry, even with no matching repo skill"
new_env; run >/dev/null
mkdir -p "$TMP/foreign/orphan"; echo "# ORPHAN" > "$TMP/foreign/orphan/SKILL.md"
ln -sfn "$TMP/foreign/orphan" "$TMP/home/skills/orphan"
mkdir -p "$TMP/home/skills/realdir"; echo "x" > "$TMP/home/skills/realdir/SKILL.md"
run >/dev/null
[[ -f "$TMP/home/skills/orphan/SKILL.md" ]]  && ok "foreign orphan symlink survived" || bad "foreign orphan symlink survived"
[[ -f "$TMP/home/skills/realdir/SKILL.md" ]] && ok "foreign real dir survived"       || bad "foreign real dir survived"

echo "5. WINDOWS: a git-degraded symlink is reported, not linked to nothing"
new_env
rm -rf "$TMP/repo/.claude/skills/beta"
printf '../../pipelines/.claude/skills/beta' > "$TMP/repo/.claude/skills/beta"
out="$(run || true)"
grep -q "degraded symlink" <<<"$out" && ok "degraded source reported" || bad "degraded source reported"
( cd "$TMP/repo" && CODEX_HOME="$TMP/home" ./scripts/mirror-codex-skills.sh >/dev/null 2>&1 ) \
  && bad "exits non-zero on degraded" || ok "exits non-zero on degraded"

echo "5b. WINDOWS: NTFS junctions are detected by fsutil and pruned"
new_env; run >/dev/null
if command -v fsutil >/dev/null 2>&1 && command -v cmd >/dev/null 2>&1; then
  # Replace alpha symlink with an NTFS junction to simulate non-admin Windows
  rm -f "$TMP/home/skills/alpha"
  cmd //c mklink //J "$(cygpath -w "$TMP/home/skills/alpha")" "$(cygpath -w "$TMP/repo/.claude/skills/alpha")" >/dev/null
  # Now delete alpha from repo and run mirror
  rm -rf "$TMP/repo/.claude/skills/alpha"
  run >/dev/null
  [[ -e "$TMP/home/skills/alpha" ]] && bad "NTFS junction was NOT pruned" || ok "NTFS junction pruned"
else
  echo "  skip NTFS junction test (not on Windows or missing fsutil/cmd)"
fi

echo "6. prunes a link once its name leaves codex.txt"
new_env; run >/dev/null
printf 'beta\n' > "$TMP/repo/.claude/codex-skills.txt"
run >/dev/null
[[ -e "$TMP/home/skills/alpha" ]] && bad "de-listed link pruned" || ok "de-listed link pruned"
[[ -f "$TMP/home/skills/beta/SKILL.md" ]] && ok "still-listed link kept" || bad "still-listed link kept"

echo "7. idempotent"
new_env; run >/dev/null; a="$(run)"; b="$(run)"
[[ "$a" == "$b" ]] && ok "second run matches first" || bad "second run matches first"

echo
[[ "$fails" -eq 0 ]] && { echo "mirror-codex-skills tests: all passed"; exit 0; }
echo "mirror-codex-skills tests: $fails FAILED" >&2; exit 1
