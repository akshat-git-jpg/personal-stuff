#!/bin/bash
# boss-land-sweep — dispatch a fix-up for every blocked land, into the workspace that
# already exists. Takes no arguments and is safe to run at any time, concurrently, and
# repeatedly. (A trailing argument is accepted and ignored, so pp-land can pass its main
# checkout path without this script having to care.)
#
# Runs under its OWN state namespace. Without that, boss_crews_running (boss-lib.sh
# :182-199) globs every state/*.meta and reports any live pid as a crew, and
# boss-merge.sh waits BOSS_CHROME_WAIT_MIN (45m) for live crews while agy's own timeout
# defaults to 180m — so one long fix-up would stall EVERY boss merge, repeatedly. The
# separate store also keeps land ids out of the session-start in-flight loop, where a
# non-numeric id makes that loop's PR lookup fail, leaves $st empty, matches no skip
# branch, and prints as in-flight forever.
#
# It never calls boss's PR dispatcher, never leases a pool worktree, and never force-moves
# the branch: a blocked land's branch was never pushed, so resetting it to origin/<branch>
# would move the branch away from the owner's ONLY copy of the commit, and returning the
# lease would then wipe the remainder.
set -uo pipefail

BOSS_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOSS_ROOT="$(cd "$BOSS_BIN/.." && pwd)"

# Where pp-land writes its `.blocked` entries. A FIXED path — not derived from the state
# override below, because the two are different things: this is the queue, and the
# override decides where the BOOKKEEPING for working that queue goes.
LANDS_DIR="$BOSS_ROOT/state/lands"
mkdir -p "$LANDS_DIR"

# The load-bearing line: BOSS_STATE_DIR is boss-lib's one override point, so setting it
# here redirects every store this process (and every child) touches. Everything sourced
# or invoked from here down — boss-lib's
# meta_get/meta_set, the executor, the chrome lock — resolves STATE_DIR from this, so no
# `state/*.meta` glob anywhere (present or future) ever sees a land.
export BOSS_STATE_DIR="$LANDS_DIR"

# A contended chrome lock must not park the sweep for boss's 45-minute default: the sweep
# is called synchronously by pp-land after every commit. A short wait, and a timeout is a
# transient cause that the next sweep retries.
: "${BOSS_CHROME_WAIT_MIN:=2}"
export BOSS_CHROME_WAIT_MIN

source "$BOSS_BIN/boss-lib.sh"

AGY="$BOSS_ROOT/executors/agy.sh"
SWEEP_LOCK="$LANDS_DIR/sweep.lock"
LOCK_STALE_SECS="${BOSS_LAND_LOCK_STALE_SECS:-1800}"
LOCK_MAX_WAIT="${BOSS_LAND_LOCK_MAX_WAIT:-60}"
REAL_CAP="${BOSS_LAND_REAL_CAP:-2}"
TRANSIENT_CAP="${BOSS_LAND_TRANSIENT_CAP:-5}"
TRANSIENT_WINDOW="${BOSS_LAND_TRANSIENT_WINDOW:-86400}"
LOCK_HELD=0
DISPATCHED_THIS_RUN=0

log()  { printf 'boss-land-sweep: %s\n' "$1" >&2; }
say()  { printf '%s\n' "$1"; }

# ---------------------------------------------------------------------------
# Its OWN dispatch lock — never pp-land's mutex. Sharing that mutex deadlocks: the
# fix-up commits, the post-commit hook starts a land, and that land waits on the mutex
# its own dispatcher is still holding. Same hardening as the other three locks in this
# repo: mkdir lock with a pid file, stale-break on a dead pid, age-break with no pid,
# bounded wait, owner-checked release.
# ---------------------------------------------------------------------------
lock_try() {
  if mkdir "$SWEEP_LOCK" 2>/dev/null; then
    printf '%s\n' "$$" > "$SWEEP_LOCK/pid"; LOCK_HELD=1; return 0
  fi
  local owner now mt
  owner=$(cat "$SWEEP_LOCK/pid" 2>/dev/null || echo "")
  if [ -n "$owner" ] && ! kill -0 "$owner" 2>/dev/null; then
    log "breaking a stale sweep lock (holder pid $owner is gone)"
    rm -rf "$SWEEP_LOCK"
  elif [ -z "$owner" ]; then
    now=$(date +%s)
    mt=$(boss_mtime "$SWEEP_LOCK"); mt=${mt:-$now}
    if [ $((now - mt)) -ge "$LOCK_STALE_SECS" ]; then
      log "breaking a stale sweep lock (no pid recorded, ${LOCK_STALE_SECS}s+ old)"
      rm -rf "$SWEEP_LOCK"
    fi
  fi
  if mkdir "$SWEEP_LOCK" 2>/dev/null; then
    printf '%s\n' "$$" > "$SWEEP_LOCK/pid"; LOCK_HELD=1; return 0
  fi
  return 1
}

lock_acquire() {
  local waited=0 max=$((LOCK_MAX_WAIT * 5))
  while ! lock_try; do
    [ "$waited" -ge "$max" ] && return 1
    sleep 0.2; waited=$((waited + 1))
  done
  return 0
}

lock_release() {
  [ "$LOCK_HELD" -eq 1 ] || return 0
  local owner
  owner=$(cat "$SWEEP_LOCK/pid" 2>/dev/null || echo "")
  [ -n "$owner" ] && [ "$owner" != "$$" ] && return 0
  rm -rf "$SWEEP_LOCK" 2>/dev/null || true
  LOCK_HELD=0
  return 0
}
trap lock_release EXIT

# ---------------------------------------------------------------------------
# Entry files. Read surgically and rewritten field-by-field — never reserialised — so
# pp-land's own fields (attempts=, at=, conflicts=) survive every restore untouched.
# ---------------------------------------------------------------------------
entry_get() { sed -n "s/^$2=//p" "$1" 2>/dev/null | head -1; }

num_or() { case "$1" in ''|*[!0-9]*) printf '%s' "$2" ;; *) printf '%s' "$1" ;; esac; }

# entry_rewrite <file> <real_attempts> <transient_attempts> <transient_window_start>
# Keeps every other line, in order, and re-states only the three counters this script
# owns. A restore that LOSES a counter turns the cap into an infinite retry, so the
# rewrite is atomic (temp file + mv) — a sweep killed mid-write must not truncate it.
entry_rewrite() {
  local f="$1" real="$2" tr="$3" win="$4" tmp="$1.tmp.$$"
  grep -v -E '^(real_attempts|transient_attempts|transient_window_start)=' "$f" > "$tmp" 2>/dev/null
  {
    printf 'real_attempts=%s\n' "$real"
    printf 'transient_attempts=%s\n' "$tr"
    printf 'transient_window_start=%s\n' "$win"
  } >> "$tmp"
  mv -f "$tmp" "$f"
}

# ---------------------------------------------------------------------------
# The attempt classifier. THE policy of this script — see tooling/boss/CLAUDE.md.
#
#   transient  a blip: resets the real-attempt counter, bounded at TRANSIENT_CAP per
#              slug per TRANSIENT_WINDOW.
#   real       the land is genuinely broken: consumes an attempt, capped at REAL_CAP.
#   never      no dispatch at all, ever; the entry stays listed.
#
# A verify failure is ALWAYS real, even when it smells flaky: auto-retrying a flaky
# verify is how red code lands on a repo vps-sync.sh deploys within 15 minutes. A
# pp-push refusal NEVER retries because a retry re-attempts publishing a secret to a
# PUBLIC repo — it is a content defect wearing a refusal's clothes.
#
# An AUTH failure is transient, and saying so is the whole point of this class. On
# 2026-08-23 every land 403'd because the crew shell had no GH_TOKEN and authenticated
# as the WORK account. pp-land reported it as `land push refused by the push gate
# (exit 128) — remote: Permission to <repo> denied to <other-user>`. That string carries
# neither `pp-push` nor `push rejected`, so it fell through every case here to the
# default `real`, burned REAL_CAP in four attempts, and the land was then listed as
# capped — forever, with the verify passing the whole time. Nothing about a 403 is a
# content defect: the fix is one account switch, after which the same commit lands
# untouched. It is bounded by TRANSIENT_CAP, so a token that has genuinely lost its
# scope costs at most TRANSIENT_CAP dispatches per window rather than retrying forever.
#
# Ordering is load-bearing: the pp-push/secret `never` case is matched FIRST, so a real
# secret refusal can never be reclassified as an auth blip by the patterns below.
#
# The default is `real`, deliberately: an unrecognised cause that consumes an attempt
# costs at most REAL_CAP dispatches, while defaulting to transient retries forever.
# ---------------------------------------------------------------------------
land_class() {
  local r="$1"
  case "$r" in
    *pp-push*|*PPPUSH*|*secret*|*deploy-live*|*no_auto_resolve*) printf 'never'; return ;;
  esac
  # Auth/permission: a wrong-account or scope-less token. Transient — see above.
  case "$r" in
    *403*|*"Permission to"*|*"denied to"*|*"Authentication failed"*\
      |*"could not read Username"*|*"Invalid username or password"*\
      |*"exit 128"*|*"terminal prompts disabled"*)
      printf 'transient'; return ;;
  esac
  # A SECOND `cannot detach at origin/main` means the tree is wedged: the one-shot
  # `clean -xfd` escalation already ran and did not free it.
  case "$r" in
    *"cannot detach"*|*"detach at origin/main"*)
      if [ "${2:-0}" -ge 1 ]; then printf 'never'; else printf 'transient'; fi
      return ;;
  esac
  case "$r" in
    *PPLAND-MUTEX*|*mutex*|*"push rejected"*|*LAND_ATTEMPTS*|*fetch*|*network*|*timeout*\
      |*"pool full"*|*"no worktree"*|*"not installed"*|*"produced no state"*\
      |*"cannot reset the landing tree"*|*"cannot create the landing ref"*)
      printf 'transient'; return ;;
  esac
  case "$r" in
    *verify*|*lint*|*conflict*|*"HEAD did not advance"*) printf 'real'; return ;;
  esac
  printf 'real'
}

# ---------------------------------------------------------------------------
# The brief. Written to an ABSOLUTE path: the executor cd's into the worktree first, so a
# relative brief path is unreadable from there (recorded lesson boss-fixup-brief-absolute-path).
# ---------------------------------------------------------------------------
write_brief() {
  local file="$1" slug="$2" ws="$3" branch="$4" reason="$5" conflicts="$6"
  cat > "$file" <<BRIEF
Fix a BLOCKED land, in place.

Workspace (already exists — work HERE, and nowhere else): $ws
Branch (already checked out there):                       $branch
Why the land did not complete:                            $reason
Conflicting paths (if any):                               ${conflicts:-none recorded}

What to do:

1. cd into that workspace. It is the owner's only copy of this commit. Do NOT create or
   lease another worktree (\`wt\` in any form), and do NOT force-move the branch — no -B
   checkout, no hard reset onto a remote ref. The branch was never pushed, so there is no
   remote copy to recover it from.
2. Fetch origin/main and make this branch land cleanly on it: resolve the conflict, or fix
   whatever the verify caught. Keep the owner's intent; when a rebase conflict is genuinely
   ambiguous, prefer origin/main's version of unrelated hunks and keep your own change small.
3. Commit in that workspace. Committing there re-triggers the land automatically via the
   post-commit hook — do NOT push, do NOT merge, do NOT run greenlight or pp-land yourself.
4. Leave the workspace clean: \`git status --porcelain\` must be empty when you finish.

STOP conditions:

- A gate, test, or assertion must NEVER be weakened, skipped, or deleted to make the land
  pass. If the only way through is to loosen a check, stop and leave the land blocked.
- Do not touch anything outside that workspace.
- Do not send a notification or ask the owner anything. There is nobody to ask.
BRIEF
}

# ---------------------------------------------------------------------------
# Phase A — reap. A `.dispatching` entry whose fix-up is no longer alive is judged by
# boss_head_advanced, NEVER by a label: there is no PR here at all, and labels lie (two
# MERGED PRs were still labelled boss:in-progress).
# ---------------------------------------------------------------------------
reap_one() {
  local f="$1" slug real tr win
  slug=$(basename "$f" .dispatching); slug=${slug#land-}
  if "$AGY" alive "land-$slug" >/dev/null 2>&1; then
    say "RUNNING    land-$slug — fix-up still working"
    return 0
  fi
  if boss_head_advanced "land-$slug"; then
    say "ADVANCED   land-$slug — fix-up committed; the post-commit hook re-triggers the land"
    rm -f "$f"
    return 0
  fi
  # HEAD never advanced: the fix-up produced nothing. That is a real failure.
  real=$(num_or "$(entry_get "$f" real_attempts)" 0)
  tr=$(num_or "$(entry_get "$f" transient_attempts)" 0)
  win=$(num_or "$(entry_get "$f" transient_window_start)" 0)
  real=$((real + 1))
  entry_rewrite "$f" "$real" "$tr" "$win"
  mv -f "$f" "${f%.dispatching}.blocked"
  say "NOADVANCE  land-$slug — fix-up produced no commit (real attempts $real/$REAL_CAP)"
  return 0
}

# ---------------------------------------------------------------------------
# Phase B — claim and dispatch.
# ---------------------------------------------------------------------------
sweep_one() {
  local f="$1" slug claimed ws branch reason conflicts no_auto
  local real tr win class now brief pid rc lock_ok
  slug=$(basename "$f" .blocked); slug=${slug#land-}

  # A live fix-up for this slug means pp-land re-wrote the .blocked entry while the
  # fix-up was still running. Dispatching a second one would have two agents editing
  # one workspace.
  if "$AGY" alive "land-$slug" >/dev/null 2>&1; then
    say "RUNNING    land-$slug — fix-up still working, not re-dispatching"
    return 0
  fi
  if [ -e "${f%.blocked}.dispatching" ]; then
    say "CLAIMED    land-$slug — another sweeper holds this slug"
    return 0
  fi

  # Per-slug atomic claim. A rename within one directory is atomic, so two sweepers can
  # never both take the same slug; whoever loses the `mv` simply skips.
  claimed="${f%.blocked}.dispatching"
  mv "$f" "$claimed" 2>/dev/null || { say "CLAIMED    land-$slug — lost the claim to another sweeper"; return 0; }

  ws=$(entry_get "$claimed" workspace)
  branch=$(entry_get "$claimed" branch)
  reason=$(entry_get "$claimed" reason)
  conflicts=$(entry_get "$claimed" conflicts)
  no_auto=$(entry_get "$claimed" no_auto_resolve)
  real=$(num_or "$(entry_get "$claimed" real_attempts)" 0)
  tr=$(num_or "$(entry_get "$claimed" transient_attempts)" 0)
  win=$(num_or "$(entry_get "$claimed" transient_window_start)" 0)
  now=$(date +%s)

  # A deliberate HOLD, not a failure: these paths reach production through vps-sync.sh's
  # 15-minute pull, so an automatic resolution would publish a guess. The land waits, and
  # this must NOT consume an attempt — so the entry is restored byte-identically.
  if [ "${no_auto:-0}" = "1" ]; then
    mv -f "$claimed" "$f"
    say "HOLD       land-$slug — no_auto_resolve (deploy-live path); waiting, no attempt consumed"
    return 0
  fi

  if [ -z "$ws" ] || [ ! -d "$ws" ]; then
    mv -f "$claimed" "$f"
    say "NOWORKSPACE land-$slug — workspace '${ws:-}' is gone; nothing to fix up"
    return 0
  fi

  class=$(land_class "$reason" "$real")
  case "$class" in
    never)
      mv -f "$claimed" "$f"
      say "NEVER      land-$slug — '$reason' never auto-retries; listed, not dispatched"
      return 0 ;;
    transient)
      # A blip clears the real-attempt budget, but its own budget is bounded per window
      # so a permanently blipping cause cannot dispatch forever.
      if [ "$win" -eq 0 ] || [ $((now - win)) -ge "$TRANSIENT_WINDOW" ]; then win=$now; tr=0; fi
      if [ "$tr" -ge "$TRANSIENT_CAP" ]; then
        entry_rewrite "$claimed" "$real" "$tr" "$win"
        mv -f "$claimed" "$f"
        say "CAPPED     land-$slug — $tr transient retries in this window (cap $TRANSIENT_CAP); listed, not dispatched"
        return 0
      fi
      real=0; tr=$((tr + 1)) ;;
    real)
      if [ "$real" -ge "$REAL_CAP" ]; then
        entry_rewrite "$claimed" "$real" "$tr" "$win"
        mv -f "$claimed" "$f"
        say "CAPPED     land-$slug — $real real attempts (cap $REAL_CAP); listed, not dispatched — $reason"
        return 0
      fi
      real=$((real + 1)) ;;
  esac
  entry_rewrite "$claimed" "$real" "$tr" "$win"

  # The synthetic meta. agy.sh takes no path argument — it resolves the worktree from
  # $STATE_DIR/$id.meta — so without this it exits 1 on the FIRST attempt, every time.
  # meta_set appends and meta_get tails, so re-stating a field overrides it.
  meta_set "land-$slug" worktree "$ws"
  meta_set "land-$slug" model ""
  meta_set "land-$slug" executor agy

  brief="$STATE_DIR/land-$slug.brief.md"
  write_brief "$brief" "$slug" "$ws" "$branch" "$reason" "$conflicts"

  # Hiding land metas from boss_crews_running removes the crew-wait heuristic that used to
  # keep browser-driving work apart (PR#134 lost a merge cycle to 44 live Chrome
  # processes), so take the lock built for that purpose explicitly. A timeout returns
  # non-zero and we must NOT release a lock we never held.
  lock_ok=0
  if boss_chrome_lock_acquire "land-$slug"; then
    lock_ok=1
  else
    win=$([ "$win" -eq 0 ] && echo "$now" || echo "$win")
    entry_rewrite "$claimed" 0 "$tr" "$win"
    mv -f "$claimed" "$f"
    say "WAITING    land-$slug — chrome lock busy (transient); the next sweep retries"
    return 0
  fi

  "$AGY" dispatch "land-$slug" "$brief" >/dev/null 2>&1
  rc=$?
  if [ "$rc" -ne 0 ]; then
    # A mechanical dispatch failure (agy missing, no meta) is transient, not the land's
    # fault — so it must not have consumed a real attempt.
    [ "$lock_ok" -eq 1 ] && boss_chrome_lock_release
    if [ "$win" -eq 0 ] || [ $((now - win)) -ge "$TRANSIENT_WINDOW" ]; then win=$now; tr=0; fi
    entry_rewrite "$claimed" 0 $((tr + 1)) "$win"
    mv -f "$claimed" "$f"
    say "DISPATCHFAIL land-$slug — executor dispatch failed (transient, rc=$rc)"
    return 0
  fi

  # Hand the chrome lock to the fix-up itself: agy backgrounds and disowns, so this
  # process is gone long before the fix-up's verify runs. The existing stale-lock reaper
  # frees it the moment that pid dies.
  pid=$(meta_get "land-$slug" pid 2>/dev/null || echo "")
  if [ "$lock_ok" -eq 1 ] && [ -n "$pid" ] && [ -d "$BOSS_LOCK_DIR/chrome.lock" ]; then
    printf '%s\n' "$pid" > "$BOSS_LOCK_DIR/chrome.lock/pid"
  elif [ "$lock_ok" -eq 1 ]; then
    boss_chrome_lock_release
  fi
  DISPATCHED_THIS_RUN=1
  say "DISPATCHED land-$slug — fix-up in $ws (real $real/$REAL_CAP, transient $tr/$TRANSIENT_CAP) — $reason"
  return 0
}

main() {
  if ! lock_acquire; then
    say "another sweep is running (lock held by pid $(cat "$SWEEP_LOCK/pid" 2>/dev/null || echo unknown)) — nothing done"
    return 0
  fi
  local f n=0
  for f in "$LANDS_DIR"/land-*.dispatching; do
    [ -f "$f" ] || continue
    n=$((n + 1)); reap_one "$f"
  done
  for f in "$LANDS_DIR"/land-*.blocked; do
    [ -f "$f" ] || continue
    n=$((n + 1))
    # At most ONE dispatch per run. The fix-up we just launched now holds the chrome
    # lock for its whole life, so a second dispatch in this run would either sit in
    # boss_chrome_lock_acquire or race the browser — and a lock-busy skip would burn a
    # transient attempt for a land that has not actually failed. The queue drains
    # instead: pp-land calls this after every commit, the fix-up's own commit fires one,
    # and session start is the backstop.
    if [ "$DISPATCHED_THIS_RUN" -eq 1 ]; then
      say "DEFERRED   $(basename "$f" .blocked) — one fix-up per sweep; the next sweep takes this one"
      continue
    fi
    sweep_one "$f"
  done
  [ "$n" -eq 0 ] && say "none — no blocked lands"
  lock_release
  return 0
}

# BOSS_LAND_SWEEP_LIB=1 sources this for its pure helpers (land_class) without sweeping.
[ "${BOSS_LAND_SWEEP_LIB:-}" = 1 ] || main
