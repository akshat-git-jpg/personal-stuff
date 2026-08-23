#!/usr/bin/env bash
set -euo pipefail

fail() { echo "FAIL: $*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PPWORK="$SCRIPT_DIR/pp-work"

run_guarded() {
  if command -v gtimeout >/dev/null; then
    gtimeout -k 10 30 "$@"
  else
    timeout -k 10 30 "$@"
  fi
}

SANDBOX=$(mktemp -d)
trap 'rm -rf "$SANDBOX"' EXIT

export HOME="$SANDBOX"

ORIGIN="$SANDBOX/origin.git"
run_guarded git init --bare -b main "$ORIGIN" >/dev/null
REPO="$SANDBOX/repo"
run_guarded git clone "$ORIGIN" "$REPO" >/dev/null
cd "$REPO"
run_guarded git checkout -b main >/dev/null 2>&1 || true
echo "initial" > file.txt
run_guarded git add file.txt
run_guarded git commit -m "init" >/dev/null
run_guarded git push -u origin main >/dev/null
MAIN_DIR="$PWD"

# mock wt
mkdir -p "$MAIN_DIR/tooling/cli/wt"
echo '#!/usr/bin/env bash' > "$MAIN_DIR/tooling/cli/wt/wt"
echo 'echo "wt status mockup"' >> "$MAIN_DIR/tooling/cli/wt/wt"
chmod +x "$MAIN_DIR/tooling/cli/wt/wt"

# 1. claim creates a worktree outside the main tree
out=$(run_guarded "$PPWORK" claim --kind subject --slug test1)
if [[ "$out" != "$HOME/kb-scratch/workspaces/"* ]]; then
  fail "claim did not create workspace in expected root. Output: $out"
fi
if [[ "$out" == "$MAIN_DIR/"* ]]; then
  fail "claim created workspace under main checkout"
fi
wt1="$out"

# 2. claim prints only the path on stdout
if ! cd "$wt1" 2>/dev/null; then
  fail "could not cd into output: $wt1"
fi
cd "$MAIN_DIR"

# 3. re-claiming the same slug re-attaches
echo "dirty" > "$wt1/dirty.txt"
touch "$wt1/render.mp4"
out2=$(run_guarded "$PPWORK" claim --kind subject --slug test1)
if [ "$out2" != "$wt1" ]; then
  fail "re-claim returned different path: $out2 vs $wt1"
fi
if [ ! -f "$wt1/dirty.txt" ] || [ ! -f "$wt1/render.mp4" ]; then
  fail "re-claim wiped existing files"
fi

# 4. a second live claim of the same subject slug FAILS
# This happens at the git level if the branch is checked out elsewhere.
run_guarded git checkout -b subject/test2 >/dev/null 2>&1
if run_guarded "$PPWORK" claim --kind subject --slug test2 >/dev/null 2>&1; then
  fail "claim succeeded even though branch subject/test2 is checked out elsewhere"
fi
run_guarded git checkout main >/dev/null 2>&1

# 5. remove refuses a dirty workspace
remove_exit=0
run_guarded "$PPWORK" remove "$wt1" >/dev/null 2>&1 || remove_exit=$?
if [ ! -d "$wt1" ]; then
  fail "remove DELETED a workspace holding uncommitted work"
fi
if [ "$remove_exit" -eq 0 ]; then
  fail "remove returned 0 on dirty workspace"
fi

# 6. remove refuses a clean-but-unmerged workspace
rm "$wt1/dirty.txt"
rm "$wt1/render.mp4"
( cd "$wt1" && echo "new" > new.txt && git add new.txt && git commit -m "new" >/dev/null )
if run_guarded "$PPWORK" remove "$wt1" >/dev/null 2>&1; then
  fail "remove succeeded on clean-but-unmerged workspace"
fi

# 7. remove succeeds when clean and merged
run_guarded git merge subject/test1 >/dev/null 2>&1
run_guarded git push origin main >/dev/null 2>&1
if ! run_guarded "$PPWORK" remove "$wt1" >/dev/null 2>&1; then
  fail "remove failed on clean and merged workspace"
fi
if [ -d "$wt1" ]; then
  fail "remove reported success but directory remains"
fi

# 8. an ignored render.mp4 alone blocks removal
( cd "$MAIN_DIR" && echo "*.mp4" > .gitignore && git add .gitignore && git commit -m "ignore mp4" >/dev/null && git push origin main >/dev/null )
out3=$(run_guarded "$PPWORK" claim --kind subject --slug test3)
wt3="$out3"
touch "$wt3/render.mp4"
remove_exit=0
run_guarded "$PPWORK" remove "$wt3" >/dev/null 2>&1 || remove_exit=$?
if [ ! -d "$wt3" ]; then
  fail "remove DELETED a workspace holding uncommitted work"
fi
if [ "$remove_exit" -eq 0 ]; then
  fail "remove returned 0 on workspace with ignored media"
fi

# 9. claim refuses a slug that would land under the main checkout or under WT_POOL
if run_guarded "$PPWORK" claim --kind subject --slug "../test" >/dev/null 2>&1; then
  fail "claim allowed .."
fi

# 10. list names the workspace and its uncommitted count
echo "uncommitted" > "$wt3/uncommitted.txt"
list_out=$("$PPWORK" list)
if ! echo "$list_out" | grep -q "test3 | kind:subject"; then
  fail "list did not name the workspace"
fi
if ! echo "$list_out" | grep -q "uncommitted:1"; then
  fail "list did not report correct uncommitted count"
fi

echo "ALL TESTS PASSED"
