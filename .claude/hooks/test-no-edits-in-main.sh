#!/usr/bin/env bash
# Behavioural harness for the write wall (.claude/hooks/no-edits-in-main.sh).
#
# Every case feeds the REAL hook REAL PreToolUse JSON on stdin and checks the REAL exit
# code. Nothing here inspects the hook's source text — a source-text assertion would pass
# for a hook that never runs.
#
# It builds throwaway repos in mktemp -d and plants a copy of the hook's own filename in
# them, because the wall identifies its repo by that marker rather than by a hardcoded
# path. A repo WITHOUT the marker stands in for some other repo, which must be untouched.
#
# Failures do NOT abort the run: every case is reported, then the script exits 1.
set -u

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
HOOK="$HOOK_DIR/no-edits-in-main.sh"
FAILS=0

[ -x "$HOOK" ] || { echo "FAIL: $HOOK is not executable"; exit 1; }

check() {  # check <label> <expected-exit> <cwd> <file_path>
  local label="$1" want="$2" cwd="$3" path="$4"
  local json out got
  json=$(printf '{"tool_name":"Edit","cwd":%s,"tool_input":{"file_path":%s}}' \
    "\"$cwd\"" "\"$path\"")
  out=$(printf '%s' "$json" | bash "$HOOK" 2>&1)
  got=$?
  if [ "$got" = "$want" ]; then
    printf '  ok   %s\n' "$label"
  else
    printf '  FAIL %s  (wanted exit %s, got %s)\n' "$label" "$want" "$got"
    printf '       %s\n' "$(printf '%s' "$out" | head -3 | tr '\n' ' ')"
    FAILS=$((FAILS + 1))
  fi
}

# ---------------------------------------------------------------- fixtures

MAIN="$(mktemp -d)/main"
mkdir -p "$MAIN"
git -C "$MAIN" init -q 2>/dev/null || { echo "FAIL: cannot init a test repo"; exit 1; }
git -C "$MAIN" config user.email t@t; git -C "$MAIN" config user.name t
mkdir -p "$MAIN/.claude/hooks" "$MAIN/tooling/cli/thing" "$MAIN/pipelines"
# the marker the wall self-identifies by
cp "$HOOK" "$MAIN/.claude/hooks/no-edits-in-main.sh"
printf 'tracked\n' > "$MAIN/tracked.md"
printf 'tracked deep\n' > "$MAIN/tooling/cli/thing/deep.py"
printf 'tracked deep\n' > "$MAIN/pipelines/nested.txt"
git -C "$MAIN" add -A >/dev/null 2>&1
git -C "$MAIN" commit -qm init >/dev/null 2>&1
printf 'scratch\n' > "$MAIN/scratch.md"          # left untracked on purpose

# a linked worktree of the same repo — a stand-in for a pp-work workspace
WT="$(dirname "$MAIN")/wt"
git -C "$MAIN" worktree add -q -b wtbranch "$WT" >/dev/null 2>&1

# a repo WITHOUT the marker — a stand-in for any other repo on the machine
OTHER="$(mktemp -d)/other"
mkdir -p "$OTHER"
git -C "$OTHER" init -q
git -C "$OTHER" config user.email t@t; git -C "$OTHER" config user.name t
printf 'x\n' > "$OTHER/tracked.md"
git -C "$OTHER" add -A >/dev/null 2>&1; git -C "$OTHER" commit -qm init >/dev/null 2>&1

# somewhere with no repo at all
BARE="$(mktemp -d)"
printf 'x\n' > "$BARE/loose.md"

echo "the main checkout is refused"
check "a tracked file at the top level"            2 "$MAIN" "$MAIN/tracked.md"
check "a tracked file deep in tooling/"            2 "$MAIN" "$MAIN/tooling/cli/thing/deep.py"
check "a tracked file in pipelines/"               2 "$MAIN" "$MAIN/pipelines/nested.txt"
check "a tracked file given as a relative path"    2 "$MAIN" "tracked.md"
check "a relative path from a subdirectory"        2 "$MAIN/tooling/cli/thing" "deep.py"
check "the wall's own settings file shape"         2 "$MAIN" "$MAIN/.claude/hooks/no-edits-in-main.sh"

echo
echo "what must stay allowed"
check "an untracked scratch file in main"          0 "$MAIN" "$MAIN/scratch.md"
check "a new file that does not exist yet"         0 "$MAIN" "$MAIN/brand-new.md"
check "a tracked file inside a linked worktree"    0 "$WT"   "$WT/tracked.md"
check "a tracked file in a repo without the marker" 0 "$OTHER" "$OTHER/tracked.md"
check "a file in no repo at all"                   0 "$BARE" "$BARE/loose.md"
check "no file_path in the payload"                0 "$MAIN" ""

echo
echo "the override is deliberate and expires"
touch "$MAIN/.claude/allow-main-edit"
check "a freshly touched sentinel allows the edit" 0 "$MAIN" "$MAIN/tracked.md"
# backdate it past the window
touch -t 202001010000 "$MAIN/.claude/allow-main-edit" 2>/dev/null || \
  touch -d "2020-01-01" "$MAIN/.claude/allow-main-edit" 2>/dev/null
check "a stale sentinel does not allow the edit"   2 "$MAIN" "$MAIN/tracked.md"
rm -f "$MAIN/.claude/allow-main-edit"
check "removing the sentinel re-arms the wall"     2 "$MAIN" "$MAIN/tracked.md"

echo
echo "it judges the path, not the tool name"
for tool in Write NotebookEdit Edit; do
  out=$(printf '{"tool_name":"%s","cwd":"%s","tool_input":{"file_path":"%s"}}' \
        "$tool" "$MAIN" "$MAIN/tracked.md" | bash "$HOOK" 2>&1)
  got=$?
  if [ "$got" = 2 ]; then
    printf '  ok   %s is refused in main\n' "$tool"
  else
    printf '  FAIL %s was allowed in main (exit %s)\n' "$tool" "$got"
    FAILS=$((FAILS + 1))
  fi
done

echo
echo "the refusal explains itself"
MSG=$(printf '{"tool_name":"Edit","cwd":"%s","tool_input":{"file_path":"%s"}}' \
      "$MAIN" "$MAIN/tracked.md" | bash "$HOOK" 2>&1)
for want in "BLOCKED" "pp-work claim" "tracked.md" "allow-main-edit"; do
  case "$MSG" in
    *"$want"*) printf '  ok   the message mentions %s\n' "$want" ;;
    *) printf '  FAIL the message never mentions %s\n' "$want"; FAILS=$((FAILS + 1)) ;;
  esac
done

# housekeeping
git -C "$MAIN" worktree remove --force "$WT" >/dev/null 2>&1 || true

echo
if [ "$FAILS" -gt 0 ]; then
  echo "FAILED: $FAILS"
  exit 1
fi
echo "all checks passed"
