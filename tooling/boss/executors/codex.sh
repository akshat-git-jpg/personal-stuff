#!/bin/bash
# Executor: codex — backgrounded OpenAI Codex CLI (`codex exec`) in a worktree.
# Contract: <script> <dispatch|resume|alive|progress|collect> <pr#> [brief-path]
#
# Added 2026-08-25. Runs on the owner's ChatGPT subscription (auth_mode=chatgpt in
# ~/.codex/auth.json), so its tokens are effectively free, same as agy. agy stays
# the routing default; codex is a valid opt-in (owner decision 2026-08-25).
#
# Why the flags are what they are:
#   --json                 stream JSONL events to $out. Unlike agy (whose envelope is
#                          only written at exit) this file GROWS while the model works,
#                          so `progress` is just its byte count — no lsof needed.
#   -o <last>              final agent message, for a human reading the run afterwards.
#   -C <worktree>          codex does NOT bind cwd the way an interactive run does; the
#                          working root must be passed explicitly (same trap as agy's
#                          mandatory --add-dir).
#   --dangerously-bypass-approvals-and-sandbox
#                          matches claude-p's --dangerously-skip-permissions and agy's
#                          --dangerously-skip-permissions. The worktree lease IS the
#                          isolation boundary here; a sandboxed run cannot reach the
#                          network for npm/pip in a test_cmd and cannot commit.
#   < /dev/null            MANDATORY. With a non-tty stdin left open, `codex exec`
#                          prints "Reading additional input from stdin..." and appends
#                          it as a <stdin> block — a backgrounded, disowned run would
#                          block there forever.
#   gtimeout               codex exec has no --print-timeout of its own.
set -uo pipefail
# APPENDED, not prepended: these are a FALLBACK for a minimal cron/launchd PATH, not
# an override. Prepending them would make the real binaries beat anything the caller
# put on PATH first — including test-boss.sh's stubs, which is how this executor
# would become the one part of boss with no hermetic test.
export PATH="$PATH:/opt/homebrew/bin:$HOME/.npm-global/bin"   # gtimeout, codex
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../bin" && pwd)/boss-lib.sh"
verb="${1:?usage: codex.sh <dispatch|resume|alive|progress|collect> <pr#> [brief]}"
id="${2:?usage: codex.sh <verb> <pr#> [brief]}"

CODEX_TIMEOUT="${CODEX_TIMEOUT:-180m}"

# _thread_id <events-file> — the thread/session id codex reports in its first event.
# Feeds `resume`. Scans from the top: thread.started is emitted once, before any work.
_thread_id() {
  python3 - "$1" <<'TIDPY'
import json,sys
for line in open(sys.argv[1], errors="replace"):
    line=line.strip()
    if not line or not line.startswith("{"): continue
    try: d=json.loads(line)
    except Exception: continue
    if d.get("type")=="thread.started" and d.get("thread_id"):
        print(d["thread_id"]); break
TIDPY
}

# _resolve_thread_id <pr#> — the thread id for this crew, from the most durable source
# available, and PERSISTED on the meta once found.
#
# Reading it only out of `state/<pr>.out` is not enough: a resume that dies before it
# reaches the model (2026-08-25: `codex exec resume` rejecting `-C`) overwrites that
# file with a one-line clap error, and the id needed to retry is gone — the retry then
# reports "no thread_id, dispatch a fresh crew", which throws away the crew's context
# for what was a flag typo. Order: meta, then the live stream, then the newest archived
# stream (`<out>.r<n>`, written before each resume).
_resolve_thread_id() {
  local pid="$1" out tid arch
  tid=$(meta_get "$pid" thread_id 2>/dev/null) || tid=""
  if [ -z "$tid" ]; then
    out=$(meta_get "$pid" out 2>/dev/null) || out="$STATE_DIR/$pid.out"
    [ -f "$out" ] && tid=$(_thread_id "$out")
    if [ -z "$tid" ]; then
      # Newest archive first: the id is the same across the whole chain, but a
      # later archive is the one most likely to still exist.
      for arch in $(printf '%s\n' "$out".r* | sort -r); do
        [ -f "$arch" ] || continue
        tid=$(_thread_id "$arch"); [ -n "$tid" ] && break
      done
    fi
  fi
  [ -n "$tid" ] && meta_set "$pid" thread_id "$tid"
  printf '%s' "$tid"
}

# _summary <events-file> — "<state> <total_tokens>" from the JSONL stream.
# state: completed | failed | none (stream never reached a terminal turn event).
# A 0-token completion is the codex analogue of agy's 0-token SUCCESS envelope
# (LESSONS 2026-07-07): the CLI exited clean without ever reaching the model.
_summary() {
  python3 - "$1" <<'SUMPY'
import json,sys
state="none"; tokens=0
for line in open(sys.argv[1], errors="replace"):
    line=line.strip()
    if not line or not line.startswith("{"): continue
    try: d=json.loads(line)
    except Exception: continue
    t=d.get("type","")
    if t=="turn.completed":
        state="completed"
        u=d.get("usage") or {}
        tokens=sum(v for k,v in u.items() if isinstance(v,int))
    elif t in ("turn.failed","error"):
        state="failed"
print(state, tokens)
SUMPY
}

# _launch <worktree> <out> <rcfile> <lastmsg> <codex-exec-args...> — shared background
# launcher for dispatch and resume. Records pid/out/rc paths on the meta.
#
# Only the flags BOTH subcommands accept are appended here. `-C/--cd` is NOT one of
# them: `codex exec resume` rejects it outright (`error: unexpected argument '-C'`),
# so dispatch passes it in its own args and resume relies on the working root already
# recorded in the thread it is continuing, plus the subshell's cd.
_launch() {
  local worktree="$1" out="$2" rcf="$3" last="$4"; shift 4
  : > "$out"; rm -f "$rcf"
  ( cd "$worktree" || exit 1
    gtimeout -k 30 "$CODEX_TIMEOUT" codex exec "$@" \
      --json -o "$last" \
      --dangerously-bypass-approvals-and-sandbox < /dev/null
    echo "$?" > "$rcf"
  ) > "$out" 2>&1 &
  local pid=$!; disown "$pid" 2>/dev/null || true
  meta_set "$id" pid "$pid"; meta_set "$id" out "$out"
  meta_set "$id" rcfile "$rcf"; meta_set "$id" lastmsg "$last"
  meta_set "$id" dispatched_at "$(date +%s)"
}

case "$verb" in
  dispatch)
    brief="${3:?dispatch requires <brief-path>}"
    command -v codex >/dev/null || { echo "ERROR: codex not installed" >&2; exit 1; }
    command -v gtimeout >/dev/null || { echo "ERROR: gtimeout not installed (brew install coreutils)" >&2; exit 1; }
    worktree=$(meta_get "$id" worktree) || { echo "ERROR: no worktree for $id" >&2; exit 1; }
    # Persisted fix-up budget. A dispatch against a meta that already carries a pid
    # is a fix-up round by definition; refuse past BOSS_MAX_FIXUPS. Must run BEFORE
    # head_before/pid are overwritten below.
    boss_fixup_claim "$id" || exit 3
    model=$(meta_get "$id" model) || model=""
    [ -n "$model" ] || model="${CODEX_DEFAULT_MODEL:-gpt-5.6-sol}"
    meta_set "$id" head_before "$(git -C "$worktree" rev-parse HEAD 2>/dev/null || echo none)"
    # Clear any thread id a PREVIOUS crew on this PR recorded. A dispatch always
    # starts a NEW codex thread; leaving the old id on the meta would make a later
    # `resume` continue a dead crew's conversation instead of this one's. (The meta
    # is append-only and meta_get takes the last value, so a blank line clears it.)
    meta_set "$id" thread_id ""
    # Codex-specific addendum to boss's executor-agnostic brief. codex crews load
    # $CODEX_HOME/skills (the mirror of this repo's skills, see AGENTS.md), and some
    # of those skills are written for an INTERACTIVE session: on 2026-08-25 a smoke
    # run read `github-router`, decided the commit account was ambiguous, and spent
    # the whole dispatch waiting for an answer that can never arrive — a clean exit,
    # zero commits, and `collect` correctly calling it blocked. A backgrounded crew
    # has no one to ask, so say so.
    cbrief="$STATE_DIR/$id.codex.md"
    cat "$brief" > "$cbrief"
    cat >> "$cbrief" <<'CODEX'

## You are non-interactive

Nothing is reading your output while you work and no one can answer you. NEVER end
a turn with a question. If a skill or rule tells you to confirm something with a
human, that branch does not apply here — pick the option this worktree's existing
configuration already implies and note the choice in your final message.

Specifically: the git identity and remote for this worktree are ALREADY configured.
Use them as they are. Do not ask which account to commit as, and do not change
`user.name`, `user.email`, or any remote.
CODEX
    _launch "$worktree" "$STATE_DIR/$id.out" "$STATE_DIR/$id.rc" "$STATE_DIR/$id.last" \
      "$(cat "$cbrief")" -m "$model" -C "$worktree"
    ;;

  resume)
    # Continue a run that ran out of wall-clock (gtimeout, rc=124). Truncation is not
    # a failure of the plan or the crew, so it must NOT spend the fix-up round
    # reserved for real failures — it gets its own bounded budget, exactly like
    # claude-p's resume. Continuing the SAME codex thread is what makes this worth
    # having: boss holds no plan context by design, so a summary brief is the weakest
    # possible handoff and the model's own thread is the strongest.
    worktree=$(meta_get "$id" worktree) || { echo "ERROR: no worktree for $id" >&2; exit 1; }
    out=$(meta_get "$id" out) || out="$STATE_DIR/$id.out"
    [ -f "$out" ] && [ -s "$out" ] || { echo "ERROR: no previous output for $id — nothing to resume" >&2; exit 1; }
    # Refuse to fork a second crew onto one worktree.
    prev_pid=$(meta_get "$id" pid) || prev_pid=""
    if [ -n "$prev_pid" ] && kill -0 "$prev_pid" 2>/dev/null; then
      echo "REFUSED: PR $id still has a live crew (pid $prev_pid). Let it finish or kill it first." >&2
      exit 1
    fi
    tid=$(_resolve_thread_id "$id")
    [ -n "$tid" ] || { echo "ERROR: no thread_id on the meta, in $out, or in any $out.r* archive — cannot resume; dispatch a fresh crew" >&2; exit 1; }
    n=$(meta_get "$id" resumes) || n=""; case "$n" in ''|*[!0-9]*) n=0 ;; esac
    n=$(( n + 1 ))
    cap="${BOSS_MAX_RESUMES:-2}"
    if [ "$n" -gt "$cap" ]; then
      echo "REFUSED: PR $id has already used $(( n - 1 )) resume(s) (BOSS_MAX_RESUMES=$cap)." >&2
      echo "  A plan that cannot finish in $cap continuations is too big — split it, or raise the cap for one run." >&2
      exit 1
    fi
    # Keep the stream we just read the thread id out of. collect and the stall
    # detector both resolve `out` from the meta, so the canonical path keeps holding
    # the LATEST run while the chain stays inspectable.
    cp "$out" "$out.r$(( n - 1 ))" 2>/dev/null || true
    test_cmd=$(meta_get "$id" test_cmd) || test_cmd=""
    test_timeout=$(meta_get "$id" test_timeout) || test_timeout=600
    model=$(meta_get "$id" model) || model=""
    [ -n "$model" ] || model="${CODEX_DEFAULT_MODEL:-gpt-5.6-sol}"
    rbrief="$STATE_DIR/$id.resume.md"
    {
      echo "You ran out of wall-clock mid-task. This is the SAME thread, so you still have"
      echo "your full prior context. Continue exactly where you left off — do NOT start over"
      echo "and do NOT re-read the plan from the beginning."
      echo ""
      echo "- Commit your work on the current branch. Commit early and often."
      if [ -n "$test_cmd" ]; then
        echo "- Run the test_cmd ONLY wrapped in a timeout, so a hang fails fast:"
        echo "    gtimeout -k 30 ${test_timeout}s bash -c '<the test_cmd>'"
        echo "  The test_cmd is: $test_cmd"
        echo "  Make it pass. If it TIMES OUT your code is hanging — fix the hang, never"
        echo "  raise the timeout and never run test_cmd bare."
      fi
      echo "- Never run a command in the background. Foreground only."
      echo "- Do NOT push. Do NOT merge. Do NOT deploy."
      echo "- Finish with a final commit; the last thing you print is the test_cmd result."
    } > "$rbrief"
    # head_before is deliberately NOT rewritten. The question collect asks is whether
    # this PR produced work at all, and the honest baseline for that is the original
    # dispatch point — a continuation is the same task, not a new one.
    _launch "$worktree" "$out" "$STATE_DIR/$id.rc" "$STATE_DIR/$id.last" \
      resume "$tid" "$(cat "$rbrief")" -m "$model"
    meta_set "$id" resumes "$n"
    echo "codex: PR $id resumed thread $tid (round $n/$cap)" >&2
    ;;

  alive)
    pid=$(meta_get "$id" pid) || exit 2; [ -z "$pid" ] && exit 2
    kill -0 "$pid" 2>/dev/null && exit 0; exit 1 ;;

  progress)
    # Consumed by boss_stall_check. --json streams an event per model step, so the
    # events file grows continuously while the crew works — a direct activity signal
    # (agy needed an lsof on its CLI log because its envelope only lands at exit).
    out=$(meta_get "$id" out) || out="$STATE_DIR/$id.out"
    [ -f "$out" ] && wc -c < "$out" 2>/dev/null | tr -d ' '
    exit 0 ;;

  collect)
    out=$(meta_get "$id" out) || out="$STATE_DIR/$id.out"
    rcf=$(meta_get "$id" rcfile) || rcf="$STATE_DIR/$id.rc"
    [ -f "$out" ] && [ -s "$out" ] || { echo "dead no output"; exit 0; }
    # Pin the thread id onto the meta while the stream that carries it is still the
    # live one, so a later resume never depends on this file surviving.
    _resolve_thread_id "$id" >/dev/null
    rc=""; [ -f "$rcf" ] && rc=$(tr -d ' \n' < "$rcf")
    read -r state tokens <<<"$(_summary "$out")"

    # Judge by the TREE, not the envelope — the rule agy taught us (2026-08-02,
    # PR#141: a cosmetic terminal error after the work was committed). HEAD advanced
    # + clean worktree means the work landed however the CLI exited.
    wt=$(meta_get "$id" worktree) || wt=""
    dirty_n=0; [ -n "$wt" ] && dirty_n=$(git -C "$wt" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    salvage=""
    [ "${dirty_n:-0}" -gt 0 ] && salvage=" — WORK UNCOMMITTED in worktree ($dirty_n file(s)); salvage with a DIRECT executor fix-up, never boss-dispatch"

    advanced=1; boss_head_advanced "$id" || advanced=0

    if [ -z "$rc" ]; then
      # The subshell never wrote its exit code: killed, machine slept, or still
      # winding down. Fall back to the tree.
      if [ "$advanced" = "1" ] && [ "${dirty_n:-0}" -eq 0 ]; then
        echo "done codex exit code missing but HEAD advanced and the worktree is clean"
      else
        echo "dead codex exited without an exit code$salvage"
      fi
      exit 0
    fi

    case "$rc" in
      0)
        if [ "$state" = "none" ]; then
          echo "dead codex exited 0 without reaching a turn (no turn.completed in the stream)"
        elif [ "${tokens:-0}" -eq 0 ]; then
          # 0-token completion = the CLI never reached the model. Never a success.
          echo "dead codex completed with 0 tokens — the run never reached the model$salvage"
        elif [ "$advanced" = "1" ]; then
          echo "done codex completed, HEAD advanced"
        else
          echo "blocked codex reported success but HEAD did not advance (wrong-checkout? nothing committed?)$salvage"
        fi ;;
      124|137)
        # gtimeout fired ($CODEX_TIMEOUT, default 180m). Truncation, not failure:
        # continue the same thread with `codex.sh resume <pr#>` rather than
        # re-dispatching from scratch (same doctrine as claude-p's max-turns).
        if [ "$advanced" = "1" ] && [ "${dirty_n:-0}" -eq 0 ]; then
          echo "done codex hit its ${CODEX_TIMEOUT} timeout but HEAD advanced and the worktree is clean — verify the branch before re-running"
        else
          echo "truncated codex hit its ${CODEX_TIMEOUT} timeout — continue it with executors/codex.sh resume $id, never a fresh boss-dispatch$salvage"
        fi ;;
      *)
        if [ "$advanced" = "1" ] && [ "${dirty_n:-0}" -eq 0 ]; then
          echo "done codex exited $rc but HEAD advanced and the worktree is clean (cosmetic CLI fault — verify the branch, do not re-dispatch)"
        else
          echo "blocked codex exited $rc (turn state: $state)$salvage"
        fi ;;
    esac ;;

  *) echo "ERROR: unknown verb $verb" >&2; exit 2 ;;
esac
