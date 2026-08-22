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

# ---------------------------------------------------------------------------
# Lease reaping (2026-08-22). A lease is only ever returned by an explicit
# `wt return`, so a holder that dies keeps its slot forever and the pool only
# shrinks — four of eight slots had leaked in the real pool, one for 25 days,
# because `wt get`'s only liveness test was "does the lease file exist".
#
# These pin the reap behaviour AND its one hard safety rule: a stale lease whose
# worktree still holds uncommitted work is never freed silently.
#
# Age is read from the lease file's mtime, so `touch -t` is how a lease is aged.
# ---------------------------------------------------------------------------
OLD_STAMP=202601010000   # older than any TTL used below

# 9. reap ignores a lease younger than the TTL
p9=$("$WT_BIN" get --repo "$TEST_REPO" --holder fresh9 2>/dev/null)
n9=$(basename "$(dirname "$p9")")
lease9="$pool_dir/$n9.lease"
out=$("$WT_BIN" reap --repo "$TEST_REPO" --yes 2>&1 || true)
[ -f "$lease9" ] || fail "reap freed a FRESH lease (slot $n9) — TTL not respected"
echo "$out" | grep -q "nothing to reap" || fail "reap on a fresh pool did not say 'nothing to reap'"

# 10. reap DRY RUN reports a stale lease but frees nothing
touch -t "$OLD_STAMP" "$lease9"
out=$("$WT_BIN" reap --repo "$TEST_REPO" 2>&1 || true)
echo "$out" | grep -q "Would reap slot $n9" || fail "reap dry-run did not report stale slot $n9"
[ -f "$lease9" ] || fail "reap dry-run FREED slot $n9 — a dry run must not mutate"

# 11. reap --yes frees a stale + clean lease
out=$("$WT_BIN" reap --repo "$TEST_REPO" --yes 2>&1 || true)
[ ! -f "$lease9" ] || fail "reap --yes did not free stale+clean slot $n9"
echo "$out" | grep -q "reaped slot $n9" || fail "reap --yes did not report reaping slot $n9"

# 12. reap --yes REFUSES a stale + DIRTY lease. This is the load-bearing rule:
#     a mid-flight kill routinely leaves a complete-but-uncommitted
#     implementation, and losing a slot is far cheaper than losing that work.
p12=$("$WT_BIN" get --repo "$TEST_REPO" --holder dirty12 2>/dev/null)
n12=$(basename "$(dirname "$p12")")
lease12="$pool_dir/$n12.lease"
printf 'precious uncommitted work\n' > "$p12/UNCOMMITTED.txt"
touch -t "$OLD_STAMP" "$lease12"
out=$("$WT_BIN" reap --repo "$TEST_REPO" --yes 2>&1 || true)
[ -f "$lease12" ] || fail "reap --yes FREED a stale+DIRTY slot $n12 — the work would be lost"
[ -f "$p12/UNCOMMITTED.txt" ] || fail "reap --yes DESTROYED uncommitted work in slot $n12"
echo "$out" | grep -q "STALE but DIRTY" || fail "reap --yes did not explain why slot $n12 was skipped"

# 13. --force-dirty is the explicit opt-in that does free it
"$WT_BIN" reap --repo "$TEST_REPO" --yes --force-dirty >/dev/null 2>&1 || true
[ ! -f "$lease12" ] || fail "reap --yes --force-dirty did not free stale+dirty slot $n12"

# 14. release --holder frees the named slot with no TTL wait, and refuses dirty
p14=$("$WT_BIN" get --repo "$TEST_REPO" --holder boss-999 2>/dev/null)
n14=$(basename "$(dirname "$p14")")
lease14="$pool_dir/$n14.lease"
printf 'wip\n' > "$p14/WIP.txt"
set +e
"$WT_BIN" release --repo "$TEST_REPO" --holder boss-999 >/dev/null 2>&1
rc=$?
set -e
[ "$rc" -ne 0 ] || fail "release freed a DIRTY slot without --force-dirty (exit 0)"
[ -f "$lease14" ] || fail "release FREED dirty slot $n14 without --force-dirty"
rm -f "$p14/WIP.txt"
"$WT_BIN" release --repo "$TEST_REPO" --holder boss-999 >/dev/null 2>&1 || fail "release failed on a clean slot"
[ ! -f "$lease14" ] || fail "release did not free clean slot $n14 for holder boss-999"

# 15. release with no --holder exits 2
set +e
"$WT_BIN" release --repo "$TEST_REPO" >/dev/null 2>&1
rc=$?
set -e
[ "$rc" -eq 2 ] || fail "release without --holder exited $rc, expected 2"

# 16. With the pool full, `get` reclaims a stale+clean lease instead of failing.
#     This is the net that stops one leak from permanently shrinking the pool.
for h in f1 f2 f3 f4 f5 f6 f7 f8; do
  "$WT_BIN" get --repo "$TEST_REPO" --holder "$h" >/dev/null 2>&1 || true
done
for i in 1 2 3 4 5 6 7 8; do
  if [ -f "$pool_dir/$i.lease" ]; then touch -t "$OLD_STAMP" "$pool_dir/$i.lease"; fi
done
set +e
p16=$("$WT_BIN" get --repo "$TEST_REPO" --holder needsaslot 2>/dev/null)
rc=$?
set -e
[ "$rc" -eq 0 ] || fail "get did not reclaim a stale lease when the pool was full (exit $rc)"
[ -d "$p16" ] || fail "get returned no usable worktree after reaping"

echo "ALL TESTS PASSED"
