#!/usr/bin/env bash
# The gate for pp-land. Eight behavioural cases against a REAL bare remote inside a
# mktemp -d sandbox with a sandboxed HOME. It never touches the real origin: every git
# operation here is against $SANDBOX/origin.git.
#
# Cases 6 and 7 are the load-bearing pair. Case 6 is the concurrency window — the naive
# "check the flag, then release the mutex" order drops a commit that arrives between the
# two, and with no notifications that is indistinguishable from success. Case 7 is the
# golden test protecting boss: greenlight is shared, so the flag-absent path is asserted
# rather than assumed.
set -uo pipefail

fail() { echo "FAIL: $*" >&2; exit 1; }
note() { echo "  .. $*"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Every long step is bounded, so a regression fails instead of hanging: a hanging test is
# an invisible failure.
TMO="timeout"
command -v gtimeout >/dev/null 2>&1 && TMO="gtimeout"
tmo() { "$TMO" -k 10 120 "$@"; }

SANDBOX=$(cd "$(mktemp -d)" && pwd -P)
cleanup_sandbox() {
  # PPLAND_TEST_KEEP=1 leaves the sandbox behind. A land runs detached, so its log is the
  # only account of what happened, and a failure is undiagnosable without it.
  if [ -n "${PPLAND_TEST_KEEP:-}" ]; then
    echo "sandbox kept at $SANDBOX" >&2
    return 0
  fi
  rm -rf "$SANDBOX" 2>/dev/null || true
}
trap cleanup_sandbox EXIT

export HOME="$SANDBOX/home"
mkdir -p "$HOME"
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE 2>/dev/null || true

ORIGIN="$SANDBOX/origin.git"
MAIN="$SANDBOX/personal-stuff"     # basename matters: bootstrap.d/<repo>.sh is keyed on it

# ---------------------------------------------------------------------------
# Build the sandbox repo
# ---------------------------------------------------------------------------
tmo git init --bare -b main "$ORIGIN" >/dev/null 2>&1 || fail "cannot create the bare origin"
tmo git init -b main "$MAIN" >/dev/null 2>&1 || fail "cannot create the main checkout"
git -C "$MAIN" remote add origin "$ORIGIN"
git -C "$MAIN" config user.email "test@example.invalid"
git -C "$MAIN" config user.name "pp-land test"
git -C "$MAIN" config commit.gpgsign false
git -C "$MAIN" config advice.detachedHead false

mkdir -p "$MAIN/src" "$MAIN/infra" "$MAIN/pipelines" \
         "$MAIN/tooling/cli/pp-land" "$MAIN/tooling/cli/greenlight" \
         "$MAIN/tooling/cli/notify" "$MAIN/tooling/cli/pp-work" \
         "$MAIN/tooling/cli/pp-push" "$MAIN/tooling/cli/wt/bootstrap.d"

cat > "$MAIN/.gitignore" <<'GI'
**/.env
**/credentials.json
.mcp.json
node_modules/
ignored-*
tooling/boss/state/
GI

echo "echo v1" > "$MAIN/src/app.sh"
echo "echo deploy v1" > "$MAIN/infra/deploy.sh"
# A tracked placeholder so `pipelines/` is a real tracked directory: the bootstrap hook
# links an IGNORED file into it, and `clean -fd` must leave both alone.
: > "$MAIN/pipelines/.keep"

# The tools under test, copied in exactly as the repo has them.
cp "$SCRIPT_DIR/pp-land" "$MAIN/tooling/cli/pp-land/pp-land"
cp "$SCRIPT_DIR/verify-map.tsv" "$MAIN/tooling/cli/pp-land/verify-map.tsv"
cp "$REPO_ROOT/tooling/cli/greenlight/greenlight" "$MAIN/tooling/cli/greenlight/greenlight"
cp "$REPO_ROOT/tooling/cli/pp-work/pp-work" "$MAIN/tooling/cli/pp-work/pp-work"
cp "$REPO_ROOT/tooling/cli/pp-push/pp-push" "$MAIN/tooling/cli/pp-push/pp-push"
cp "$REPO_ROOT/tooling/cli/wt/bootstrap.d/personal-stuff.sh" \
   "$MAIN/tooling/cli/wt/bootstrap.d/personal-stuff.sh"
chmod +x "$MAIN/tooling/cli/pp-land/pp-land" "$MAIN/tooling/cli/greenlight/greenlight" \
         "$MAIN/tooling/cli/pp-work/pp-work" "$MAIN/tooling/cli/pp-push/pp-push" \
         "$MAIN/tooling/cli/wt/bootstrap.d/personal-stuff.sh"

# A silent notify stub. The real one would try to reach Telegram from a test.
cat > "$MAIN/tooling/cli/notify/notify" <<'NOTIFY'
#!/usr/bin/env bash
exit 0
NOTIFY
chmod +x "$MAIN/tooling/cli/notify/notify"

git -C "$MAIN" add -A >/dev/null
tmo git -C "$MAIN" commit -q -m "init" || fail "initial commit failed"
# BEFORE guard_install: once the pre-push dispatcher is armed, every push must go through
# the installed gate.
tmo git -C "$MAIN" push -q -u origin main || fail "initial push failed"

# Machine-local files the bootstrap hook links. All gitignored, so no commit can carry
# them and only the provisioning step puts them in a fresh landing tree.
printf 'SECRET=1\n' > "$MAIN/pipelines/.env"
printf '{}\n' > "$MAIN/pipelines/credentials.json"
printf '{}\n' > "$MAIN/.mcp.json"

# ---------------------------------------------------------------------------
# Arm the guards from the repo under test
# ---------------------------------------------------------------------------
# shellcheck source=/dev/null
. "$REPO_ROOT/scripts/lib/guard-install.sh"
guard_install "$MAIN" >/dev/null 2>&1 || fail "guard_install failed"
HOOKS="$MAIN/.git/hooks"
[ -x "$HOOKS/post-commit" ] || fail "guard_install did not arm the post-commit dispatcher"
[ -x "$HOOKS/pre-push" ] || fail "guard_install did not arm the pre-push dispatcher"
PPPUSH="$HOME/.local/libexec/pp-push"
[ -x "$PPPUSH" ] || fail "guard_install did not install pp-push"

PPLAND="$MAIN/tooling/cli/pp-land/pp-land"
PPWORK="$MAIN/tooling/cli/pp-work/pp-work"

# The three roots, computed the way the tools compute them.
HASH8=$(printf '%s' "$MAIN" | shasum -a 256 | cut -c 1-8)
LANDING="$HOME/kb-scratch/landing/personal-stuff-$HASH8"
PPL_STATE="$HOME/.local/state/pp-land/personal-stuff-$HASH8"
MUTEX="$PPL_STATE/land.lock"
FLAG="$PPL_STATE/coalesce"
LANDS_DIR="$MAIN/tooling/boss/state/lands"

# ---------------------------------------------------------------------------
# A verify command we can steer from the test
# ---------------------------------------------------------------------------
cat > "$SANDBOX/verify.sh" <<VERIFY
#!/usr/bin/env bash
echo ran >> "$SANDBOX/verify-count"
if [ -f "$SANDBOX/verify-sleep" ]; then sleep "\$(cat "$SANDBOX/verify-sleep")"; fi
if [ -f "$SANDBOX/verify-fail" ]; then exit 1; fi
exit 0
VERIFY
chmod +x "$SANDBOX/verify.sh"
: > "$SANDBOX/verify-count"

printf 'src/\tbash %s\n' "$SANDBOX/verify.sh" > "$SANDBOX/verify-map.tsv"
printf 'infra/\tbash %s\n' "$SANDBOX/verify.sh" >> "$SANDBOX/verify-map.tsv"
export PPLAND_VERIFY_MAP="$SANDBOX/verify-map.tsv"
export PPLAND_MUTEX_MAX_WAIT=120

verify_runs() { wc -l < "$SANDBOX/verify-count" | tr -d ' '; }

# ---------------------------------------------------------------------------
# Waiting on the detached lander
# ---------------------------------------------------------------------------
remote_main() { git ls-remote "$ORIGIN" refs/heads/main 2>/dev/null | awk '{print $1}'; }

origin_has() {
  git -C "$MAIN" fetch -q origin main >/dev/null 2>&1 || true
  git -C "$MAIN" cat-file -e "origin/main:$1" 2>/dev/null
}

wait_mutex_appear() {
  local i=0
  while [ "$i" -lt 600 ]; do
    [ -d "$MUTEX" ] && return 0
    sleep 0.1; i=$((i + 1))
  done
  return 1
}

# Returns once no land is running. Deliberately does NOT look at the coalesce flag: a
# defective lander leaves that flag set forever, and this helper must still return so the
# case that follows can print its own diagnosis rather than a timeout.
wait_land_done() {
  local i=0
  while [ "$i" -lt 1800 ]; do
    if [ ! -d "$MUTEX" ]; then
      sleep 0.7
      [ -d "$MUTEX" ] || return 0
    fi
    sleep 0.1; i=$((i + 1))
  done
  return 1
}

# pp-work resolves its roots from the CWD, so a claim must run from inside the sandbox
# checkout. Getting this wrong once created a workspace and a branch in the REAL repo.
claim() {   # claim <slug>
  local out
  out=$( cd "$MAIN" && tmo "$PPWORK" claim --kind code --slug "$1" 2>/dev/null ) || return 1
  case "$out" in
    "$HOME/kb-scratch/workspaces/personal-stuff-$HASH8/"*) ;;
    *) fail "pp-work claim escaped the sandbox: $out" ;;
  esac
  printf '%s\n' "$out"
}

commit_in() {   # commit_in <workspace> <relpath> <content> <msg>
  local ws="$1" rel="$2" content="$3" msg="$4"
  mkdir -p "$(dirname "$ws/$rel")"
  printf '%s\n' "$content" > "$ws/$rel"
  git -C "$ws" add -A >/dev/null
  tmo git -C "$ws" commit -q -m "$msg"
}

# ===========================================================================
echo "1. a workspace commit lands on main"
# ===========================================================================
before=$(remote_main)
ws1=$(claim land-one) || fail "pp-work claim failed"
[ -d "$ws1" ] || fail "claim returned a path that is not a directory: $ws1"

commit_out=$(commit_in "$ws1" "src/one.txt" "one" "add one" 2>&1) \
  || fail "commit in the workspace failed: $commit_out"
case "$commit_out" in
  *pp-land*) fail "the post-commit dispatcher printed pp-land output into the commit: $commit_out" ;;
esac

wait_mutex_appear || fail "the post-commit dispatcher never started a land"
wait_land_done || fail "the land never finished"

after=$(remote_main)
[ "$before" != "$after" ] || fail "origin/main did not move after a workspace commit"
origin_has "src/one.txt" || fail "the workspace commit is not on origin/main"
[ "$(verify_runs)" -ge 1 ] || fail "the matched verify suite did not run"
note "landed, origin/main $before -> $after"

# ===========================================================================
echo "2. a commit in the MAIN worktree does not trigger a land"
# ===========================================================================
before=$(remote_main)
git -C "$MAIN" fetch -q origin main >/dev/null 2>&1 || true
git -C "$MAIN" merge -q --ff-only origin/main >/dev/null 2>&1 || true
echo "boss bookkeeping" > "$MAIN/src/bookkeeping.txt"
git -C "$MAIN" add -A >/dev/null
main_out=$(tmo git -C "$MAIN" commit -q -m "boss: record something" 2>&1) \
  || fail "commit on main failed: $main_out"
[ -z "$main_out" ] || fail "the dispatcher was not silent on a main-worktree commit: $main_out"
sleep 2
[ ! -d "$MUTEX" ] || fail "a main-worktree commit started a land"
[ "$(remote_main)" = "$before" ] || fail "a main-worktree commit reached origin/main"
# Put the main checkout back so it does not stay diverged from origin/main.
git -C "$MAIN" reset -q --hard origin/main
note "no land fired, origin/main unchanged"

# ===========================================================================
echo "3. the dispatcher writes zero bytes"
# ===========================================================================
ws3=$(claim silent) || fail "pp-work claim failed"
hook_out=$( cd "$ws3" && bash "$HOOKS/post-commit" 2>&1 )
[ -z "$hook_out" ] || fail "the post-commit dispatcher wrote output: [$hook_out]"
wait_land_done || fail "the no-op land never finished"
note "hook produced no stdout and no stderr"

# ===========================================================================
echo "4. a failing verify writes land-<slug>.blocked and publishes nothing"
# ===========================================================================
before=$(remote_main)
: > "$SANDBOX/verify-fail"
ws4=$(claim failing-verify) || fail "pp-work claim failed"
commit_in "$ws4" "src/bad.txt" "bad" "add bad" >/dev/null 2>&1 || fail "commit failed"
wait_mutex_appear || fail "no land started for the failing-verify workspace"
wait_land_done || fail "the failing land never finished"
rm -f "$SANDBOX/verify-fail"

blocked="$LANDS_DIR/land-work-failing-verify.blocked"
[ -f "$blocked" ] || fail "no blocked entry written at $blocked"
grep -q "^workspace=$ws4$" "$blocked" || fail "blocked entry has no workspace= line: $(cat "$blocked")"
grep -q "^branch=work/failing-verify$" "$blocked" || fail "blocked entry has no branch= line"
grep -q "^reason=.*verify" "$blocked" || fail "blocked entry has no verify reason: $(cat "$blocked")"
grep -q "^attempts=" "$blocked" || fail "blocked entry has no attempts= line"
grep -q "^at=" "$blocked" || fail "blocked entry has no at= line"
[ "$(remote_main)" = "$before" ] || fail "a failing verify still reached origin/main"
[ -d "$ws4" ] || fail "a blocked land removed the workspace"
note "blocked entry written, origin/main unchanged"

# ===========================================================================
echo "5. the landing tree is provisioned, and no -x clean ever runs"
# ===========================================================================
[ -d "$LANDING" ] || fail "the landing tree was never created at $LANDING"
case "$LANDING" in
  "$HOME/kb-scratch/landing/"*) ;;
  *) fail "the landing tree is not under the landing root: $LANDING" ;;
esac
[ -L "$LANDING/pipelines/.env" ] || fail "pipelines/.env was not linked into the landing tree"
[ -L "$LANDING/.mcp.json" ] || fail ".mcp.json was not linked into the landing tree"
[ -L "$LANDING/pipelines/credentials.json" ] || fail "credentials.json was not linked"

# Ignored build output must survive a land: `clean -x` would take exactly these, plus the
# symlinks above, and every verify would then fail inside the landing tree.
mkdir -p "$LANDING/node_modules"
echo keep > "$LANDING/node_modules/keep.txt"
echo keep > "$LANDING/ignored-keep.txt"

before=$(remote_main)
ws5=$(claim provisioned) || fail "pp-work claim failed"
commit_in "$ws5" "src/five.txt" "five" "add five" >/dev/null 2>&1 || fail "commit failed"
wait_mutex_appear || fail "no land started for the provisioned workspace"
wait_land_done || fail "the land never finished"
[ "$(remote_main)" != "$before" ] || fail "the provisioned workspace never landed"

[ -f "$LANDING/node_modules/keep.txt" ] || fail "a land deleted node_modules from the landing tree"
[ -f "$LANDING/ignored-keep.txt" ] || fail "a land ran clean -x and deleted ignored files"
[ -L "$LANDING/pipelines/.env" ] || fail "pipelines/.env is missing after a land"
note "symlinks present, ignored output survived"

# ===========================================================================
echo "6. a commit made during a land is coalesced, not dropped"
# ===========================================================================
before=$(remote_main)
runs_before=$(verify_runs)
echo 4 > "$SANDBOX/verify-sleep"
ws6=$(claim coalesce) || fail "pp-work claim failed"

commit_in "$ws6" "src/c1.txt" "c1" "add c1" >/dev/null 2>&1 || fail "first commit failed"
wait_mutex_appear || fail "no land started for the coalesce workspace"
# Wait until the land is genuinely inside its verify, so the second commit lands squarely
# in the window the mutex is protecting.
i=0
while [ "$(verify_runs)" -le "$runs_before" ] && [ "$i" -lt 600 ]; do sleep 0.1; i=$((i + 1)); done
[ "$(verify_runs)" -gt "$runs_before" ] || fail "the in-flight land never reached its verify"
[ -d "$MUTEX" ] || fail "the landing mutex was released before the verify finished"

commit_in "$ws6" "src/c2.txt" "c2" "add c2" >/dev/null 2>&1 || fail "second commit failed"
rm -f "$SANDBOX/verify-sleep"

wait_land_done || fail "the coalescing land never finished"
# One extra settle: the coalesced cycle is started by the SAME holder, so the mutex never
# drops between cycles; this only covers a re-triggered land taking the mutex afresh.
sleep 1
wait_land_done || fail "the coalesced land never finished"

origin_has "src/c1.txt" || fail "the first commit of the pair never reached origin/main"
origin_has "src/c2.txt" || fail "a commit made during a land was silently dropped"
[ "$(remote_main)" != "$before" ] || fail "neither commit of the pair reached origin/main"
note "both commits arrived on origin/main"

# ===========================================================================
echo "7. golden: greenlight's default path is unchanged without --worktree"
# ===========================================================================
GOLDEN_TREE="$SANDBOX/goldentree"
git -C "$MAIN" fetch -q origin main >/dev/null 2>&1 || true
tmo git -C "$MAIN" worktree add --detach "$GOLDEN_TREE" origin/main >/dev/null 2>&1 \
  || fail "cannot create the golden worktree"
tmo git -C "$GOLDEN_TREE" checkout -q -b golden/x >/dev/null 2>&1 || fail "cannot branch in the golden tree"
echo "echo golden" > "$GOLDEN_TREE/src/golden.sh"
git -C "$GOLDEN_TREE" add -A >/dev/null
tmo git -C "$GOLDEN_TREE" commit -q -m "golden change" || fail "golden commit failed"
tmo git -C "$GOLDEN_TREE" checkout -q --detach origin/main >/dev/null 2>&1 || fail "cannot detach the golden tree"

mkdir -p "$SANDBOX/stubbin"
cat > "$SANDBOX/stubbin/wt" <<STUBWT
#!/usr/bin/env bash
verb="\$1"; shift
echo "\$verb" >> "$SANDBOX/wt-calls"
if [ "\$verb" = "get" ]; then echo "$GOLDEN_TREE"; fi
exit 0
STUBWT
chmod +x "$SANDBOX/stubbin/wt"

# A push stub that rejects once, to drive greenlight down its retry path without ever
# publishing anything.
cat > "$SANDBOX/stubbin/pp-push-stub" <<STUBPUSH
#!/usr/bin/env bash
echo push >> "$SANDBOX/push-calls"
n=\$(wc -l < "$SANDBOX/push-calls" | tr -d ' ')
if [ "\$n" -le 1 ]; then exit 1; fi
exit 0
STUBPUSH
chmod +x "$SANDBOX/stubbin/pp-push-stub"

: > "$SANDBOX/wt-calls"
: > "$SANDBOX/push-calls"
golden_before=$(verify_runs)
golden_remote_before=$(remote_main)

PATH="$SANDBOX/stubbin:$PATH" \
PP_PUSH_BIN="$SANDBOX/stubbin/pp-push-stub" \
GREENLIGHT_STATE_ROOT="$SANDBOX/gl-golden" \
  tmo "$MAIN/tooling/cli/greenlight/greenlight" run \
    --repo "$MAIN" --branch golden/x --verify "bash $SANDBOX/verify.sh" >/dev/null 2>&1

grep -qx "get" "$SANDBOX/wt-calls" || fail "greenlight did not lease a worktree from the pool without --worktree"
grep -qx "return" "$SANDBOX/wt-calls" || fail "greenlight did not release its pool lease without --worktree"
[ "$(wc -l < "$SANDBOX/push-calls" | tr -d ' ')" -ge 2 ] || fail "the golden run never exercised the land retry path"
golden_runs=$(( $(verify_runs) - golden_before ))
[ "$golden_runs" -eq 1 ] \
  || fail "greenlight's default retry path re-verified ($golden_runs verify runs, expected exactly 1)"
[ "$(remote_main)" = "$golden_remote_before" ] || fail "the golden run published to the remote"
note "pool lease taken and returned, verify ran exactly once"

# ===========================================================================
echo "8. a deploy-live conflict is never auto-resolved"
# ===========================================================================
ws8=$(claim deploy-live) || fail "pp-work claim failed"
commit_in "$ws8" "infra/deploy.sh" "echo deploy from the workspace" "workspace edits infra" \
  >/dev/null 2>&1 || fail "commit failed"

# Move origin/main's copy of the same file the other way, so the land cannot merge.
git -C "$MAIN" fetch -q origin main >/dev/null 2>&1 || true
git -C "$MAIN" merge -q --ff-only origin/main >/dev/null 2>&1 || true
echo "echo deploy from main" > "$MAIN/infra/deploy.sh"
git -C "$MAIN" add -A >/dev/null
tmo git -C "$MAIN" commit -q -m "main edits infra" || fail "commit on main failed"
tmo "$PPPUSH" --repo "$MAIN" origin main >/dev/null 2>&1 || fail "pp-push of the conflicting change failed"

before=$(remote_main)
tmo "$PPLAND" "$ws8" >/dev/null 2>&1
wait_land_done || fail "the conflicting land never finished"

blocked8="$LANDS_DIR/land-work-deploy-live.blocked"
[ -f "$blocked8" ] || fail "no blocked entry for the deploy-live conflict at $blocked8"
grep -q "^no_auto_resolve=1$" "$blocked8" \
  || fail "the deploy-live conflict was not marked no_auto_resolve=1: $(cat "$blocked8")"
grep -q "^reason=deploy-live-conflict$" "$blocked8" \
  || fail "the deploy-live conflict was not recorded as such: $(cat "$blocked8")"
[ "$(remote_main)" = "$before" ] || fail "a conflicting land still published to origin/main"
[ -d "$ws8" ] || fail "a conflicting land removed the workspace"
note "recorded as deploy-live-conflict and left alone"

echo "ALL TESTS PASSED"
