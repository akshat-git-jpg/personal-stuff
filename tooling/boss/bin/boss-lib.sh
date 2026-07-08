#!/bin/bash
# boss shared helpers. Source, don't execute.
set -uo pipefail
BOSS_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOSS_HOME="$(cd "$BOSS_BIN/.." && pwd)"
REPO_ROOT="$(cd "$BOSS_HOME/../.." && pwd)"   # tooling/boss -> repo root
STATE_DIR="$BOSS_HOME/state"; mkdir -p "$STATE_DIR"

meta_get()    { local f="$STATE_DIR/$1.meta"; [ -f "$f" ] || return 1; grep "^$2=" "$f" | tail -1 | cut -d= -f2-; }
meta_set()    { echo "$2=$3" >> "$STATE_DIR/$1.meta"; }

# boss_head_advanced <id> — 0 if the task's worktree HEAD moved since dispatch.
# A crew that reports success without advancing HEAD produced nothing (or ran on
# the wrong checkout); treating that as "done" would make boss's label state lie.
# Requires the executor to record head_before at dispatch time.
boss_head_advanced() {
  local id="$1" wt before after
  wt=$(meta_get "$id" worktree)
  before=$(meta_get "$id" head_before)
  after=$(git -C "$wt" rev-parse HEAD 2>/dev/null || echo none)
  [ -n "$before" ] && [ "$after" != none ] && [ "$after" != "$before" ]
}

# YAML frontmatter reader: fm_get <key> <plan-file>  (first --- ... --- block)
fm_get() {
  awk -v k="$1" '
    /^---[[:space:]]*$/ { n++; next }
    n==1 && $0 ~ "^"k":" { sub("^"k":[[:space:]]*",""); gsub(/^"|"$/,""); print; exit }
  ' "$2"
}

# boss_repo_dirty — echo the main checkout's uncommitted TRACKED changes (empty =
# clean). greenlight refuses to land onto a dirty REPO_ROOT (it never
# stashes/switches), so ANY tracked change here silently parks EVERY merge as
# "main checkout busy". Untracked files don't block greenlight, so
# --untracked-files=no matches its rule exactly. Single source for the dirty
# check used by both boss-session-start (warns) and boss-dispatch (refuses).
boss_repo_dirty() { git -C "$REPO_ROOT" status --porcelain --untracked-files=no; }

slug_of()     { echo "${1#boss/}"; }
boss_notify() { "$REPO_ROOT/tooling/cli/notify/notify" send "$1" || true; }
boss_ensure_labels() {
  local l; for l in type:feature type:bug type:refactor type:chore \
                    boss:ready boss:in-progress boss:done boss:blocked \
                    gap:test-cmd gap:open-points; do
    gh label create "$l" >/dev/null 2>&1 || true
  done
}

# boss_timeout_bin — resolve a `timeout`-compatible binary. A hanging test_cmd
# must fail fast, never freeze a run or a merge (2026-07-08 incident: a malformed
# check.sh blocked bash for 83m undetected). macOS ships no `timeout`; coreutils
# provides it as `gtimeout`. Prints the full path of whichever exists (empty +
# nonzero if neither). Callers on the merge path hard-fail when it's missing
# rather than silently running the verify bare.
boss_timeout_bin() { command -v gtimeout 2>/dev/null || command -v timeout 2>/dev/null; }

# gh account guard. Another tool (or a second logged-in account) can flip the
# active gh login mid-session; against this PRIVATE repo that silently breaks
# every gh call ("Could not resolve to a Repository") and quietly parks work.
# Assert — and auto-switch — to the expected account on every gh write path
# (session-start, dispatch, merge, deploy). `gh api user` is one unambiguous call
# that also proves the token is valid. Override the expected user via BOSS_GH_USER.
BOSS_GH_USER="${BOSS_GH_USER:-akshat-git-jpg}"
boss_assert_gh() {
  local u; u=$(gh api user -q .login 2>/dev/null)
  [ "$u" = "$BOSS_GH_USER" ] && return 0
  gh auth switch --hostname github.com --user "$BOSS_GH_USER" >/dev/null 2>&1
  u=$(gh api user -q .login 2>/dev/null)
  [ "$u" = "$BOSS_GH_USER" ] || { echo "FATAL: gh active account is '${u:-none}', need $BOSS_GH_USER (run: gh auth switch --user $BOSS_GH_USER)" >&2; return 1; }
  echo "boss: gh account auto-switched to $BOSS_GH_USER" >&2
}

# --- stall detection (fix: `alive` only proves the PID exists; a process blocked
# forever looks identical to one working, which let the 2026-07-08 hang run 83m
# undetected). The load-bearing signal is CPU: a working crew (or a real
# render/download) accrues CPU continuously; a deadlock sits at 0% forever.

# boss_tree_pids <pid> — echo pid + ALL descendant pids (space-separated). The hang
# was a blocked CHILD shell under a live parent, so anything reasoning about or
# killing a crew must walk the whole tree, not just the top pid.
boss_tree_pids() {
  local frontier="$1" all="$1" kids
  while [ -n "${frontier// /}" ]; do
    kids=$(pgrep -P "${frontier// /,}" 2>/dev/null | tr '\n' ' ')
    all="$all $kids"; frontier="$kids"
  done
  echo $all
}

# boss_tree_cpu <pid> — total CPU-seconds across the process tree. Used only as a
# change fingerprint between polls, so whole-second coarseness is fine.
boss_tree_cpu() {
  local pids; pids=$(boss_tree_pids "$1")
  ps -o time= -p "${pids// /,}" 2>/dev/null \
    | awk -F: '{s=$NF; sub(/\..*/,"",s); m=(NF>1?$(NF-1):0); h=(NF>2?$(NF-2):0); sum+=h*3600+m*60+s} END{print sum+0}'
}

# boss_tree_kill <pid> — SIGTERM the whole tree, then SIGKILL after a grace (a
# process stuck in an uninterruptible wait can ignore TERM; orphaning a child
# recreates the hang, so kill descendants too).
boss_tree_kill() {
  local pids; pids=$(boss_tree_pids "$1")
  kill -TERM $pids 2>/dev/null || true
  sleep 3
  kill -KILL $pids 2>/dev/null || true
}

# boss_stall_check <pr> — call ONLY when the executor reports alive/working. Echoes
# `working`, `STALLED(<n>m)`, or `STALLED-KILLED(<n>m)`. Fingerprint = worktree HEAD
# + tree CPU + output size; when it stops moving for BOSS_STALL_WARN_MIN it warns,
# and past BOSS_STALL_KILL_MIN it kills the tree so the normal dead → one-fix-up →
# blocked policy takes over. Per-PR overrides: meta stall_warn / stall_kill.
BOSS_STALL_WARN_MIN="${BOSS_STALL_WARN_MIN:-15}"
BOSS_STALL_KILL_MIN="${BOSS_STALL_KILL_MIN:-45}"
boss_stall_check() {
  local pr="$1" pid wt out head cpu osize fp now warn kill_ sw sk last_fp progress_at idle
  pid=$(meta_get "$pr" pid); [ -n "$pid" ] || { echo working; return; }
  wt=$(meta_get "$pr" worktree); out=$(meta_get "$pr" out)
  head=$(git -C "$wt" rev-parse HEAD 2>/dev/null || echo none)
  cpu=$(boss_tree_cpu "$pid")
  osize=$(wc -c < "$out" 2>/dev/null | tr -d ' '); osize="${osize:-0}"
  fp="$head|$cpu|$osize"; now=$(date +%s)
  sw=$(meta_get "$pr" stall_warn); warn=$(( ${sw:-$BOSS_STALL_WARN_MIN} ))
  sk=$(meta_get "$pr" stall_kill); kill_=$(( ${sk:-$BOSS_STALL_KILL_MIN} ))
  last_fp=$(meta_get "$pr" stall_fp); progress_at=$(meta_get "$pr" progress_at)
  if [ "$fp" != "$last_fp" ] || [ -z "$progress_at" ]; then
    meta_set "$pr" stall_fp "$fp"; meta_set "$pr" progress_at "$now"; echo working; return
  fi
  idle=$(( (now - progress_at) / 60 ))
  if [ "$idle" -ge "$kill_" ]; then
    boss_tree_kill "$pid"; meta_set "$pr" killed_reason "stalled ${idle}m no progress"
    boss_notify "boss:killed PR#$pr — crew stalled ${idle}m (0 progress); treating as dead"
    echo "STALLED-KILLED(${idle}m)"; return
  fi
  [ "$idle" -ge "$warn" ] && { echo "STALLED(${idle}m)"; return; }
  echo working
}
