#!/usr/bin/env bash
# The wall: no RECORDING HISTORY in the main checkout of this repo.
#
# Why the commit and not the write: on 2026-08-22 a session ran `git add decisions.md` —
# one file, correctly scoped — and committed a concurrent session's unrelated 36-line
# edit, because the on-disk copy already contained it. Both sessions were entitled to
# edit that file, so guarding writes fixes nothing. Recording history is the chokepoint.
#
# Replaces branch-guard.sh, which (a) had `\s+[^-]` after the verb so ANY flag bypassed
# it, (b) covered only switch/checkout, and (c) fired only when another transcript had
# been touched in the last 5 minutes — probabilistic, on a deterministic invariant.
#
# Wired as a PreToolUse hook (matcher: Bash) in .claude/settings.json.
# Deliberate one-off override: prefix the command with GUARD_OK=1.
set -u

INPUT="$(cat)"

json_field() {
  printf '%s' "$INPUT" | python3 -c "
import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
v = d
for k in sys.argv[1].split('.'):
    v = v.get(k, {}) if isinstance(v, dict) else {}
print(v if isinstance(v, str) else '')
" "$1" 2>/dev/null
}

CMD="$(json_field tool_input.command)"
CWD="$(json_field cwd)"
[ -n "$CMD" ] || exit 0

# --- cheapest test first: does this even look like a history-recording git verb? ---
# Allows any number of flags, including flag-with-value pairs like `-C <path>`, which is
# exactly what branch-guard.sh's `\s+[^-]` failed to handle.
VERBS='add|commit|stash|rebase|merge|switch|checkout|reset|cherry-pick|am|apply|revert|tag'
if ! printf '%s' "$CMD" | grep -qE "(^|[;&|(]|[[:space:]])(rtk[[:space:]]+)?git([[:space:]]+-{1,2}[^[:space:]]+([[:space:]]+[^-][^[:space:]]*)?)*[[:space:]]+($VERBS)([[:space:]]|$)"; then
  exit 0
fi

# `git checkout <ref> -- <path>` / `git checkout -- <path>` is a path restore, not history.
if printf '%s' "$CMD" | grep -qE 'git[[:space:]]+(switch|checkout)[[:space:]]+([^[:space:]]+[[:space:]]+)?--[[:space:]]'; then
  exit 0
fi

# Deliberate human override.
printf '%s' "$CMD" | grep -q 'GUARD_OK=1' && exit 0

# --- which directory will this git command ACTUALLY act on? ---
#
# The hook is handed the SESSION's cwd, but a command can retarget git elsewhere, and
# this repo's own workflow depends on two such forms:
#
#     cd <path> && git commit ...      <- the very form the message below recommends
#     git -C <path> commit ...
#
# Judging by the session cwd alone was wrong in BOTH directions. Measured 2026-08-23:
#
#   session in MAIN      `cd <workspace> && git commit`   -> BLOCKED  (should be allowed)
#   session in MAIN      `git -C <workspace> git commit`  -> BLOCKED  (should be allowed)
#   session in MAIN      `cd "$(pp-work claim ...)" && …` -> BLOCKED  (this hook's OWN advice)
#   session in WORKSPACE `git -C <main> git commit`       -> ALLOWED  (the wall, defeated)
#   session in WORKSPACE `cd <main> && git commit`        -> ALLOWED  (the wall, defeated)
#
# The false blocks forced three GUARD_OK=1 uses in one afternoon, in a repo whose
# change-control skill says that override has deliberately zero call sites. The false
# allows are worse: they are the exact thing the wall exists to stop.
#
# So resolve an EFFECTIVE directory and judge THAT. Fail CLOSED — anything not
# statically resolvable falls back to the session cwd, which is the stricter reading
# whenever the session sits in main.

count_matches() {  # count_matches <string> <ERE> — occurrences, not lines
  printf '%s' "$1" | grep -oE "$2" 2>/dev/null | wc -l | tr -d ' '
}

N_CD="$(count_matches "$CMD" '(^|[;&|]|&&)[[:space:]]*cd[[:space:]]')"
N_DASHC="$(count_matches "$CMD" 'git[[:space:]]+-C[[:space:]]')"

# `cd "$(pp-work claim ...)" && git commit` is what the message below tells you to run,
# and being a command substitution it can NEVER be resolved statically. It does not need
# to be: `pp-work claim` refuses to create a workspace under the main checkout, under the
# wt pool, or under the landing tree — three explicit `die` guards in
# tooling/cli/pp-work/pp-work — so its stdout is always a workspace path. Recognise
# exactly that substitution and nothing wider, and only when it is the single `cd`.
if [ "$N_CD" = "1" ] && [ "$N_DASHC" = "0" ] \
   && printf '%s' "$CMD" | grep -qE '^[[:space:]]*cd[[:space:]]+"?\$\([^)]*pp-work[[:space:]]+claim[[:space:]]'; then
  exit 0
fi

resolve_effective_dir() {  # resolve_effective_dir <cmd> <cwd>
  local cmd="$1" cwd="$2" raw out
  # Exactly one retargeting construct, of exactly one kind. Two `cd`s (or a `cd` plus a
  # `-C`) can disagree, so do not reason about them at all.
  if [ "$N_CD" = "1" ] && [ "$N_DASHC" = "0" ]; then
    # Only a LEADING cd is extracted; a `cd` buried mid-command yields nothing and
    # therefore falls back to the session cwd.
    raw=$(printf '%s' "$cmd" | sed -nE 's/^[[:space:]]*cd[[:space:]]+([^;&|]+).*/\1/p' | head -1)
  elif [ "$N_DASHC" = "1" ] && [ "$N_CD" = "0" ]; then
    raw=$(printf '%s' "$cmd" | sed -nE 's/.*git[[:space:]]+-C[[:space:]]+([^[:space:];&|]+).*/\1/p' | head -1)
  else
    printf '%s' "$cwd"; return 0
  fi

  raw="${raw%"${raw##*[![:space:]]}"}"      # strip trailing whitespace
  raw="${raw#\"}"; raw="${raw%\"}"          # strip one layer of quotes
  raw="${raw#\'}"; raw="${raw%\'}"

  # Anything the shell would still expand cannot be judged here.
  case "$raw" in
    ''|*'$'*|*'`'*|*'*'*|*'?'*) printf '%s' "$cwd"; return 0 ;;
  esac

  # Relative paths resolve against the session cwd. A path that does not exist resolves
  # to nothing and falls back — which is why `git -C /some/path commit` from main stays
  # blocked rather than sailing through on an unverifiable path.
  out=$(cd "$cwd" 2>/dev/null && cd "$raw" 2>/dev/null && pwd -P) || out=""
  [ -n "$out" ] || out="$cwd"
  printf '%s' "$out"
}

# --- is the EFFECTIVE directory the MAIN worktree of the repo that ships this wall? ---
[ -n "$CWD" ] || exit 0
EFFECTIVE="$(resolve_effective_dir "$CMD" "$CWD")"
[ -n "$EFFECTIVE" ] || EFFECTIVE="$CWD"
CWD="$EFFECTIVE"
git -C "$CWD" rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Absolute-path normalisation below is load-bearing. Raw rev-parse output is absolute
# for --git-dir but RELATIVE for --git-common-dir below the toplevel, so a raw
# comparison silently fails
# open in pipelines/, apps/, tooling/ — where sessions actually run.
read -r GD GCD < <(git -C "$CWD" rev-parse --path-format=absolute --git-dir --git-common-dir 2>/dev/null | tr '\n' ' ')
[ -n "${GD:-}" ] && [ -n "${GCD:-}" ] || exit 0
[ "$GD" = "$GCD" ] || exit 0          # a linked worktree — the whole point is that it is allowed

# Self-identifying repo test: the repo that ships this wall is the repo it applies to.
# No hardcoded path (branch-guard.sh's was this Mac's, and .claude/settings.json is
# tracked, so it shipped to the VPS and matched nothing) and no origin-URL coupling.
MAIN_TOP="$(dirname "$GCD")"
[ -f "$MAIN_TOP/.claude/hooks/no-history-in-main.sh" ] || exit 0

cat >&2 <<MSG
BLOCKED: recording git history in the main checkout.

Two sessions share this working tree, so a commit here can capture another session's
uncommitted edits — even a correctly-scoped one (2026-08-22).

Do this instead:
  cd "\$(pp-work claim --kind code --slug <short-task-name>)"
and run the same git command there. It lands on main by itself.

Either of these works in one command, from any directory:
  cd "\$(pp-work claim --kind code --slug <short-task-name>)" && <your git command>
  git -C <workspace-path> <your git command>

WRITE THE PATH LITERALLY. A path held in a variable is NOT resolved, so this is
refused even though it targets a workspace:
  WS=<workspace-path>; git -C "\$WS" commit ...
Any path containing \$, a backtick, * or ? cannot be judged without running the
shell, so it falls back to this directory and is treated as main. Paste the path.
(One exception, already handled: cd "\$(pp-work claim ...)" is recognised by shape.)

Deliberate one-off: GUARD_OK=1 <your command>
(Prefer the two forms above. This repo's change-control skill keeps GUARD_OK at zero
call sites on purpose, and the forms above exist so you never need it.)
MSG
exit 2
