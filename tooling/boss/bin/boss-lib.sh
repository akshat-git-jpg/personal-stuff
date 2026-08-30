#!/bin/bash
# boss shared helpers. Source, don't execute.
set -uo pipefail
BOSS_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOSS_HOME="$(cd "$BOSS_BIN/.." && pwd)"
REPO_ROOT="$(cd "$BOSS_HOME/../.." && pwd)"   # tooling/boss -> repo root
# Overridable so a different KIND of boss task can get its own namespace. Every
# `state/*.meta` glob (boss_crews_running, the session-start in-flight loop, and any
# future one) then simply never sees it — patching those call sites one at a time is
# how a second site gets missed. Byte-identical behaviour when BOSS_STATE_DIR is unset.
STATE_DIR="${BOSS_STATE_DIR:-$BOSS_HOME/state}"; mkdir -p "$STATE_DIR"
BOSS_NL=$'\n'   # a literal newline, for the multi-line guards below

meta_get()    { local f="$STATE_DIR/$1.meta"; [ -f "$f" ] || return 1; grep "^$2=" "$f" | tail -1 | cut -d= -f2-; }
# meta_set writes one `key=value` LINE, so a value carrying a newline silently
# corrupts the file: meta_get's `grep "^key="` returns only the first line, and
# every following line becomes a bogus key. `test_cmd` is the value that actually
# arrives multi-line (fm_get resolves a YAML `key: |` block scalar verbatim), and
# the corruption surfaced far downstream as greenlight parking on `unexpected EOF`.
# Refuse loudly instead. Callers on the dispatch path check the exit status.
meta_set()    {
  case "$3" in
    *"$BOSS_NL"*)
      echo "FATAL: meta_set $2 for $1 got a MULTI-LINE value; state/<id>.meta is line-based." >&2
      echo "  Write it as one bare line (join steps with && ). Value began: $(printf '%s' "$3" | head -1)" >&2
      return 1 ;;
  esac
  echo "$2=$3" >> "$STATE_DIR/$1.meta"
}

# boss_check_test_cmd <cmd> — echo the cleaned command, or fail with a diagnosis.
# Two shapes have each cost a merge cycle, and both were documented as prose that
# was then violated anyway (CLAUDE.md, "Dispatch and merge plumbing"):
#   1. a MULTI-LINE value corrupts state/<pr>.meta (see meta_set above);
#   2. an inner `bash -c '...'` double-wraps, because boss-merge already wraps the
#      value in `gtimeout ... bash -c`, and greenlight parks on `unexpected EOF
#      while looking for matching quote`.
# Catching both at dispatch turns a 10-minute merge failure into a 1-second refusal.
boss_check_test_cmd() {
  local cmd="$1"
  # Trim surrounding whitespace. A `key: |` block scalar routinely arrives with a
  # trailing newline and that alone is harmless, so trim before judging.
  cmd="${cmd#"${cmd%%[![:space:]]*}"}"
  cmd="${cmd%"${cmd##*[![:space:]]}"}"
  case "$cmd" in
    *"$BOSS_NL"*)
      echo "REFUSED: test_cmd spans multiple lines." >&2
      echo "  state/<pr>.meta is line-based, so a multi-line value is silently truncated" >&2
      echo "  and greenlight parks later on a syntax error. Rewrite the plan frontmatter" >&2
      echo "  as ONE bare line, joining steps with &&." >&2
      return 1 ;;
  esac
  case "$cmd" in
    *"bash -c"*|*"sh -c"*)
      echo "REFUSED: test_cmd contains its own 'bash -c' wrapper." >&2
      echo "  boss-merge already wraps it in: gtimeout -k 30 <ttl>s bash -c <cmd>." >&2
      echo "  The inner wrapper double-wraps and greenlight parks with" >&2
      echo "  'unexpected EOF while looking for matching quote'. Write && and cd bare." >&2
      return 1 ;;
  esac
  printf '%s' "$cmd"
}

# Fix-up budget, PERSISTED. The "one fix-up then blocked" policy lived only in the
# boss session's working memory — no `state/*.meta` key ever recorded it. A compacted
# or restarted boss cannot tell round 1 from round 3, so the bound silently became
# unbounded, which is exactly the failure shape the policy exists to prevent.
#
# The executor's `dispatch` verb is the right choke point: both paths go through it,
# and they are distinguishable there.
#   - boss-dispatch.sh truncates $pr.meta before invoking the executor, so there is
#     no `pid` yet => a FRESH start, counter resets. That is also what gives an
#     amended plan a clean budget: a full re-dispatch is a fresh start by definition.
#   - a DIRECT executor dispatch — the correct way to fix up (see CLAUDE.md; never
#     boss-dispatch, which force-resets the branch and destroys crew commits) — runs
#     against an existing meta that still carries `pid` => a fix-up round, counted.
#
# A `resume` is NOT a dispatch, so a turn-capped continuation never spends this
# budget. That is deliberate: truncation is not a failure (see claude-p's `resume`).
# Raise the bound for one run with BOSS_MAX_FIXUPS=2.
BOSS_MAX_FIXUPS="${BOSS_MAX_FIXUPS:-1}"
boss_fixup_claim() {
  local id="$1" prev n
  prev=$(meta_get "$id" pid 2>/dev/null) || prev=""
  [ -n "$prev" ] || return 0          # first dispatch of this PR — not a fix-up
  n=$(meta_get "$id" fixups 2>/dev/null) || n=""
  case "$n" in ''|*[!0-9]*) n=0 ;; esac
  n=$(( n + 1 ))
  if [ "$n" -gt "$BOSS_MAX_FIXUPS" ]; then
    echo "REFUSED: PR $id has already used $(( n - 1 )) fix-up round(s) (BOSS_MAX_FIXUPS=$BOSS_MAX_FIXUPS)." >&2
    echo "  Park it as boss:blocked instead of re-dispatching. Override for one run with BOSS_MAX_FIXUPS=$n." >&2
    return 1
  fi
  meta_set "$id" fixups "$n"
  echo "boss: PR $id fix-up round $n/$BOSS_MAX_FIXUPS" >&2
  return 0
}

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
_fm_scalar() {
  awk -v k="$1" '
    /^---[[:space:]]*$/ { n++; next }
    n==1 && $0 ~ "^"k":" {
      sub("^"k":[[:space:]]*","")
      # Strip a YAML inline comment (whitespace + #) on unquoted scalars only;
      # a # inside a quoted value is kept verbatim. An EMPTY value whose line
      # carries only a comment (`model:   # blank = default`) lands with the #
      # at position 1 once the key+spaces are consumed — strip that too, else
      # the comment text becomes the value (2026-07-30: PR#126 dispatched agy
      # with --model "# blank = agy default ...", which agy rejected in ~1s).
      if ($0 !~ /^["'\''].*["'\''][[:space:]]*$/) { sub(/[[:space:]]+#.*$/,""); sub(/^#.*$/,"") }
      sub(/[[:space:]]+$/,"")
      # Unwrap only a FULLY quoted scalar. This was gsub(/^"|"$/,""), which
      # stripped a lone TRAILING quote off any value that merely ended with one
      # — silently truncating shell recipes that close on a quote. Plan 191s
      # mutation_apply ended `...indent=2)"`, reached the gate unterminated, and
      # died on a syntax error that boss reported as "mutation_apply failed to
      # run (stale recipe?)" — blaming the plan for a parser bug (2026-08-06).
      if ($0 ~ /^".*"$/)        { sub(/^"/,"");   sub(/"$/,"") }
      else if ($0 ~ /^'\''.*'\''$/) { sub(/^'\''/,""); sub(/'\''$/,"") }
      print; exit
    }
  ' "$2"
}

# _fm_rawline <key> <plan-file> — the raw text after `key:` on the key's line,
# with no cleanup. Used only to sniff a YAML block-scalar indicator.
_fm_rawline() {
  awk -v k="$1" '
    /^---[[:space:]]*$/ { n++; if (n>=2) exit; next }
    n==1 && $0 ~ "^"k":" { sub("^"k":[[:space:]]*",""); print; exit }
  ' "$2"
}

# _fm_block <key> <plan-file> <indicator> — body of a YAML block scalar
# (`key: |`). Reads the indented lines under the key and dedents them by the
# first body line's indent. `|` keeps newlines; `>` folds them to spaces.
# Trailing-newline chomping (`-`/`+`) is moot: every caller uses $(...), which
# strips trailing newlines regardless.
_fm_block() {
  awk -v k="$1" -v ind="$3" '
    BEGIN { bi = -1; fold = (substr(ind,1,1) == ">") }
    /^---[[:space:]]*$/ { if (inb) exit; n++; next }
    n==1 && !inb && $0 ~ "^"k":" { inb = 1; next }
    inb {
      if ($0 ~ /^[[:space:]]*$/) { pend = pend "\n"; next }
      m = match($0, /[^ \t]/) - 1
      if (bi < 0) bi = m
      if (m < bi) exit
      if (pend != "") { printf "%s", pend; pend = "" }
      line = substr($0, bi + 1)
      if (fold) { printf "%s%s", (first++ ? " " : ""), line }
      else print line
    }
    END { if (fold && first) print "" }
  ' "$2"
}

# YAML frontmatter reader: fm_get <key> <plan-file>  (first --- ... --- block)
#
# Handles single-line scalars (_fm_scalar, unchanged) AND `key: |` block
# scalars. Before 2026-08-20 a block scalar returned the literal "|", so the
# mutation gate ran `bash -c "|"`, died on a syntax error, and boss reported
# "mutation_apply failed to run (stale recipe?)" — blaming the plan for a
# parser gap. Same misdiagnosis shape as the plan-191 trailing-quote bug
# documented in _fm_scalar; it blocked PR#169 (plan 210), whose recipe was
# correct and verified by hand.
fm_get() {
  local raw probe
  raw=$(_fm_rawline "$1" "$2")
  probe=${raw%%#*}
  probe=${probe%"${probe##*[![:space:]]}"}
  case "$probe" in
    '|'|'|-'|'|+'|'>'|'>-'|'>+') _fm_block "$1" "$2" "$probe"; return ;;
  esac
  _fm_scalar "$1" "$2"
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

# boss_free_branch_worktree <branch> — release ANY worktree currently holding
# <branch> so a checkout of it can succeed. git refuses to check out a branch that
# another worktree holds; three merges in the 2026-08-02 batch parked on
# "fatal: '<branch>' is already used by worktree at ..." purely because a FINISHED
# crew's worktree still held the ref. The crew's commits live on the branch ref and
# survive the detach, so this is lossless — but refuse if that worktree is dirty
# (uncommitted crew work would be stranded and invisible).
boss_free_branch_worktree() {
  local branch="$1" wt line
  git -C "$REPO_ROOT" worktree list --porcelain 2>/dev/null \
    | awk -v b="refs/heads/$branch" '
        /^worktree /{w=$2} /^branch /{ if ($2==b) print w }' \
    | while read -r wt; do
        [ -n "$wt" ] && [ -d "$wt" ] || continue
        if [ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ]; then
          echo "boss: worktree $wt holds $branch and is DIRTY — not auto-freeing" >&2
          continue
        fi
        git -C "$wt" checkout --detach -q 2>/dev/null \
          && echo "boss: freed $branch from worktree $wt" >&2
      done
}

# --- Chrome serialization (2026-08-02) ------------------------------------
# Every visuals-flow/card-library test_cmd drives headless Chrome (board-ui-smoke,
# card-qa, frame-gate). Running a merge verify while crews render produced
# "Chrome dump-dom timeout on #card-plan" and cost PR#134 a whole merge cycle
# with 44 chrome processes live. A flock-style lock keeps browser-driving work
# serialized without hard-coding which step owns the browser.
BOSS_LOCK_DIR="${BOSS_LOCK_DIR:-$STATE_DIR/locks}"
BOSS_CHROME_WAIT_MIN="${BOSS_CHROME_WAIT_MIN:-45}"
boss_chrome_lock_acquire() {
  local who="$1" lock="$BOSS_LOCK_DIR/chrome.lock" waited=0 owner
  mkdir -p "$BOSS_LOCK_DIR"
  while ! mkdir "$lock" 2>/dev/null; do
    owner=$(cat "$lock/owner" 2>/dev/null || echo unknown)
    # Stale-lock reaper: if the recorded pid is gone, the holder died mid-run.
    if [ -f "$lock/pid" ] && ! kill -0 "$(cat "$lock/pid" 2>/dev/null)" 2>/dev/null; then
      echo "boss: reaping stale chrome lock (owner=$owner)" >&2; rm -rf "$lock"; continue
    fi
    [ "$waited" -ge $((BOSS_CHROME_WAIT_MIN * 60)) ] && {
      echo "boss: chrome lock held by $owner for >${BOSS_CHROME_WAIT_MIN}m — proceeding WITHOUT it" >&2
      # Return non-zero so the caller knows it never held the lock and must not
      # release it on exit. Returning 0 here made a timed-out caller delete the real
      # holder's lock, which is the one situation the lock exists for.
      return 1; }
    [ "$waited" = 0 ] && echo "boss: waiting for chrome lock (held by $owner)…" >&2
    sleep 15; waited=$((waited + 15))
  done
  echo "$who" > "$lock/owner"; echo $$ > "$lock/pid"
}
# Only remove a lock this process owns. A blind rm -rf let a caller that timed out
# (and therefore never held it) delete the real holder's lock on its way out.
boss_chrome_lock_release() {
  local lock="$BOSS_LOCK_DIR/chrome.lock" owner_pid
  owner_pid=$(cat "$lock/pid" 2>/dev/null || echo "")
  if [ -n "$owner_pid" ] && [ "$owner_pid" != "$$" ]; then
    echo "boss: refusing to release a chrome lock owned by pid $owner_pid (we are $$)" >&2
    return 0
  fi
  rm -rf "$lock" 2>/dev/null || true
}

# boss_crews_running — echo "pr:executor" for every dispatched crew whose pid is
# still alive. Used to keep merges off the browser while crews hold it.
#
# PID-REUSE GUARD (2026-08-04). A .meta outlives its crew by design, but the OS
# recycles pids. state/20.meta (PR#20, closed weeks earlier) still recorded
# pid=92224, which the OS had since handed to a long-lived VS Code helper — so
# every merge saw a phantom live crew and burned the FULL BOSS_CHROME_WAIT_MIN
# (45m) before it would even start its verify. PR#148 sat in that wait for 36
# minutes with no subprocess running.
#
# `kill -0` only proves SOMETHING holds the pid. A real crew is started BY
# dispatch, so its process start time sits within moments of dispatched_at;
# the imposter here started 16.7 days later. Anything outside that window is a
# recycled pid, not our crew. Unparseable start time or missing dispatched_at
# falls through to the old behaviour — over-reporting a crew only costs a wait,
# while under-reporting would put a merge on the browser next to a live crew.
boss_crews_running() {
  local f id pid started dispatched
  for f in "$STATE_DIR"/*.meta; do
    [ -f "$f" ] || continue
    id=$(basename "$f" .meta)
    pid=$(meta_get "$id" pid) || continue
    [ -n "$pid" ] || continue
    kill -0 "$pid" 2>/dev/null || continue
    dispatched=$(meta_get "$id" dispatched_at)
    started=$(ps -o lstart= -p "$pid" 2>/dev/null)
    if [ -n "$dispatched" ] && [ -n "$started" ]; then
      started=$(boss_date_epoch "$started" || echo '')
      if [ -n "$started" ] \
         && { [ "$started" -gt $((dispatched + 3600)) ] || [ "$started" -lt $((dispatched - 300)) ]; }; then
        continue
      fi
    fi
    echo "$id:$(meta_get "$id" executor)"
  done
}
boss_ensure_labels() {
  local l; for l in type:feature type:bug type:refactor type:chore \
                    boss:ready boss:in-progress boss:done boss:blocked \
                    gap:test-cmd gap:open-points; do
    gh label create "$l" >/dev/null 2>&1 || true
  done
}

# --- deterministic pre-merge hygiene gates (2026-08-02) --------------------
# Each of these caught a real defect that shipped (or nearly shipped) in the
# 2026-08-02 batch, and each is mechanically checkable with zero LLM involvement.
# Prose in a crew brief is a suggestion; a gate is not — every rule below was
# ALREADY in the brief and was violated anyway.
#
# boss_hygiene_gate <branch> [planfile] — echo one reason per violation (empty = clean).
#
# The artifact rule (3) is opt-out-able via `allow_artifacts: true` in the plan's
# frontmatter. It normally holds because run-log.json is OUTPUT — but plan 199
# migrates the slug keys in all three ledgers, so there the ledger IS the intent
# and a blanket ban makes the plan unmergeable. Opt-out is per-plan and explicit,
# so the rule still binds everywhere it was written for (2026-08-07, PR#159).
# Dependency prelude for anything boss runs in a POOL worktree.
#
# The greenlight verify and the mutation command do NOT run in the crew's
# worktree — each leases its own slot out of the pool of 8. `node_modules` is
# gitignored and `wt`'s reset uses `git clean -fd` (no -x), so ignored files
# survive a lease but are PER SLOT: whether the slot you happen to draw has ever
# built this app is a coin flip. PR#197 (2026-08-23) burned two merge cycles on
# "mutation gate: command already fails on CLEAN state" for exactly this — the
# crew's own tests were green, the gate's slot simply had no node_modules.
#
# The invariant is "a plan's test_cmd must run in a clean checkout". Asking plan
# authors to remember an install step is prose, and prose is a suggestion. So
# boss derives the install step itself, from the command's own `cd` targets, and
# prepends it. Works for every plan already written, not just future ones.
#
# Presence is tested against the BRANCH, not the working tree or main: a plan
# that creates a new app has no package.json on main yet.
boss_dep_prelude() {
  local cmd="$1" branch="$2" dir prelude="" seen=""
  while IFS= read -r dir; do
    [ -n "$dir" ] || continue
    case " $seen " in *" $dir "*) continue ;; esac
    seen="$seen $dir"
    git -C "$REPO_ROOT" cat-file -e "$branch:$dir/package.json" 2>/dev/null || continue
    prelude="${prelude}(cd $dir && npm install --no-audit --no-fund --silent) && "
    # A leased slot has no .dev.vars — it is gitignored, so `wt`'s reset never
    # brings one. Every tracker e2e and every ui:true shot logs in through
    # /dev-login, which the Worker serves ONLY when DEV_AUTH=1, so without it the
    # page renders the literal text "Not found" and the failure reads as a broken
    # app or an unprovable mutation gate (tracker CLAUDE.md, PRs #172/#173/#176).
    # Seed it wherever the app ships a .dev.vars.example. DEV_AUTH is a dev-only
    # flag, not secret material, and an existing file is never overwritten.
    if git -C "$REPO_ROOT" cat-file -e "$branch:$dir/.dev.vars.example" 2>/dev/null; then
      # `echo`, not a printf escape: this prelude is prepended to test_cmd and stored
      # as ONE key=value line in state/<pr>.meta, and meta_set refuses a multi-line
      # value. An escape that expands at build time would corrupt that line.
      prelude="${prelude}(cd $dir && { [ -f .dev.vars ] || echo DEV_AUTH=1 > .dev.vars; }) && "
    fi
  done <<EOF
$(printf '%s' "$cmd" | grep -oE '\bcd[[:space:]]+[^&|;[:space:]]+' | sed -E 's/^cd[[:space:]]+//' | sed -E 's/[\"'"'"']//g')
EOF
  printf '%s' "$prelude"
}

boss_hygiene_gate() {
  local branch="$1" planfile="${2:-}" files allow_artifacts=""
  files=$(git -C "$REPO_ROOT" diff --name-only "origin/main...$branch" 2>/dev/null)
  [ -n "$planfile" ] && [ -f "$planfile" ] \
    && allow_artifacts=$(fm_get allow_artifacts "$planfile" 2>/dev/null)

  # 1. Registry is boss-owned on main. PR#138 committed plans/README.md despite
  #    the brief forbidding it, and dispatch force-resetting it.
  echo "$files" | grep -qx 'plans/README.md' \
    && echo "edits plans/README.md — registry is boss-owned on main"

  # 2. Scratch/junk. PR#136's one-off scratch.mjs actually reached main; PR#141
  #    left test.mp4, browser.pid, measure.sh, before-/after-rss.txt behind.
  local junk
  junk=$(echo "$files" | grep -E '(^|/)(scratch|tmp|measure)[^/]*\.(mjs|js|sh|py|ts)$|\.pid$|(^|/)(before|after)-[^/]*\.txt$|^[^/]*\.(mp4|mov)$' || true)
  [ -n "$junk" ] && echo "adds scratch/junk file(s): $(echo "$junk" | tr '\n' ' ')"

  # 3. Regenerated artifacts. run-log.json rode in on PR#133 and PR#137 and
  #    caused two separate rebase conflicts; it is output, never intent.
  local arts
  case "$allow_artifacts" in
    true|yes|1) arts="" ;;
    *) arts=$(echo "$files" | grep -E '(^|/)run-log\.json$' || true) ;;
  esac
  [ -n "$arts" ] && echo "commits regenerated artifact(s): $(echo "$arts" | tr '\n' ' ')"

  # 4. A migration nobody applies. Plan 239 (PR#200) landed
  #    apps/tutorial-tracker-app/migrations/0003_card_slug.sql with an empty
  #    `deploy:`, and `npm run deploy` there is only "build && wrangler deploy" —
  #    no migration step. Production `cards` had no `slug` column while the landed
  #    code wrote one; it was caught by hand, not by a gate. A schema change is a
  #    deploy by definition, so the frontmatter must say how it ships.
  #    Escape hatch for a migration that is genuinely applied elsewhere:
  #    `migration_deploy: external` in the plan.
  local migs mig_deploy mig_esc
  migs=$(echo "$files" | grep -E '(^|/)migrations/[^/]+\.sql$' || true)
  if [ -n "$migs" ] && [ -n "$planfile" ] && [ -f "$planfile" ]; then
    mig_deploy=$(fm_get deploy "$planfile" 2>/dev/null)
    mig_esc=$(fm_get migration_deploy "$planfile" 2>/dev/null)
    case "$mig_esc" in
      external|manual|done) : ;;
      *) [ -z "$mig_deploy" ] && echo "adds migration(s) but frontmatter has no deploy: $(echo "$migs" | tr '\n' ' ') — set deploy: (the command that applies it) or migration_deploy: external" ;;
    esac
  fi
  return 0
}

# boss_ui_gate <branch> <planfile> — plans declaring `ui: true` must ship a
# committed image. REVERSAL of the 2026-07-18 removal (decisions.md): that gate
# was only ever a crew-brief instruction nobody enforced or consumed, so it was
# pure cost. On 2026-08-02 the owner DID consume it — rejecting PR#141 outright
# for shipping without its screenshot. Re-added as a real gate, which is the
# form the original lacked.
boss_ui_gate() {
  local branch="$1" plan="$2" ui
  ui=$(fm_get ui "$plan" 2>/dev/null)
  case "$ui" in true|yes|1) ;; *) return 0 ;; esac
  git -C "$REPO_ROOT" diff --name-only "origin/main...$branch" 2>/dev/null \
    | grep -qiE '\.(png|jpg|jpeg|webp|gif)$' && return 0
  local hint
  hint=$(boss_ui_ignored_paths "$plan")
  if [ -n "$hint" ]; then
    echo "plan is ui:true but the branch commits no image — and the path(s) it names are GITIGNORED, so the crew could never have committed one: $hint"
    return 0
  fi
  echo "plan is ui:true but the branch commits no image (screenshot evidence missing)"
}

# boss_ui_ignored_paths <planfile> — echo any image path the plan names that
# git would refuse to track. PR#200/plan 239 told its crew to commit
# apps/tutorial-tracker-app/docs/shots/new-video-slug.png; /docs/shots is
# gitignored (.gitignore:24), so `ui: true` could never pass from that path and
# the crew burned a round discovering it. Cheap to check, so check it at
# DISPATCH — before a crew runs — not only in the merge message.
boss_ui_ignored_paths() {
  local plan="$1" p out=""
  [ -f "$plan" ] || return 0
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    p="${p#./}"
    # --no-index is required: without it check-ignore stays silent for a path that
    # is already TRACKED, and the question here is "would git refuse to add this
    # file", asked before the crew has created it. The cost is that a deliberately
    # force-added file still reports — accepted, because the alternative is the
    # gate saying nothing in exactly the case it exists for.
    git -C "$REPO_ROOT" check-ignore -q --no-index "$p" 2>/dev/null && out="$out $p"
  done <<EOF
$(grep -oE '[A-Za-z0-9_./-]+\.(png|jpg|jpeg|webp|gif)' "$plan" 2>/dev/null | sort -u)
EOF
  printf '%s' "${out# }"
}

# boss_mutation_gate <branch> <planfile> <worktree> — THE fix for the 2026-08-02
# batch's worst finding: zero of nine crews produced mutation evidence unprompted,
# and two gates were outright fake (PR#134 asserted on render.mjs SOURCE TEXT so
# the mutation was circular; PR#137's E14 never fired at all). Both passed their
# test_cmd. Prose asking for evidence is unenforceable; running the mutation is.
#
# Frontmatter contract (all three required to arm the gate):
#   mutation_apply:   shell that introduces the defect (run in <worktree>)
#   mutation_command: shell that MUST then fail
#   mutation_expect:  string that MUST appear in that failure output
# Optional: mutation_cwd (relative to repo root; default repo root)
#
# Sequence: clean-assert -> apply -> assert FAIL + expected string -> revert ->
# assert clean again. Echoes one reason per violation (empty = gate proven).
boss_mutation_gate() {
  local branch="$1" plan="$2" wt="$3"
  local apply cmd expect cwd tbin ttl out rc dirty
  apply=$(fm_get mutation_apply "$plan" 2>/dev/null)
  cmd=$(fm_get mutation_command "$plan" 2>/dev/null)
  expect=$(fm_get mutation_expect "$plan" 2>/dev/null)
  [ -n "$apply" ] || return 0            # not armed — plan declares no mutation
  if [ -z "$cmd" ] || [ -z "$expect" ]; then
    echo "mutation_apply set but mutation_command/mutation_expect missing — incomplete mutation contract"; return 0
  fi
  cwd=$(fm_get mutation_cwd "$plan" 2>/dev/null)
  tbin=$(boss_timeout_bin) || { echo "mutation gate needs a timeout binary (macOS: brew install coreutils; Linux: apt install coreutils)"; return 0; }
  ttl=$(fm_get mutation_timeout "$plan" 2>/dev/null); ttl="${ttl:-600}"
  # Install deps the leased slot may not have — see boss_dep_prelude. Without
  # this the gate reports "command already fails on CLEAN state" and the recipe
  # gets blamed for a missing node_modules.
  cmd="$(boss_dep_prelude "$cmd" "$branch")$cmd"

  # Refuse to run against a dirty tree — we must be able to restore by checkout.
  dirty=$(git -C "$wt" status --porcelain 2>/dev/null)
  [ -n "$dirty" ] && { echo "mutation gate cannot run: worktree dirty before mutation"; return 0; }

  # 1. clean must PASS (else the mutation proves nothing) — and capture the
  #    clean output, because "did the mutation change anything?" is a stronger
  #    question than "did it exit non-zero?".
  local clean_out clean_rc
  clean_out=$(_boss_mut_run "$wt" "$cwd" "$ttl" "$cmd"); clean_rc=$?
  if [ "$clean_rc" -ne 0 ]; then
    echo "mutation gate: command already fails on CLEAN state — gate unprovable"; return 0
  fi
  # A clean run that ALREADY prints the expected marker makes the whole check
  # vacuous (the marker would "appear" under mutation no matter what).
  if printf '%s' "$clean_out" | grep -qF -- "$expect"; then
    echo "mutation gate: '$expect' already present on CLEAN state — marker proves nothing"; return 0
  fi
  # 2. apply the mutation
  if ! _boss_mut_run "$wt" "" 120 "$apply" >/dev/null 2>&1; then
    git -C "$wt" checkout -- . 2>/dev/null
    echo "mutation gate: mutation_apply failed to run (stale recipe? plan 175's own 14-word-title recipe was wrong and nobody noticed)"; return 0
  fi
  # The recipe must actually change something. A no-op mutation silently turns
  # the whole gate green — the failure mode this check exists to prevent.
  if [ -z "$(git -C "$wt" status --porcelain 2>/dev/null)" ]; then
    echo "mutation gate: mutation_apply changed NOTHING (no-op recipe — the gate would pass vacuously)"; return 0
  fi
  # 3. it MUST now fail, and fail for the declared reason
  out=$(_boss_mut_run "$wt" "$cwd" "$ttl" "$cmd"); rc=$?
  git -C "$wt" checkout -- . 2>/dev/null   # 4. always revert
  if [ "$rc" -eq 0 ]; then
    echo "mutation gate FAILED: gate did not fire under its own mutation (dead gate — this is exactly PR#137's E14)"
  elif ! printf '%s' "$out" | grep -qF -- "$expect"; then
    echo "mutation gate FAILED: it failed, but '$expect' is absent from the output (wrong failure — the mutation broke something unrelated, or the assertion is circular)"
  elif printf '%s' "$out" | grep -qE 'SyntaxError|ReferenceError|TypeError:|ERR_MODULE_NOT_FOUND|Cannot find (module|package)|Traceback \(most recent|command not found|No such file or directory'; then
    # The marker being present is not enough. An interpreter that crashes often
    # ECHOES the offending source line — which contains the marker — so a broken
    # mutation can look like a firing gate. #133 shipped a real regression whose
    # signature was exactly ERR_MODULE_NOT_FOUND, so treat crash shapes as a
    # wrong failure even when the string matches.
    echo "mutation gate FAILED: failure looks like a CRASH, not the gate firing ($(printf '%s' "$out" | grep -oE 'SyntaxError|ReferenceError|TypeError:|ERR_MODULE_NOT_FOUND|Cannot find (module|package)|Traceback \(most recent|command not found|No such file or directory' | head -1)) — '$expect' may only be echoed source text"
  fi
  # 5. clean again
  if ! _boss_mut_run "$wt" "$cwd" "$ttl" "$cmd" >/dev/null 2>&1; then
    echo "mutation gate: command still fails AFTER revert — the mutation left the tree broken"
  fi
  return 0
}

# _boss_mut_run <wt> <cwd> <ttl> <cmd> — run <cmd> under a timeout in
# <wt>/<cwd>, merging stderr into stdout and preserving the exit code. A plain
# subshell avoids eval, whose nested quoting mangled shell-metachar recipes.
_boss_mut_run() {
  local wt="$1" cwd="$2" ttl="$3" cmd="$4" tbin
  tbin=$(boss_timeout_bin) || return 127
  ( cd "$wt/${cwd:-.}" 2>/dev/null || exit 127
    "$tbin" -k 30 "${ttl}s" bash -c "$cmd" ) 2>&1
}

# boss_timeout_bin — resolve a `timeout`-compatible binary. A hanging test_cmd
# must fail fast, never freeze a run or a merge (2026-07-08 incident: a malformed
# check.sh blocked bash for 83m undetected). macOS ships no `timeout`; coreutils
# provides it as `gtimeout`. Prints the full path of whichever exists (empty +
# nonzero if neither). Callers on the merge path hard-fail when it's missing
# rather than silently running the verify bare.
boss_timeout_bin() { command -v gtimeout 2>/dev/null || command -v timeout 2>/dev/null; }

# --- portable stat/date. macOS ships BSD coreutils; Linux (incl. WSL2 Ubuntu)
# ships GNU. THE ORDER BELOW IS LOAD-BEARING AND NOT INTERCHANGEABLE: under GNU
# stat, `-f` means --file-system and SUCCEEDS, printing a mount point ("/") for
# %m. So the obvious `stat -f %m || stat -c %Y` chain never falls through on
# Linux and hands back "/", which then blows up as an arithmetic operand. BSD
# stat has no `-c` at all and simply errors, so GNU-first is the only ordering
# that degrades correctly on both.
boss_mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1" 2>/dev/null; }
# boss_mtime_fmt <file> - mtime as "YYYY-MM-DD HH:MM:SS" (GNU `date -d @`, BSD `date -r`).
boss_mtime_fmt() {
  local t; t=$(boss_mtime "$1"); [ -n "$t" ] || return 1
  date -d "@$t" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -r "$t" '+%Y-%m-%d %H:%M:%S' 2>/dev/null
}
# boss_date_epoch <stamp> - parse a `ps -o lstart=` stamp to epoch seconds.
boss_date_epoch() {
  date -d "$1" +%s 2>/dev/null || date -j -f '%a %b %e %T %Y' "$1" +%s 2>/dev/null
}

# gh account guard. Another tool (or a second logged-in account) can flip the
# active gh login mid-session; against this PRIVATE repo that silently breaks
# every gh call ("Could not resolve to a Repository") and quietly parks work.
# Assert — and auto-switch — to the expected account on every gh write path
# (session-start, dispatch, merge, deploy). `gh api user` is one unambiguous call
# that also proves the token is valid. Override the expected user via BOSS_GH_USER.
# Resolution order: $BOSS_GH_USER, then `git config boss.ghUser` (per-clone and
# untracked, so a second machine or a second owner sets it once with
# `git config boss.ghUser <login>` and never edits this file), then the original
# default so nothing changes for the primary checkout.
# The `|| true` is load-bearing. `git config --get` EXITS 1 when the key is unset, and
# boss-lib is sourced under `set -e`, so without it EVERY boss entry script dies on load
# the moment boss.ghUser is not configured, which is the normal state of the primary
# checkout. test-boss.sh section (8) caught this: it sources boss-lib in a subshell.
BOSS_GH_USER="${BOSS_GH_USER:-$(git config --get boss.ghUser 2>/dev/null || true)}"
BOSS_GH_USER="${BOSS_GH_USER:-akshat-git-jpg}"
boss_assert_gh() {
  local u; u=$(gh api user -q .login 2>/dev/null)
  [ "$u" = "$BOSS_GH_USER" ] && return 0
  # Remember whose gh session we are taking over so boss_gh_restore can hand it
  # back on exit. `gh auth switch` changes the GLOBAL active account, so without
  # this every boss write path left the owner switched to BOSS_GH_USER and they
  # had to re-switch by hand before any unrelated (e.g. ZluriHQ work-repo) gh
  # call. The work account stays logged in throughout -- only "active" moves.
  if [ -n "$u" ]; then printf '%s' "$u" > "$STATE_DIR/gh_prev"; else rm -f "$STATE_DIR/gh_prev"; fi
  gh auth switch --hostname github.com --user "$BOSS_GH_USER" >/dev/null 2>&1
  u=$(gh api user -q .login 2>/dev/null)
  [ "$u" = "$BOSS_GH_USER" ] || { echo "FATAL: gh active account is '${u:-none}', need $BOSS_GH_USER (run: gh auth switch --user $BOSS_GH_USER)" >&2; return 1; }
  echo "boss: gh account auto-switched to $BOSS_GH_USER (restores on exit)" >&2
}

# Hand the owner's gh account back. Idempotent and safe to call unconditionally --
# a no-op when boss never switched. Every boss entry script traps this on EXIT.
# Set BOSS_GH_KEEP=1 to leave boss's account active (handy when chaining boss
# commands by hand and you don't want a switch-and-restore on every call).
boss_gh_restore() {
  [ "${BOSS_GH_KEEP:-0}" = "1" ] && return 0
  local prev; prev=$(cat "$STATE_DIR/gh_prev" 2>/dev/null) || return 0
  rm -f "$STATE_DIR/gh_prev"
  [ -n "$prev" ] || return 0
  [ "$prev" = "$BOSS_GH_USER" ] && return 0
  gh auth switch --hostname github.com --user "$prev" >/dev/null 2>&1 \
    && echo "boss: gh account restored to $prev" >&2
  return 0
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
# + worktree dirt + the executor's own `progress` signal + bucketed tree CPU +
# output size; when it stops moving for BOSS_STALL_WARN_MIN it warns,
# and past BOSS_STALL_KILL_MIN it kills the tree so the normal dead → one-fix-up →
# blocked policy takes over. Per-PR overrides: meta stall_warn / stall_kill.
BOSS_STALL_WARN_MIN="${BOSS_STALL_WARN_MIN:-15}"
BOSS_STALL_KILL_MIN="${BOSS_STALL_KILL_MIN:-45}"
boss_stall_check() {
  local pr="$1" pid wt out head cpu wtfp exp osize fp now warn kill_ sw sk last_fp progress_at idle
  pid=$(meta_get "$pr" pid); [ -n "$pid" ] || { echo working; return; }
  wt=$(meta_get "$pr" worktree); out=$(meta_get "$pr" out)
  head=$(git -C "$wt" rev-parse HEAD 2>/dev/null || echo none)
  # CPU is BUCKETED into minutes, not used raw. Raw CPU-seconds defeated this
  # check entirely (2026-07-30, PR#128): a deadlocked Chrome/node tree still
  # trickled ~1 CPU-second every ~7 minutes, which changed the fingerprint on
  # every poll, reset progress_at, and let a dead-stuck crew run 87m — clean past
  # both thresholds. Bucketing kills that trickle.
  cpu=$(( $(boss_tree_cpu "$pid") / 60 ))
  # WORKTREE DIRT is the load-bearing liveness signal, NOT cpu. Bucketed CPU alone
  # false-positived within the hour (same night, PR#128 fix-up): agy is I/O-bound
  # on model inference and accrued under 5 CPU-seconds across 15 minutes of real
  # work, while HEAD sat still because it edits for a long stretch before it
  # commits. status+shortstat moves on every save, so an editing crew reads as
  # working; a hung one leaves the tree frozen.
  wtfp=$( { git -C "$wt" status --porcelain -uall 2>/dev/null
            git -C "$wt" diff HEAD --shortstat 2>/dev/null; } | cksum | tr -d ' ')
  # Optional per-executor activity signal (agy: its streaming CLI log size). Silent
  # no-op for executors that don't implement the verb, e.g. claude-p.
  exp=$("$BOSS_HOME/executors/$(meta_get "$pr" executor).sh" progress "$pr" 2>/dev/null)
  osize=$(wc -c < "$out" 2>/dev/null | tr -d ' '); osize="${osize:-0}"
  fp="$head|$wtfp|${exp:-na}|$cpu|$osize"; now=$(date +%s)
  sw=$(meta_get "$pr" stall_warn); warn=$(( ${sw:-$BOSS_STALL_WARN_MIN} ))
  sk=$(meta_get "$pr" stall_kill); kill_=$(( ${sk:-$BOSS_STALL_KILL_MIN} ))
  last_fp=$(meta_get "$pr" stall_fp); progress_at=$(meta_get "$pr" progress_at)
  # A RE-DISPATCH starts a new run, and stall_fp/progress_at from the PREVIOUS run
  # survive in the same .meta file. When the new crew's first fingerprint happens to
  # match the old one — same HEAD, clean tree, empty output, sub-minute CPU, which is
  # exactly what a freshly-started crew looks like — idle was measured from the OLD
  # dispatch and the killer fired instantly on a healthy crew. (2026-08-22, PR#180:
  # a 90-second-old crew was killed as "stalled 45m".) dispatched_at is rewritten by
  # every executor's dispatch verb and meta_get takes the last value, so a
  # dispatched_at newer than progress_at means this is a new run: drop the stale pair
  # and let the branch below re-seed it. Fixes every dispatch path at once, including
  # the direct `executors/<e>.sh dispatch` salvage route that bypasses boss-dispatch.
  local dispatched_at; dispatched_at=$(meta_get "$pr" dispatched_at)
  if [ -n "$dispatched_at" ] && [ -n "$progress_at" ] && [ "$dispatched_at" -gt "$progress_at" ]; then
    last_fp=""; progress_at=""; meta_set "$pr" killed_reason ""
  fi
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

# Resolve a dependency reference to "<pr#> <state>", printing nothing and
# returning 1 when it matches nothing at all.
#
# Why this exists: a plan is WRITTEN before its PR exists, so the author can only
# know the PLAN number (261), never the PR number (221). Every batch that chained
# plans therefore wrote `needs_prs: [261]`, naming a PR that does not exist — the
# gate read UNKNOWN, refused forever, and the only way through was --force, which
# disables the check entirely. The whole 261-264 batch hit this on 2026-08-30.
#
#   mode=pr   — try PR#<n> first, then fall back to the plan-number lookup.
#               The fallback only fires when PR#<n> genuinely does not exist, so a
#               real PR number can never be shadowed by a same-numbered plan.
#   mode=plan — plan number only. This is what `needs_plans:` uses, and it is the
#               key plan authors should reach for.
boss_dep_resolve() {
  local n="$1" mode="${2:-pr}" state="" row=""
  if [ "$mode" = "pr" ]; then
    state=$(gh pr view "$n" --json state -q .state 2>/dev/null || true)
    if [ -n "$state" ]; then printf '%s %s\n' "$n" "$state"; return 0; fi
  fi
  row=$(gh pr list --state all --limit 300 --json number,headRefName,state \
        -q "[.[] | select(.headRefName | startswith(\"boss/$n-\"))] | if length > 0 then \"\(.[0].number) \(.[0].state)\" else \"\" end" \
        2>/dev/null) || true
  [ -n "$row" ] || return 1
  printf '%s\n' "$row"
}
