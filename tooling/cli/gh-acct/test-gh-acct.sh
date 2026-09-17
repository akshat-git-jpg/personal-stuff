#!/usr/bin/env bash
# Behavioural harness for gh-acct and the identity routing it depends on.
#
# The load-bearing claim is that two Claude sessions can commit and push as two
# different GitHub accounts AT THE SAME INSTANT. So the central case actually runs
# three commits concurrently, in three repos with three remotes, and then checks that
# neither shared file moved. A serial test would pass for a design that still races.
#
# Nothing here asserts on source text — that would pass for code that never runs.
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GA="$HERE/gh-acct"

[ -x "$GA" ] || { echo "FAIL: gh-acct not executable at $GA"; exit 1; }

T="$(mktemp -d)"
cleanup() { [ -n "${T:-}" ] && rm -rf "$T"; }
trap cleanup EXIT

fails=0
note() { printf 'FAIL %s\n' "$1"; fails=$((fails + 1)); }

before_hosts="$(shasum "$HOME/.config/gh/hosts.yml" 2>/dev/null | cut -d' ' -f1)"
before_gitcfg="$(shasum "$HOME/.gitconfig" | cut -d' ' -f1)"

mk() {  # mk <name> <remote-url>
  mkdir -p "$T/$1"
  git -C "$T/$1" init -q
  git -C "$T/$1" remote add origin "$2"
  echo x > "$T/$1/f.txt"
  git -C "$T/$1" add f.txt
}

mk work https://github.com/ZluriHQ/dashboard-api.git
mk yt   https://github.com/akshat-git-jpg/personal-stuff.git
mk pers git@github.com:koala25/notes.git          # the ssh remote form must route too

echo "--- (1) three concurrent commits, three authors ---"
git -C "$T/work" commit -q -m "chore: t" &
git -C "$T/yt"   commit -q -m "chore: t" &
git -C "$T/pers" commit -q -m "chore: t" &
wait

check_author() {  # check_author <name> <want-email>
  local got; got="$(git -C "$T/$1" log -1 --format=%ae)"
  [ "$got" = "$2" ] && printf 'ok   %-5s %s\n' "$1" "$got" \
    || note "$1 author: want $2, got $got"
}
check_author work kushal.b@zluri.com
check_author yt   akshatparty17@gmail.com
check_author pers kushalbakliwal25@gmail.com

echo "--- (2) gh-acct resolves each, concurrently ---"
( "$GA" who -C "$T/work" > "$T/r_work" 2>/dev/null ) &
( "$GA" who -C "$T/yt"   > "$T/r_yt"   2>/dev/null ) &
( "$GA" who -C "$T/pers" > "$T/r_pers" 2>/dev/null ) &
wait
check_who() {  # check_who <name> <want-login>
  local got; got="$(cat "$T/r_$1" 2>/dev/null)"
  [ "$got" = "$2" ] && printf 'ok   %-5s %s\n' "$1" "$got" \
    || note "$1 resolve: want $2, got ${got:-<empty>}"
}
check_who work kushal-zluri
check_who yt   akshat-git-jpg
check_who pers koala25

echo "--- (3) nothing shared was written ---"
[ "$before_hosts" = "$(shasum "$HOME/.config/gh/hosts.yml" 2>/dev/null | cut -d' ' -f1)" ] \
  && echo "ok   ~/.config/gh/hosts.yml unchanged" || note "hosts.yml CHANGED — something switched the global account"
[ "$before_gitcfg" = "$(shasum "$HOME/.gitconfig" | cut -d' ' -f1)" ] \
  && echo "ok   ~/.gitconfig unchanged" || note ".gitconfig CHANGED — something wrote a global identity"

echo "--- (4) check agrees with the resolver ---"
"$GA" check -C "$T/work" >/dev/null 2>&1 && echo "ok   check passes on a matching repo" \
  || note "check failed on a repo whose identity matches"
git -C "$T/yt" config user.email "wrong@example.com"
"$GA" check -C "$T/yt" >/dev/null 2>&1 && note "check passed on a MISMATCHED repo" \
  || echo "ok   check catches a mismatched author"

echo "--- (5) an unknown remote is a question, not a guess ---"
mkdir -p "$T/unknown"; git -C "$T/unknown" init -q
git -C "$T/unknown" remote add origin https://github.com/some-other-org/thing.git
"$GA" who -C "$T/unknown" >/dev/null 2>&1
[ "$?" = "2" ] && echo "ok   unknown remote exits 2" || note "unknown remote did not exit 2"

echo "--- (6) a repo with no remote falls back to the path rule ---"
mkdir -p "$T/noremote"; git -C "$T/noremote" init -q
"$GA" who -C "$T/noremote" >/dev/null 2>&1
[ "$?" = "2" ] && echo "ok   a remoteless repo outside every known path exits 2" \
  || note "a remoteless repo in $T resolved to an account instead of asking"

echo
if [ "$fails" -ne 0 ]; then
  echo "FAIL: $fails case(s) failed"
  exit 1
fi
echo "PASS: three accounts, three concurrent commits, zero shared writes"
