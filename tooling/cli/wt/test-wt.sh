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
git commit --allow-empty -m "initial commit" >/dev/null 2>&1

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

# 5. Dirty parking
"$WT_BIN" return "$path1" 2>/dev/null
touch "$path1/junk"
path4=$("$WT_BIN" get --repo "$TEST_REPO" --holder test4 2>/dev/null)
[ "$path1" != "$path4" ] || fail "dirty path 1 was incorrectly reused"
[ "$path4" = "$pool_dir/3/$repo_basename" ] || fail "expected new number for path4, got $path4"

# 6. wt status output contains one leased and one dirty line
status_out=$("$WT_BIN" status --repo "$TEST_REPO" 2>/dev/null)
echo "$status_out" | grep -q "leased" || fail "status missing 'leased'"
echo "$status_out" | grep -q "dirty" || fail "status missing 'dirty'"

# 7. wt prune
"$WT_BIN" prune --repo "$TEST_REPO" 2>/dev/null
[ -d "$pool_dir/3" ] || fail "prune without --yes deleted leased worktree"
"$WT_BIN" prune --repo "$TEST_REPO" --yes 2>/dev/null
# wait, path1 was dirty, path2 was leased, path3 was returned then dirty, path4 was leased
# Let's clean up a path to make it free+clean
"$WT_BIN" return "$path4" 2>/dev/null
[ -d "$pool_dir/3" ] || fail "path4 deleted before prune"
"$WT_BIN" prune --repo "$TEST_REPO" --yes 2>/dev/null
[ ! -d "$pool_dir/3" ] || fail "prune --yes did not delete free+clean worktree"
[ -d "$pool_dir/2" ] || fail "prune --yes deleted leased worktree"
[ -d "$pool_dir/1" ] || fail "prune --yes deleted dirty worktree"

# 8. Unknown command exits 2
set +e
"$WT_BIN" fakecmd --repo "$TEST_REPO" 2>/dev/null
exit_code=$?
set -e
[ "$exit_code" -eq 2 ] || fail "unknown command exited with $exit_code, expected 2"

echo "ALL TESTS PASSED"
