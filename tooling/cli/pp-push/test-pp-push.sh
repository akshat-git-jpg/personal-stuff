#!/usr/bin/env bash
# Behavioural harness for the push chokepoint.
#
# Everything here is a REAL push against a local bare remote in mktemp -d, with a
# sandboxed $HOME so the gate installs into a throwaway libexec and never touches
# the real ~/.local/libexec or the real origin. No assertion greps pp-push's own
# source: a gate can be present, well-named and completely inert, and only a real
# push proves which.
set -euo pipefail

fail() { echo "FAIL: $1" >&2; exit 1; }
ok() { echo "  ok: $1"; }
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

BASE=$(mktemp -d); trap 'rm -rf "$BASE"' EXIT

# The self-location check below asserts "not inside a working tree". If the temp dir
# itself sat inside one, every assertion would pass for the wrong reason.
if git -C "$BASE" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "temp dir $BASE is inside a git working tree; cannot test the self-location check"
fi

export HOME="$BASE/home"           # sandbox libexec, lock dir and the hook's $HOME
mkdir -p "$HOME"
git config --global init.defaultBranch main
git config --global user.email t@t
git config --global user.name t

git init --bare -q "$BASE/origin.git"
git clone -q "$BASE/origin.git" "$BASE/wt" 2>/dev/null
cd "$BASE/wt"
git config user.email t@t; git config user.name t
echo hello > README.md; git add README.md; git commit -qm init
git push -q origin HEAD:main 2>/dev/null   # seed main BEFORE the hook is armed

# install the gate into the sandbox HOME. guard_install copies from the repo it is
# given, exactly as it does in production, so the sandbox tree needs the source at the
# same path — this is the file under test, staged into a throwaway checkout.
mkdir -p "$BASE/wt/tooling/cli/pp-push"
cp "$REPO_ROOT/tooling/cli/pp-push/pp-push" "$BASE/wt/tooling/cli/pp-push/pp-push"
source "$REPO_ROOT/scripts/lib/guard-install.sh"
guard_install "$BASE/wt" >/dev/null
GATE="$HOME/.local/libexec/pp-push"
[ -x "$GATE" ] || fail "guard_install did not install pp-push"
[ -f "$HOME/.local/libexec/pp-push.sha256" ] || fail "guard_install did not record a checksum"
[ -x "$BASE/wt/.git/hooks/pre-push" ] || fail "guard_install did not arm pre-push"
[ -z "$(git -C "$BASE/wt" config --get core.hooksPath || true)" ] || fail "guard_install left core.hooksPath set"
ok "guard_install installs the gate, records a checksum, arms pre-push, leaves core.hooksPath unset"

# 0b. the pre-commit half of the wall. `.claude/hooks/no-history-in-main.sh` is a PreToolUse
# hook, so it only sees what Claude runs — a human typing a commit in the main checkout walks
# past it. This git hook closes that half, and must be silent in linked worktrees, which are
# the sanctioned place to record history.
[ -x "$BASE/wt/.git/hooks/pre-commit" ] || fail "guard_install did not arm pre-commit"
# The fixture repo must ship the wall's marker file, since the hook identifies its repo by it.
mkdir -p "$BASE/wt/.claude/hooks"
: > "$BASE/wt/.claude/hooks/no-history-in-main.sh"
PRECOMMIT_HOOK="$BASE/wt/.git/hooks/pre-commit"
set +e
( cd "$BASE/wt" && bash "$PRECOMMIT_HOOK" >/dev/null 2>&1 ); pc_main=$?
set -e
[ "$pc_main" -ne 0 ] || fail "pre-commit ALLOWED a commit in the main checkout"
PCWT="$BASE/pcwt"
git -C "$BASE/wt" worktree add -q "$PCWT" -b harness/precommit >/dev/null 2>&1
set +e
( cd "$PCWT" && bash "$PRECOMMIT_HOOK" >/dev/null 2>&1 ); pc_wt=$?
set -e
[ "$pc_wt" -eq 0 ] || fail "pre-commit BLOCKED a commit in a linked worktree (the sanctioned place)"
# Remove the marker again: leaving it in place makes the pre-commit hook fire for every
# later case in this file, which is how this test first broke the whole suite.
rm -f "$BASE/wt/.claude/hooks/no-history-in-main.sh"
git -C "$BASE/wt" worktree remove --force "$PCWT" >/dev/null 2>&1 || true
ok "pre-commit refuses the main checkout and is silent in a linked worktree"

# 1. a clean push SUCCEEDS through the gate
git fetch -q origin
echo a >> README.md; git add README.md; git commit -qm "clean change"
"$GATE" --repo "$BASE/wt" origin HEAD:main >/dev/null 2>&1 || fail "pp-push refused a CLEAN push"
ok "a clean push lands through the gate"

# 2. a secret-shaped file is REFUSED
git fetch -q origin
printf 'TOKEN=abc\n' > .env; git add -f .env; git commit -qm "add env"
set +e; "$GATE" --repo "$BASE/wt" origin HEAD:main >/dev/null 2>&1; rc=$?; set -e
[ "$rc" -ne 0 ] || fail "pp-push PUSHED a commit containing a secret-shaped file"
git reset -q --hard HEAD~1
ok "a secret-shaped path is refused"

# 2b. a secret ADDED then DELETED inside the same push range is REFUSED.
#
# This is the gap a two-point diff leaves. `diff --name-only A..B` compares the endpoints,
# so a file that appears in one commit and vanishes in the next reports as NO CHANGE — while
# staying readable forever from the pushed history. Proved 2026-08-23: the old gate saw zero
# files and `git show <mid>:.env` still printed the token. It is not exotic here: pp-land
# coalesces commits, so multi-commit pushes are normal, and this repo is public with no
# branch protection.
git fetch -q origin
printf 'GH_TOKEN=gho_leak\n' > .env; git add -f .env; git commit -qm "oops, add env"
MID_SHA=$(git rev-parse HEAD)
git rm -q .env; git commit -qm "remove env again"
# the fixture must be genuinely invisible to the OLD check, or this case proves nothing
[ -z "$(git diff --name-only origin/main..HEAD)" ] \
  || fail "(2b) fixture is vacuous — the two-point diff already sees the range"
git show "$MID_SHA:.env" >/dev/null 2>&1 \
  || fail "(2b) fixture is wrong — the secret is not actually in the range"
set +e; "$GATE" --repo "$BASE/wt" origin HEAD:main >/dev/null 2>&1; rc=$?; set -e
[ "$rc" -ne 0 ] || fail "pp-push PUSHED a range that ADDED then DELETED a secret — readable forever"
git reset -q --hard HEAD~2
ok "a secret added and deleted within one push range is refused"

# 3. an oversized file is REFUSED
git fetch -q origin
mkdir -p big; dd if=/dev/zero of=big/blob.bin bs=1024 count=5000 2>/dev/null
git add big/blob.bin; git commit -qm "add big"
set +e; "$GATE" --repo "$BASE/wt" origin HEAD:main >/dev/null 2>&1; rc=$?; set -e
[ "$rc" -ne 0 ] || fail "pp-push PUSHED an oversized file"
git reset -q --hard HEAD~1
ok "an oversized path is refused"

# 4. the gate refuses to run from INSIDE a working tree
cp "$GATE" "$BASE/wt/pp-push-copy"; chmod +x "$BASE/wt/pp-push-copy"
set +e; "$BASE/wt/pp-push-copy" --repo "$BASE/wt" origin HEAD:main >/dev/null 2>&1; rc=$?; set -e
[ "$rc" -ne 0 ] || fail "pp-push ran from inside a git working tree"
rm -f "$BASE/wt/pp-push-copy"
ok "a copy inside a working tree refuses to run"

# 5. a tampered installed copy is REFUSED (self-integrity)
printf '\n# tampered\n' >> "$GATE"
set +e; "$GATE" --repo "$BASE/wt" origin HEAD:main >/dev/null 2>&1; rc=$?; set -e
[ "$rc" -ne 0 ] || fail "pp-push ran with a checksum mismatch"
guard_install "$BASE/wt" >/dev/null   # restore
ok "a tampered installed copy refuses to run"

# 6. the pre-push net refuses a BARE git push
git fetch -q origin
echo b >> README.md; git add README.md; git commit -qm "bare push attempt"
set +e; git -C "$BASE/wt" push -q origin HEAD:main >/dev/null 2>&1; rc=$?; set -e
[ "$rc" -ne 0 ] || fail "a bare git push bypassed the pre-push net"
ok "a bare git push is refused by the pre-push net"

# 7. and the same change DOES land through the gate
"$GATE" --repo "$BASE/wt" origin HEAD:main >/dev/null 2>&1 || fail "pp-push refused a clean push after the bare attempt"
[ "$(git -C "$BASE/origin.git" rev-parse refs/heads/main)" = "$(git -C "$BASE/wt" rev-parse HEAD)" ] \
  || fail "the gate reported success but origin/main did not move"
ok "the same change lands through the gate and origin/main really moved"

# ---------------------------------------------------------------------------
# 8. boss-commit-main.sh's blast-radius guard. Its REPO_ROOT is derived from the
#    script's own location, so the only way to exercise it without touching the real
#    checkout is a sandbox repo with the same tooling/boss/bin layout.
# ---------------------------------------------------------------------------
BOSSBOX="$BASE/bossrepo"
mkdir -p "$BOSSBOX/tooling/boss/bin" "$BOSSBOX/tooling/cli/notify" "$BOSSBOX/tooling/cli/pp-push"
cp "$REPO_ROOT/tooling/boss/bin/boss-lib.sh" "$REPO_ROOT/tooling/boss/bin/boss-commit-main.sh" \
   "$BOSSBOX/tooling/boss/bin/"
cp "$REPO_ROOT/tooling/cli/pp-push/pp-push" "$BOSSBOX/tooling/cli/pp-push/pp-push"
printf '#!/bin/sh\nexit 0\n' > "$BOSSBOX/tooling/cli/notify/notify"
chmod +x "$BOSSBOX/tooling/cli/notify/notify"

git init --bare -q "$BASE/bossorigin.git"
git init -q -b main "$BOSSBOX"
git -C "$BOSSBOX" remote add origin "$BASE/bossorigin.git"
git -C "$BOSSBOX" config user.email t@t; git -C "$BOSSBOX" config user.name t
git -C "$BOSSBOX" add -A; git -C "$BOSSBOX" commit -qm "boss sandbox"
git -C "$BOSSBOX" push -q origin HEAD:main    # seed before the hook is armed
guard_install "$BOSSBOX" >/dev/null
git -C "$BOSSBOX" fetch -q origin

# 11 dirty paths — more than boss should ever sweep
for i in $(seq 1 11); do echo "x$i" > "$BOSSBOX/dirt-$i.txt"; done
set +e
out=$(bash "$BOSSBOX/tooling/boss/bin/boss-commit-main.sh" "sweep attempt" 2>&1); rc=$?
set -e
[ "$rc" -eq 2 ] || fail "boss-commit-main.sh did not exit 2 on 11 dirty paths (rc=$rc): $out"
case "$out" in *REFUSING*) ;; *) fail "boss-commit-main.sh did not print REFUSING: $out" ;; esac
[ -z "$(git -C "$BOSSBOX" log --oneline origin/main..HEAD 2>/dev/null)" ] \
  || fail "boss-commit-main.sh committed despite refusing"
ok "boss-commit-main.sh refuses an 11-path sweep and commits nothing"

# a small sweep still works, and lands through pp-push
rm -f "$BOSSBOX"/dirt-*.txt
echo small > "$BOSSBOX/small.txt"
bash "$BOSSBOX/tooling/boss/bin/boss-commit-main.sh" "small sweep" >/dev/null 2>&1 \
  || fail "boss-commit-main.sh failed on a small, legitimate sweep"
[ "$(git -C "$BASE/bossorigin.git" rev-parse refs/heads/main)" = "$(git -C "$BOSSBOX" rev-parse HEAD)" ] \
  || fail "boss-commit-main.sh did not push the small sweep through pp-push"
ok "a small sweep commits and lands through pp-push"

echo "ALL TESTS PASSED"
