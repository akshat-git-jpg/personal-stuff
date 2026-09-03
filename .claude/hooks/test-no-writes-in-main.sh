#!/usr/bin/env bash
# Behavioural harness for the write wall (.claude/hooks/no-writes-in-main.sh).
#
# Every case feeds the REAL hook REAL PreToolUse/PostToolUse JSON on stdin and checks
# the REAL exit code and REAL filesystem effects (revert, quarantine). Nothing here
# inspects the hook's source text — a source-text assertion would pass for a hook that
# never runs, and would not catch the mutation gate stubbing out the revert line.
#
# Each fixture is a throwaway repo in mktemp -d carrying a copy of the hook's own
# filename, because the wall identifies its repo by that marker rather than a hardcoded
# path. A repo WITHOUT the marker stands in for some other repo, which must be untouched.
#
# Failures do NOT abort the run: every case is reported, then the script exits 1.
set -u

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
HOOK="$HOOK_DIR/no-writes-in-main.sh"
FAILS=0

[ -x "$HOOK" ] || { echo "FAIL: $HOOK is not executable"; exit 1; }

ok()   { printf '  ok   %s\n' "$1"; }
fail() { printf '  FAIL %s\n' "$1"; FAILS=$((FAILS + 1)); }

setup_fixture() {
  local dir; dir="$(mktemp -d)/main"
  mkdir -p "$dir"
  git -C "$dir" init -q
  git -C "$dir" config user.email t@t
  git -C "$dir" config user.name t
  mkdir -p "$dir/.claude/hooks"
  cp "$HOOK" "$dir/.claude/hooks/no-writes-in-main.sh"
  echo "seed" > "$dir/tracked.txt"
  git -C "$dir" add tracked.txt .claude/hooks/no-writes-in-main.sh
  git -C "$dir" commit -qm seed >/dev/null 2>&1
  echo "$dir"
}

run_hook() {  # run_hook <dir> <session_id> <event> <tool_name> <command>
  # Always invoke the ORIGINAL hook, not a copy inside the fixture. The fixture's own
  # copy under .claude/hooks/ exists only to serve as the self-identifying marker file
  # the hook looks for on disk — it is never itself the thing being executed. A case
  # that deliberately omits the marker (case_wrong_tree_untouched) still needs a hook
  # binary to run.
  local dir="$1" sid="$2" event="$3" tool="$4" cmd="$5"
  printf '{"session_id":"%s","cwd":"%s","hook_event_name":"%s","tool_name":"%s","tool_input":{"command":"%s"}}' \
    "$sid" "$dir" "$event" "$tool" "$cmd" | bash "$HOOK"
}

state_dir_for() {  # state_dir_for <session_id>
  printf '%s' "${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/no-writes-in-main/$1"
}

quarantine_count() {  # quarantine_count <dir>
  local d="$1/.claude/quarantine"
  [ -d "$d" ] || { echo 0; return; }
  find "$d" -type f | wc -l | tr -d ' '
}

# ---------------------------------------------------------------- cases

case_revert_appended_tracked_file() {
  local dir sid pre_rc out post_rc content qcount
  dir="$(setup_fixture)"; sid="s1"
  run_hook "$dir" "$sid" PreToolUse Bash "echo hi >> tracked.txt" >/dev/null 2>&1
  pre_rc=$?
  [ "$pre_rc" = 0 ] || fail "PreToolUse itself should exit 0 (got $pre_rc)"

  printf 'seed\nappended\n' > "$dir/tracked.txt"

  out="$(run_hook "$dir" "$sid" PostToolUse Bash "echo hi >> tracked.txt" 2>&1)"; post_rc=$?
  content="$(cat "$dir/tracked.txt")"
  qcount="$(quarantine_count "$dir")"

  if [ "$post_rc" = 2 ] && [ "$content" = "seed" ] && [ "$qcount" = 1 ]; then
    ok "appended tracked file is reverted, quarantined, exit 2"
  else
    fail "LEAK: tracked file in main was not reverted (exit=$post_rc content='$content' qcount=$qcount)"
  fi

  if [ "$qcount" = 1 ] && grep -q "appended" "$dir"/.claude/quarantine/* 2>/dev/null; then
    ok "quarantine file contains the dirty content"
  else
    fail "quarantine file missing or does not contain the dirty content"
  fi

  rm -rf "$(state_dir_for "$sid")"
}

case_untracked_file_untouched() {
  local dir sid out rc qcount
  dir="$(setup_fixture)"; sid="s2"
  run_hook "$dir" "$sid" PreToolUse Bash "touch new.txt" >/dev/null 2>&1
  touch "$dir/new.txt"
  out="$(run_hook "$dir" "$sid" PostToolUse Bash "touch new.txt" 2>&1)"; rc=$?
  qcount="$(quarantine_count "$dir")"
  if [ "$rc" = 0 ] && [ -f "$dir/new.txt" ] && [ "$qcount" = 0 ]; then
    ok "a new untracked file is left alone"
  else
    fail "untracked file was touched (rc=$rc qcount=$qcount)"
  fi
  rm -rf "$(state_dir_for "$sid")"
}

case_linked_worktree_untouched() {
  local maindir wt sid out rc content
  maindir="$(setup_fixture)"; sid="s3"
  wt="$(dirname "$maindir")/wt"
  git -C "$maindir" worktree add -q -b wtbranch "$wt" >/dev/null 2>&1

  run_hook "$wt" "$sid" PreToolUse Bash "echo x >> tracked.txt" >/dev/null 2>&1
  printf 'seed\ndirty\n' > "$wt/tracked.txt"
  out="$(run_hook "$wt" "$sid" PostToolUse Bash "echo x >> tracked.txt" 2>&1)"; rc=$?
  content="$(cat "$wt/tracked.txt")"

  if [ "$rc" = 0 ] && [ "$content" = "$(printf 'seed\ndirty')" ]; then
    ok "a linked worktree is never touched"
  else
    fail "wall fired inside a linked worktree (rc=$rc content='$content')"
  fi

  rm -rf "$(state_dir_for "$sid")"
  git -C "$maindir" worktree remove --force "$wt" >/dev/null 2>&1 || true
}

case_wrong_tree_untouched() {
  local dir sid out rc content
  dir="$(mktemp -d)/other"; mkdir -p "$dir"; sid="s4"
  git -C "$dir" init -q
  git -C "$dir" config user.email t@t; git -C "$dir" config user.name t
  echo "seed" > "$dir/tracked.txt"
  git -C "$dir" add -A >/dev/null 2>&1; git -C "$dir" commit -qm seed >/dev/null 2>&1
  # deliberately no .claude/hooks/no-writes-in-main.sh marker

  run_hook "$dir" "$sid" PreToolUse Bash "echo x >> tracked.txt" >/dev/null 2>&1
  printf 'seed\ndirty\n' > "$dir/tracked.txt"
  out="$(run_hook "$dir" "$sid" PostToolUse Bash "echo x >> tracked.txt" 2>&1)"; rc=$?
  content="$(cat "$dir/tracked.txt")"

  if [ "$rc" = 0 ] && [ "$content" = "$(printf 'seed\ndirty')" ]; then
    ok "a repo without the marker file is never touched"
  else
    fail "wall fired against a repo without its own marker (rc=$rc content='$content')"
  fi
  rm -rf "$(state_dir_for "$sid")"
}

case_sentinel_lets_it_through() {
  local dir sid out rc content qcount linecount
  dir="$(setup_fixture)"; sid="s5"
  run_hook "$dir" "$sid" PreToolUse Bash "echo x >> tracked.txt" >/dev/null 2>&1
  printf 'seed\ndirty\n' > "$dir/tracked.txt"
  touch "$dir/.claude/allow-main-edit"

  out="$(run_hook "$dir" "$sid" PostToolUse Bash "echo x >> tracked.txt" 2>&1)"; rc=$?
  content="$(cat "$dir/tracked.txt")"
  qcount="$(quarantine_count "$dir")"
  linecount="$(printf '%s\n' "$out" | grep -c "no-writes-in-main: allowing this write")"

  if [ "$rc" = 0 ] && [ "$content" = "$(printf 'seed\ndirty')" ] && [ "$qcount" = 0 ] && [ "$linecount" = 1 ]; then
    ok "a fresh sentinel lets the write through, with one explanatory line"
  else
    fail "sentinel override misbehaved (rc=$rc qcount=$qcount linecount=$linecount)"
  fi
  rm -f "$dir/.claude/allow-main-edit"
  rm -rf "$(state_dir_for "$sid")"
}

case_sentinel_expired() {
  local dir sid out rc content qcount
  dir="$(setup_fixture)"; sid="s6"
  run_hook "$dir" "$sid" PreToolUse Bash "echo x >> tracked.txt" >/dev/null 2>&1
  printf 'seed\ndirty\n' > "$dir/tracked.txt"
  touch "$dir/.claude/allow-main-edit"
  touch -t 200001010000 "$dir/.claude/allow-main-edit" 2>/dev/null || \
    touch -d "2020-01-01" "$dir/.claude/allow-main-edit" 2>/dev/null

  out="$(run_hook "$dir" "$sid" PostToolUse Bash "echo x >> tracked.txt" 2>&1)"; rc=$?
  content="$(cat "$dir/tracked.txt")"
  qcount="$(quarantine_count "$dir")"

  if [ "$rc" = 2 ] && [ "$content" = "seed" ] && [ "$qcount" = 1 ]; then
    ok "a stale sentinel is not honored"
  else
    fail "stale sentinel was honored (rc=$rc content='$content' qcount=$qcount)"
  fi
  rm -f "$dir/.claude/allow-main-edit"
  rm -rf "$(state_dir_for "$sid")"
}

case_allow_list_glob_skips_revert() {
  local dir sid out rc content qcount
  dir="$(setup_fixture)"; sid="s7"
  printf 'tracked.txt\n' > "$dir/.claude/allow-main-writes.list"
  run_hook "$dir" "$sid" PreToolUse Bash "echo x >> tracked.txt" >/dev/null 2>&1
  printf 'seed\ndirty\n' > "$dir/tracked.txt"

  out="$(run_hook "$dir" "$sid" PostToolUse Bash "echo x >> tracked.txt" 2>&1)"; rc=$?
  content="$(cat "$dir/tracked.txt")"
  qcount="$(quarantine_count "$dir")"

  if [ "$rc" = 0 ] && [ "$content" = "$(printf 'seed\ndirty')" ] && [ "$qcount" = 0 ]; then
    ok "an allow-listed glob skips the revert"
  else
    fail "allow-list glob did not skip the revert (rc=$rc qcount=$qcount)"
  fi
  rm -rf "$(state_dir_for "$sid")"
}

case_allow_list_missing_is_empty() {
  local dir sid out rc content qcount
  dir="$(setup_fixture)"; sid="s8"
  # no .claude/allow-main-writes.list at all
  run_hook "$dir" "$sid" PreToolUse Bash "echo x >> tracked.txt" >/dev/null 2>&1
  printf 'seed\ndirty\n' > "$dir/tracked.txt"

  out="$(run_hook "$dir" "$sid" PostToolUse Bash "echo x >> tracked.txt" 2>&1)"; rc=$?
  content="$(cat "$dir/tracked.txt")"
  qcount="$(quarantine_count "$dir")"

  if [ "$rc" = 2 ] && [ "$content" = "seed" ] && [ "$qcount" = 1 ]; then
    ok "a missing allow-list file fails open (revert still fires)"
  else
    fail "missing allow-list changed behavior (rc=$rc content='$content' qcount=$qcount)"
  fi
  rm -rf "$(state_dir_for "$sid")"
}

case_bash_only() {
  local dir sid out rc content qcount out2 rc2
  dir="$(setup_fixture)"; sid="s9"
  run_hook "$dir" "$sid" PreToolUse Bash "echo x >> tracked.txt" >/dev/null 2>&1
  printf 'seed\ndirty\n' > "$dir/tracked.txt"

  out="$(run_hook "$dir" "$sid" PostToolUse Edit "echo x >> tracked.txt" 2>&1)"; rc=$?
  content="$(cat "$dir/tracked.txt")"
  qcount="$(quarantine_count "$dir")"

  if [ "$rc" = 0 ] && [ "$content" = "$(printf 'seed\ndirty')" ] && [ "$qcount" = 0 ]; then
    ok "a non-Bash tool_name is a no-op even with dirty tracked files"
  else
    fail "wall fired for a non-Bash tool_name (rc=$rc qcount=$qcount)"
  fi

  # regardless of tree state: no git repo at cwd at all
  out2="$(printf '{"session_id":"s9b","cwd":"/","hook_event_name":"PostToolUse","tool_name":"Edit","tool_input":{"command":"x"}}' | bash "$HOOK" 2>&1)"
  rc2=$?
  if [ "$rc2" = 0 ]; then
    ok "a non-Bash tool_name no-ops even outside any git tree"
  else
    fail "non-Bash tool_name did not no-op outside a git tree (rc=$rc2)"
  fi

  rm -rf "$(state_dir_for "$sid")"
}

case_pre_snap_missing_is_ok() {
  local dir sid out rc content qcount
  dir="$(setup_fixture)"; sid="s10"
  # deliberately never call PreToolUse
  printf 'seed\ndirty\n' > "$dir/tracked.txt"

  out="$(run_hook "$dir" "$sid" PostToolUse Bash "echo x >> tracked.txt" 2>&1)"; rc=$?
  content="$(cat "$dir/tracked.txt")"
  qcount="$(quarantine_count "$dir")"

  if [ "$rc" = 2 ] && [ "$content" = "seed" ] && [ "$qcount" = 1 ]; then
    ok "a missing pre-snap is treated as empty and still catches new dirt"
  else
    fail "missing pre-snap misbehaved (rc=$rc content='$content' qcount=$qcount)"
  fi
  rm -rf "$(state_dir_for "$sid")"
}

# ---------------------------------------------------------------- run

echo "the wall reverts and quarantines"
case_revert_appended_tracked_file

echo
echo "what must stay untouched"
case_untracked_file_untouched
case_linked_worktree_untouched
case_wrong_tree_untouched

echo
echo "the override is deliberate and expires"
case_sentinel_lets_it_through
case_sentinel_expired

echo
echo "the allow-list"
case_allow_list_glob_skips_revert
case_allow_list_missing_is_empty

echo
echo "boundaries"
case_bash_only
case_pre_snap_missing_is_ok

echo
if [ "$FAILS" -gt 0 ]; then
  echo "FAILED: $FAILS"
  exit 1
fi
echo "PASS: 10 cases"
