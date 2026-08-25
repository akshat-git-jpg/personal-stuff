#!/usr/bin/env bash
# doctor-portability — is the custody + auto-commit chain actually armed on THIS machine?
#
# Why this exists: every part of that chain fails SILENTLY when a dependency is missing.
# A hook whose interpreter is absent does not error, it just never fires; a `.sh` checked
# out with CRLF dies on its shebang with a message nobody reads; a symlinked skill that
# arrived as a 40-byte text file simply does not load. On macOS none of this can happen,
# so the failure mode only appears on a second machine — which is exactly when nobody is
# watching for it. This script turns every one of those silences into a printed FAIL.
#
# Run it after a fresh clone, and any time the guards "seem not to be doing anything".
#   bash scripts/doctor-portability.sh
# Exit 0 = armed. Exit 1 = something in the chain is dead.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILED=0
WARNED=0

pass() { printf '  \033[32mPASS\033[0m  %s\n' "$*"; }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$*"; FAILED=$((FAILED+1)); }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$*"; WARNED=$((WARNED+1)); }
head2() { printf '\n\033[1m%s\033[0m\n' "$*"; }

printf '\033[1mpersonal-stuff portability doctor\033[0m\n'
printf 'repo: %s\n' "$REPO"
printf 'uname: %s\n' "$(uname -s 2>/dev/null || echo unknown)"
printf 'bash: %s\n' "${BASH_VERSION:-unknown}"

# ---------------------------------------------------------------- 1. required binaries
head2 "1. Required tools"

if command -v git >/dev/null 2>&1; then
  pass "git ($(git --version 2>/dev/null | head -1))"
else
  fail "git not on PATH"
fi

# The workspace root path is derived from a sha256 of the main checkout's path, so a
# missing hash tool takes out `pp-work claim` entirely — no workspace, no custody.
if command -v shasum >/dev/null 2>&1; then
  pass "sha256 via shasum"
elif command -v sha256sum >/dev/null 2>&1; then
  pass "sha256 via sha256sum"
else
  fail "no sha256 tool (need shasum or sha256sum) — pp-work cannot compute its workspace root"
fi

# The two guard hooks read the harness payload as JSON.
JSON_RT=""
for c in python3 python py node; do
  if command -v "$c" >/dev/null 2>&1; then JSON_RT="$c"; break; fi
done
if [ -n "$JSON_RT" ]; then
  pass "JSON runtime: $JSON_RT"
else
  fail "no JSON runtime (need python3, python, py or node) — both guard hooks are dead"
fi

if command -v cygpath >/dev/null 2>&1; then
  pass "cygpath present (Windows path translation available)"
fi

# ---------------------------------------------------------------- 2. line endings
head2 "2. Line endings (CRLF is fatal to every script here)"

printf 'core.autocrlf = %s\n' "$(git -C "$REPO" config --get core.autocrlf || echo '(unset)')"

CRLF_HITS=0
CRLF_LIST=""
while IFS= read -r f; do
  [ -f "$REPO/$f" ] || continue
  if head -c 4096 "$REPO/$f" 2>/dev/null | grep -q $'\r'; then
    CRLF_HITS=$((CRLF_HITS+1))
    CRLF_LIST="$CRLF_LIST
      $f"
  fi
done <<EOF
.claude/hooks/no-history-in-main.sh
.claude/hooks/commit-before-stop.sh
tooling/cli/pp-work/pp-work
tooling/cli/pp-land/pp-land
tooling/cli/pp-push/pp-push
scripts/relink.sh
scripts/lib/guard-install.sh
scripts/link-clis.sh
EOF

if [ "$CRLF_HITS" -eq 0 ]; then
  pass "no CRLF in the load-bearing scripts"
else
  fail "CRLF found in $CRLF_HITS script(s):$CRLF_LIST
        Fix: git -C \"$REPO\" config core.autocrlf false
             git -C \"$REPO\" rm --cached -r . >/dev/null && git -C \"$REPO\" reset --hard"
fi

# ---------------------------------------------------------------- 3. symlinks
head2 "3. Symlinked skills"

printf 'core.symlinks = %s\n' "$(git -C "$REPO" config --get core.symlinks || echo '(unset)')"

LINK_TOTAL=0
LINK_BROKEN=0
BROKEN_SAMPLE=""
while IFS= read -r f; do
  [ -n "$f" ] || continue
  LINK_TOTAL=$((LINK_TOTAL+1))
  if [ ! -L "$REPO/$f" ]; then
    LINK_BROKEN=$((LINK_BROKEN+1))
    [ -n "$BROKEN_SAMPLE" ] || BROKEN_SAMPLE="$f"
  fi
done < <(git -C "$REPO" ls-files -s | awk '$1=="120000"{ $1=$2=$3=""; sub(/^ +/,""); print }')

if [ "$LINK_TOTAL" -eq 0 ]; then
  warn "no symlinks recorded in the index (unexpected)"
elif [ "$LINK_BROKEN" -eq 0 ]; then
  pass "all $LINK_TOTAL symlinks checked out as real links"
else
  fail "$LINK_BROKEN of $LINK_TOTAL symlinks are plain text files (e.g. $BROKEN_SAMPLE)
        Those skills will not load. On Windows this means symlink support is off.
        Fix: enable Developer Mode, then
             git -C \"$REPO\" config core.symlinks true
             git -C \"$REPO\" rm --cached -r . >/dev/null && git -C \"$REPO\" reset --hard"
fi

# ---------------------------------------------------------------- 4. the guards run
head2 "4. Guard hooks actually fire"

HOOK_NH="$REPO/.claude/hooks/no-history-in-main.sh"
HOOK_CB="$REPO/.claude/hooks/commit-before-stop.sh"

if [ -f "$HOOK_NH" ] && [ -f "$HOOK_CB" ]; then
  pass "both hook scripts present"
else
  fail "a hook script is missing from $REPO/.claude/hooks/"
fi

# The wall must BLOCK (exit 2) a history-recording verb aimed at the main checkout.
if [ -f "$HOOK_NH" ]; then
  out=$(printf '{"cwd":"%s","tool_input":{"command":"git commit -m test"}}' "$REPO" \
        | bash "$HOOK_NH" 2>&1)
  rc=$?
  if [ "$rc" -eq 2 ]; then
    pass "no-history-in-main blocks a commit in the main checkout (exit 2)"
  elif [ "$rc" -eq 0 ]; then
    # Legitimate when the doctor is run from inside a linked worktree.
    if [ "$(git -C "$REPO" rev-parse --path-format=absolute --git-dir 2>/dev/null)" \
       != "$(git -C "$REPO" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" ]; then
      pass "no-history-in-main allowed the commit (this IS a linked worktree — correct)"
    else
      fail "no-history-in-main did NOT block a commit in the main checkout (exit 0).
        The wall is not protecting main. Output was: ${out:-<empty>}"
    fi
  else
    fail "no-history-in-main exited $rc (expected 0 or 2). Output: ${out:-<empty>}"
  fi
fi

# The stop hook must survive a payload and not hang or crash.
if [ -f "$HOOK_CB" ]; then
  out=$(printf '{"cwd":"%s","stop_hook_active":true}' "$REPO" | bash "$HOOK_CB" 2>&1)
  rc=$?
  if [ "$rc" -eq 0 ]; then
    pass "commit-before-stop honours the loop guard (exit 0)"
  else
    fail "commit-before-stop exited $rc on a stop_hook_active payload (expected 0). Output: ${out:-<empty>}"
  fi
fi

# ---------------------------------------------------------------- 5. settings wiring
head2 "5. settings.json wiring"

SETTINGS="$REPO/.claude/settings.json"
if [ ! -f "$SETTINGS" ]; then
  fail "$SETTINGS missing — no hooks are registered at all"
elif grep -q 'no-history-in-main.sh' "$SETTINGS" && grep -q 'commit-before-stop.sh' "$SETTINGS"; then
  if grep -q 'bash \\"' "$SETTINGS"; then
    pass "hooks registered and invoked explicitly through bash"
  else
    warn "hooks registered but not invoked via an explicit 'bash' — fine on macOS, unreliable on Windows"
  fi
else
  fail "settings.json does not register both hooks"
fi

# ---------------------------------------------------------------- 6. custody tooling
head2 "6. Custody tooling"

if bash "$REPO/tooling/cli/pp-work/pp-work" list >/dev/null 2>&1; then
  pass "pp-work runs ($(bash "$REPO/tooling/cli/pp-work/pp-work" list 2>/dev/null | grep -c . ) line(s) of state)"
else
  fail "pp-work failed to run — no workspace can be claimed.
        Try: bash $REPO/tooling/cli/pp-work/pp-work list"
fi

if command -v pp-work >/dev/null 2>&1; then
  pass "pp-work on PATH"
else
  warn "pp-work not on PATH — run: bash scripts/link-clis.sh  (and add ~/.local/bin to PATH)"
fi

if [ -x "$HOME/.local/libexec/pp-push" ]; then
  pass "push gate installed at ~/.local/libexec/pp-push"
else
  warn "push gate not installed — run: bash scripts/relink.sh"
fi

COMMON="$(git -C "$REPO" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"
if [ -n "$COMMON" ] && [ -f "$COMMON/hooks/post-commit" ]; then
  pass "post-commit lander armed"
else
  fail "post-commit hook missing from $COMMON/hooks — commits will never land on main.
        Run: bash scripts/relink.sh"
fi

# ---------------------------------------------------------------- verdict
head2 "Verdict"
if [ "$FAILED" -eq 0 ] && [ "$WARNED" -eq 0 ]; then
  printf '  \033[32mArmed.\033[0m Custody and auto-commit are working on this machine.\n\n'
  exit 0
elif [ "$FAILED" -eq 0 ]; then
  printf '  \033[33mArmed, with %d warning(s).\033[0m The chain works; the notes above are optional.\n\n' "$WARNED"
  exit 0
else
  printf '  \033[31m%d check(s) FAILED\033[0m (and %d warning(s)).\n' "$FAILED" "$WARNED"
  printf '  Do NOT rely on auto-commit until these are green — it fails silently.\n\n'
  exit 1
fi
