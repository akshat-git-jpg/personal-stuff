#!/bin/bash
set -e

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

WT_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/wt"

TEST_REPO_BASE=$(mktemp -d)
trap 'rm -rf "$TEST_REPO_BASE"' EXIT
TEST_REPO="$TEST_REPO_BASE/personal-stuff"
mkdir -p "$TEST_REPO"

cd "$TEST_REPO"
git init >/dev/null 2>&1
git branch -m main >/dev/null 2>&1 || true
echo "hello" > README.md
echo "pipelines/" > .gitignore
echo ".mcp.json" >> .gitignore
git add README.md .gitignore
git commit -m "initial commit" >/dev/null 2>&1

mkdir -p pipelines
touch pipelines/.env

# 1. wt get prints exactly one line
output=$("$WT_BIN" get --repo "$TEST_REPO" --holder test1 2>/dev/null)
lines=$(echo "$output" | wc -l | tr -d ' ')
[ "$lines" -eq 1 ] || fail "wt get printed $lines lines, expected 1"
path1="$output"
[ -d "$path1" ] || fail "allocated path $path1 is not a directory"
basename1=$(basename "$path1")
repo_basename=$(basename "$TEST_REPO")
[ "$basename1" = "$repo_basename" ] || fail "allocated path does not end in repo basename"

# 2. Pool contains 1.lease with a holder= line
n_dir=$(dirname "$path1")
pool_dir=$(dirname "$n_dir")
lease1="$pool_dir/1.lease"
[ -f "$lease1" ] || fail "lease file 1.lease not found"
grep -q "^holder=test1" "$lease1" || fail "holder=test1 not in lease file"

# Prove bootstrap linking
[ -L "$path1/pipelines/.env" ] || fail "bootstrap linking failed"

# 3. A second wt get yields a DIFFERENT path
path2=$("$WT_BIN" get --repo "$TEST_REPO" --holder test2 2>/dev/null)
[ "$path1" != "$path2" ] || fail "second wt get returned same path"

# 4. wt return <path1> frees it: third wt get reuses path 1
"$WT_BIN" return "$path1" 2>/dev/null
path3=$("$WT_BIN" get --repo "$TEST_REPO" --holder test3 2>/dev/null)
[ "$path1" = "$path3" ] || fail "third wt get did not reuse path 1"

# 5. Reclaim unleased dirty slot
"$WT_BIN" return "$path1" 2>/dev/null
touch "$path1/junk"
echo "dirty change" >> "$path1/README.md"

# Run get and capture stderr
get_err=$(mktemp)
path4=$("$WT_BIN" get --repo "$TEST_REPO" --holder test4 2>"$get_err")
[ "$path1" = "$path4" ] || fail "dirty unleased path 1 was not reclaimed/reused, got $path4"
[ -z "$(git -C "$path1" status --porcelain --untracked-files=all 2>/dev/null)" ] || fail "reclaimed path 1 is still dirty"
grep -q "^holder=test4" "$pool_dir/1.lease" || fail "reclaimed path 1 not leased to test4"
grep -q "wt: reclaimed dirty orphaned slot $path1" "$get_err" || fail "reclaim log message not printed to stderr"
rm -f "$get_err"

# 6. Negative check: leased dirty slot is NOT reclaimed
# path2 (slot 2) is leased to test2. Let's make it dirty:
touch "$path2/leased_dirty_junk"
path5=$("$WT_BIN" get --repo "$TEST_REPO" --holder test5 2>/dev/null)
[ "$path2" != "$path5" ] || fail "leased dirty path 2 was incorrectly reclaimed"
[ "$path5" = "$pool_dir/3/$repo_basename" ] || fail "expected slot 3 for path5, got $path5"
[ -f "$path2/leased_dirty_junk" ] || fail "leased dirty slot 2 was modified/cleaned"

# 7. Status and prune behavior
# Currently:
# slot 1: leased to test4 (clean)
# slot 2: leased to test2 (dirty with leased_dirty_junk)
# slot 3: leased to test5 (clean)
#
# Let's free path5 (slot 3) and path4 (slot 1):
"$WT_BIN" return "$path5" 2>/dev/null
"$WT_BIN" return "$path4" 2>/dev/null
# Slot 3 is free and clean. Slot 1 is free and clean. Slot 2 is leased.
# Let's make slot 3 dirty:
touch "$path5/unleased_dirty_junk"
# Now: Slot 1 is free+clean, Slot 2 is leased, Slot 3 is unleased+dirty.

status_out=$("$WT_BIN" status --repo "$TEST_REPO" 2>/dev/null)
echo "$status_out" | grep -q "leased" || fail "status missing 'leased'"
echo "$status_out" | grep -q "dirty" || fail "status missing 'dirty'"

# Pruning checks:
# Only free+clean slots should be pruned.
# Slot 1 is free+clean, so it should be pruned.
# Slot 3 is unleased+dirty, so it should NOT be pruned.
# Slot 2 is leased, so it should NOT be pruned.
"$WT_BIN" prune --repo "$TEST_REPO" --yes 2>/dev/null
[ ! -d "$pool_dir/1" ] || fail "prune --yes did not delete free+clean slot 1"
[ -d "$pool_dir/2" ] || fail "prune --yes deleted leased slot 2"
[ -d "$pool_dir/3" ] || fail "prune --yes deleted dirty slot 3"

# 8. Unknown command exits 2
set +e
"$WT_BIN" fakecmd --repo "$TEST_REPO" 2>/dev/null
exit_code=$?
set -e
[ "$exit_code" -eq 2 ] || fail "unknown command exited with $exit_code, expected 2"

echo "ALL TESTS PASSED"
