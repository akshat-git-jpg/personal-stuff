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

# merge_to_main <branch> — land a workspace branch the way pp-land would, so a test can
# reach the clean-AND-merged state that removal requires.
merge_to_main() {
  ( cd "$MAIN_DIR" \
    && run_guarded git merge --no-edit "$1" >/dev/null 2>&1 \
    && run_guarded git push origin main >/dev/null 2>&1 )
}

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

# 7a. the IDLE gate. Clean and merged is NOT sufficient: a session commits many times
# into one workspace, so a just-used workspace keeps its folder. Removing it here is what
# would pull the cwd out from under a live session's shell.
merge_to_main subject/test1
err=$("$PPWORK" remove "$wt1" 2>&1 >/dev/null) && fail "remove deleted a clean, merged, JUST-USED workspace"
case "$err" in
  *PPWORK-ACTIVE*) : ;;
  *) fail "expected PPWORK-ACTIVE on a just-used workspace, got: $err" ;;
esac
[ -d "$wt1" ] || fail "remove deleted a just-used workspace despite refusing"

# 7b. once idle, the same removal succeeds
if ! run_guarded env PPWORK_GRACE_SECS=0 "$PPWORK" remove "$wt1" >/dev/null 2>&1; then
  fail "remove failed on a clean, merged and idle workspace"
fi
if [ -d "$wt1" ]; then
  fail "remove reported success but directory remains"
fi

# 7c. --now is the explicit override for a workspace that is NOT idle
out7=$(run_guarded "$PPWORK" claim --kind subject --slug test7)
( cd "$out7" && echo "seven" > seven.txt && git add seven.txt && git commit -m "seven" >/dev/null )
merge_to_main subject/test7
if ! run_guarded "$PPWORK" remove "$out7" --now >/dev/null 2>&1; then
  fail "--now did not override the idle gate"
fi
[ -d "$out7" ] && fail "--now reported success but directory remains"

# 8. an ignored render.mp4 alone blocks removal
( cd "$MAIN_DIR" && echo "*.mp4" > .gitignore && git add .gitignore && git commit -m "ignore mp4" >/dev/null && git push origin main >/dev/null )
out3=$(run_guarded "$PPWORK" claim --kind subject --slug test3)
wt3="$out3"
touch "$wt3/render.mp4"
remove_exit=0
run_guarded env PPWORK_GRACE_SECS=0 "$PPWORK" remove "$wt3" >/dev/null 2>&1 || remove_exit=$?
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

# -----------------------------------------------------------------------------
# 11. REGRESSION: a workspace with NO generated media must not hide the others.
#
# The media probe is `git ls-files ... | grep -Ei '\.(mp4|...)$' | ...` under
# `set -euo pipefail`. With no media, grep exits 1, pipefail propagates it, and the
# whole of `list` died mid-loop — silently reporting a subset of the workspaces and
# exiting 1. `list` is the only screen that shows blocked lands and disk use, so a
# partial list is worse than a crash.
#
# The fixture needs the no-media workspace to sort FIRST, so its failure would swallow
# a workspace that does exist. `aaa-` and `zzz-` pin the order.
# -----------------------------------------------------------------------------
out_a=$(run_guarded "$PPWORK" claim --kind code --slug aaa-nomedia)
out_z=$(run_guarded "$PPWORK" claim --kind code --slug zzz-media)
touch "$out_z/render.mp4"
[ -n "$(git -C "$out_a" ls-files --others --ignored --exclude-standard 2>/dev/null | grep -Ei '\.mp4$' || true)" ] \
  && fail "(11) fixture is vacuous — aaa-nomedia has media in it"

list_rc=0
list_out=$("$PPWORK" list 2>/dev/null) || list_rc=$?
[ "$list_rc" -eq 0 ] || fail "(11) list exited $list_rc — a media-free workspace still breaks it"
echo "$list_out" | grep -q "aaa-nomedia | kind:code" \
  || fail "(11) list omitted the media-free workspace"
echo "$list_out" | grep -q "zzz-media | kind:code" \
  || fail "(11) list omitted the workspace AFTER the media-free one — the loop died early"
echo "$list_out" | grep -q "test3 | kind:subject" \
  || fail "(11) list omitted test3"
echo "$list_out" | grep -q "aaa-nomedia .* media:no" \
  || fail "(11) the media-free workspace was not reported media:no"
echo "$list_out" | grep -q "zzz-media .* media:yes" \
  || fail "(11) the media-holding workspace was not reported media:yes"

# 12. reap keeps everything that is still in use, and reclaims only what is finished.
( cd "$out_a" && echo "a" > a.txt && git add a.txt && git commit -m "a" >/dev/null )
merge_to_main work/aaa-nomedia
( cd "$out_z" && echo "z" > z.txt && git add z.txt && git commit -m "z" >/dev/null )
merge_to_main work/zzz-media

# 12a. inside the grace window, reap takes nothing at all
reap_out=$(run_guarded env PPWORK_GRACE_SECS=99999 "$PPWORK" reap 2>&1)
echo "$reap_out" | grep -q "reap done — 0 reclaimed" \
  || fail "(12a) reap reclaimed a workspace that is still in use: $reap_out"
echo "$reap_out" | grep -q "keep aaa-nomedia — in use" \
  || fail "(12a) reap did not report aaa-nomedia as in use: $reap_out"
[ -d "$out_a" ] || fail "(12a) reap deleted an in-use workspace"

# 12b. idle: the clean+merged one goes, the one holding renders stays
reap_out=$(run_guarded env PPWORK_GRACE_SECS=0 "$PPWORK" reap 2>&1)
echo "$reap_out" | grep -q "reaped aaa-nomedia" \
  || fail "(12b) reap did not reclaim a clean, merged, idle workspace: $reap_out"
[ -d "$out_a" ] && fail "(12b) reap reported success but aaa-nomedia remains"
echo "$reap_out" | grep -q "keep zzz-media — uncommitted work or generated media" \
  || fail "(12b) reap did not keep the workspace holding renders: $reap_out"
[ -d "$out_z" ] || fail "(12b) reap DELETED a workspace holding generated media"
[ -f "$out_z/render.mp4" ] || fail "(12b) reap destroyed a render"

# 13. touch makes a workspace count as in use again. `touched` is append-only (the
# meta_set convention), so the reader must take the LAST value — if it took the first,
# a touched workspace would still read as idle and be reclaimed under a live session.
out_t=$(run_guarded "$PPWORK" claim --kind code --slug touch-test)
( cd "$out_t" && echo "t" > t.txt && git add t.txt && git commit -m "t" >/dev/null )
merge_to_main work/touch-test
manifest="$(dirname "$out_t")/manifest"
python3 - "$manifest" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p).read()
# Backdate the original touched= line well past any grace window.
s = re.sub(r'^touched=\d+$', 'touched=1', s, flags=re.M)
open(p, 'w').write(s)
PY
grep -q '^touched=1$' "$manifest" || fail "(13) fixture is vacuous — backdating the manifest did not take"
reap_out=$(run_guarded env PPWORK_GRACE_SECS=3600 "$PPWORK" reap 2>&1)
echo "$reap_out" | grep -q "reaped touch-test" \
  || fail "(13) fixture is vacuous — a backdated workspace was not reclaimable: $reap_out"

out_t=$(run_guarded "$PPWORK" claim --kind code --slug touch-test2)
( cd "$out_t" && echo "t2" > t2.txt && git add t2.txt && git commit -m "t2" >/dev/null )
merge_to_main work/touch-test2
manifest="$(dirname "$out_t")/manifest"
python3 - "$manifest" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p).read()
s = re.sub(r'^touched=\d+$', 'touched=1', s, flags=re.M)
open(p, 'w').write(s)
PY
run_guarded "$PPWORK" touch "$out_t"
[ "$(grep -c '^touched=' "$manifest")" -ge 2 ] \
  || fail "(13) touch did not append a second touched= line"
reap_out=$(run_guarded env PPWORK_GRACE_SECS=3600 "$PPWORK" reap 2>&1)
echo "$reap_out" | grep -q "keep touch-test2 — in use" \
  || fail "(13) a touched workspace was not read as in use — the reader is not taking the last value: $reap_out"
[ -d "$out_t" ] || fail "(13) reap deleted a freshly touched workspace"

# -----------------------------------------------------------------------------
# 14. A workspace that cannot be inspected at all must not hide the ones after it, and
# must not print a row of blank fields either. This is the guarantee that matters: `list`
# is the only screen showing disk use and blocked lands, so a SUBSET is the worst possible
# outcome -- it reads as "these are all my workspaces".
#
# A linked worktree keeps a `.git` FILE pointing at its gitdir. Renaming it aside makes
# every git call in the row body fail, which is a harsher fixture than the original bug.
# -----------------------------------------------------------------------------
rename_path() { python3 -c 'import os,sys; os.rename(sys.argv[1], sys.argv[2])' "$1" "$2"; }

out_b=$(run_guarded "$PPWORK" claim --kind code --slug aab-broken)
run_guarded "$PPWORK" claim --kind code --slug zzy-after-broken >/dev/null
rename_path "$out_b/.git" "$out_b/.git-disabled"
git -C "$out_b" status >/dev/null 2>&1 \
  && fail "(14) fixture is vacuous — the workspace is still a working git repo"

list_rc=0
list_out=$("$PPWORK" list 2>/dev/null) || list_rc=$?
[ "$list_rc" -eq 0 ] || fail "(14) list exited $list_rc — one broken workspace still breaks it"
echo "$list_out" | grep -q "aab-broken" \
  || fail "(14) list dropped the broken workspace entirely instead of flagging it"
echo "$list_out" | grep -q "zzy-after-broken | kind:code" \
  || fail "(14) list omitted the workspace AFTER the broken one — the loop died early"
echo "$list_out" | grep -q "zzz-media" \
  || fail "(14) list omitted zzz-media"

# No blank fields: every fallible field carries an explicit fallback, so the row is either
# an honest UNREADABLE marker or a row containing '?' / 'unknown'.
broken_row=$(echo "$list_out" | grep "aab-broken" | head -1)
case "$broken_row" in
  *UNREADABLE*|*unknown*|*'?'*) : ;;
  *) fail "(14) the broken workspace printed no marker and no fallback: $broken_row" ;;
esac
if echo "$broken_row" | grep -qE '\|[[:space:]]*(branch|ahead|uncommitted|size):[[:space:]]*\|'; then
  fail "(14) the broken workspace printed a BLANK field: $broken_row"
fi
rename_path "$out_b/.git-disabled" "$out_b/.git"

# -----------------------------------------------------------------------------
# 15. A REBASED land still counts as merged.
#
# pp-land lands through greenlight, which rebases the branch onto main, so the commits
# that reach main carry new SHAs. `merge-base --is-ancestor` then says "not merged" for a
# branch whose every line IS on main. With that as the gate, no workspace that landed
# after main had moved could ever be removed -- they would accumulate forever while reap
# reported "not merged" on each pass. Measured on two live workspaces on 2026-08-23.
# -----------------------------------------------------------------------------
out_r=$(run_guarded "$PPWORK" claim --kind code --slug rebased-land)
( cd "$out_r" && echo "mine" > mine.txt && git add mine.txt && git commit -m "mine" >/dev/null )
r_sha=$(git -C "$out_r" rev-parse HEAD)

# main moves on independently, so the land below cannot be a fast-forward.
( cd "$MAIN_DIR" && echo "theirs" > theirs.txt && git add theirs.txt \
  && git commit -m "theirs" >/dev/null && git push origin main >/dev/null 2>&1 )
# The land itself: the same change, replayed onto main under a NEW sha.
( cd "$MAIN_DIR" && git cherry-pick "$r_sha" >/dev/null 2>&1 && git push origin main >/dev/null 2>&1 ) \
  || fail "(15) fixture setup failed — could not replay the commit onto main"

git -C "$MAIN_DIR" merge-base --is-ancestor work/rebased-land origin/main 2>/dev/null \
  && fail "(15) fixture is vacuous — the branch IS an ancestor, so the old gate would have passed anyway"
[ "$(git -C "$MAIN_DIR" cherry origin/main work/rebased-land | grep -c '^+' || true)" -eq 0 ] \
  || fail "(15) fixture is wrong — the commit is not actually applied on main"

list_out=$("$PPWORK" list 2>/dev/null) || fail "(15) list failed"
echo "$list_out" | grep -q "rebased-land .* unlanded:0" \
  || fail "(15) list still counts a rebased-and-landed commit as pending: $(echo "$list_out" | grep rebased-land | head -1)"

if ! run_guarded env PPWORK_GRACE_SECS=0 "$PPWORK" remove "$out_r" >/dev/null 2>&1; then
  fail "(15) remove refused a workspace whose work is fully on main via a rebased land"
fi
[ -d "$out_r" ] && fail "(15) remove reported success but the directory remains"

# -----------------------------------------------------------------------------
# 16. BRANCH-MISMATCH: a workspace whose HEAD left its manifest branch.
#
# The wall only blocks checkout/switch in the MAIN checkout, so a session inside a workspace
# can freely retarget its branch. When it does, `post-commit` stops firing the lander (it
# only fires for work/*|subject/*), so every commit there is unlanded — and ws_is_merged then
# refuses to reclaim the workspace forever. Measured 2026-08-23: `script-desk-plans` sat on
# `boss/235-…` with one commit and no land.log entry at all.
# -----------------------------------------------------------------------------
out_m=$(run_guarded "$PPWORK" claim --kind code --slug mismatch-test)
( cd "$out_m" && git checkout -q -b boss/999-elsewhere \
  && echo m > m.txt && git add m.txt && git commit -qm "on the wrong branch" ) >/dev/null 2>&1

list_out=$("$PPWORK" list 2>/dev/null) || fail "(16) list failed on a mismatched workspace"
echo "$list_out" | grep -q "mismatch-test .* BRANCH-MISMATCH manifest:work/mismatch-test" \
  || fail "(16) list did not flag the branch mismatch: $(echo "$list_out" | grep mismatch-test | head -1)"

reap_out=$(run_guarded env PPWORK_GRACE_SECS=0 "$PPWORK" reap 2>&1)
echo "$reap_out" | grep -q "keep mismatch-test — BRANCH-MISMATCH" \
  || fail "(16) reap did not refuse the mismatched workspace by name: $reap_out"
[ -d "$out_m" ] || fail "(16) reap DELETED a workspace whose commits can never land"

# 17. --dirty prints only rows that need a human, and never hides one that does.
dirty_out=$("$PPWORK" list --dirty 2>/dev/null) || fail "(17) list --dirty failed"
echo "$dirty_out" | grep -q "mismatch-test" \
  || fail "(17) --dirty omitted a BRANCH-MISMATCH workspace"
# test3 carries an uncommitted file (case 10), so it must appear too.
echo "$dirty_out" | grep -q "test3" \
  || fail "(17) --dirty omitted a workspace with uncommitted work"
# zzz-media was left clean and landed by case 12b, so it must NOT appear.
if echo "$dirty_out" | grep -q "zzz-media"; then
  fail "(17) --dirty listed a clean, landed workspace: $dirty_out"
fi

# -----------------------------------------------------------------------------
# 18. snapshot: captures UNTRACKED files, and disturbs nothing.
#
# The first implementation used `stash create`, which records tracked modifications only —
# it silently omitted two brand-new files, which is the single most likely thing to lose.
# It must also leave the tree, the index, the stash stack and HEAD exactly as they were: a
# rescue that interferes with a live session is worse than no rescue.
# -----------------------------------------------------------------------------
out_s=$(run_guarded "$PPWORK" claim --kind code --slug snap-test)
printf 'tracked change\n' >> "$out_s/file.txt"
printf 'brand new\n' > "$out_s/never-added.txt"
mkdir -p "$out_s/junk" && printf 'x\n' > "$out_s/render.mp4"

s_head_before=$(git -C "$out_s" rev-parse HEAD)
s_dirty_before=$(git -C "$out_s" status --porcelain | grep -c . || true)
s_stash_before=$(git -C "$out_s" stash list | grep -c . || true)
s_staged_before=$(git -C "$out_s" diff --cached --name-only | grep -c . || true)

run_guarded "$PPWORK" snapshot "$out_s" >/dev/null 2>&1 \
  || fail "(18) snapshot failed on a dirty workspace"

s_ref=$(git -C "$MAIN_DIR" for-each-ref --format='%(refname)' refs/pp-work/snap/snap-test/ | tail -1)
[ -n "$s_ref" ] || fail "(18) snapshot wrote no ref under refs/pp-work/snap/snap-test/"

s_files=$(git -C "$out_s" diff --name-only HEAD "$s_ref")
echo "$s_files" | grep -qx 'file.txt' \
  || fail "(18) the snapshot missed the modified TRACKED file"
echo "$s_files" | grep -qx 'never-added.txt' \
  || fail "(18) the snapshot missed the UNTRACKED new file — this is the stash-create bug"
if echo "$s_files" | grep -q 'render.mp4'; then
  fail "(18) the snapshot captured gitignored media"
fi

[ "$(git -C "$out_s" rev-parse HEAD)" = "$s_head_before" ] \
  || fail "(18) snapshot moved HEAD"
[ "$(git -C "$out_s" status --porcelain | grep -c . || true)" = "$s_dirty_before" ] \
  || fail "(18) snapshot changed the working tree"
[ "$(git -C "$out_s" stash list | grep -c . || true)" = "$s_stash_before" ] \
  || fail "(18) snapshot pushed onto the stash stack"
[ "$(git -C "$out_s" diff --cached --name-only | grep -c . || true)" = "$s_staged_before" ] \
  || fail "(18) snapshot wrote to the real index"

# a clean workspace yields nothing rather than an empty snapshot
out_c=$(run_guarded "$PPWORK" claim --kind code --slug snap-clean)
clean_out=$(run_guarded "$PPWORK" snapshot "$out_c" 2>&1 || true)
echo "$clean_out" | grep -q "nothing to snapshot" \
  || fail "(18) snapshot did not skip a clean workspace: $clean_out"
[ -z "$(git -C "$MAIN_DIR" for-each-ref --format='%(refname)' refs/pp-work/snap/snap-clean/)" ] \
  || fail "(18) snapshot wrote a ref for a clean workspace"

# list reports the count
list_out=$("$PPWORK" list 2>/dev/null) || fail "(18) list failed after a snapshot"
echo "$list_out" | grep -q "snap-test .* snaps:1" \
  || fail "(18) list did not report snaps:1: $(echo "$list_out" | grep snap-test | head -1)"

echo ""
echo "ALL TESTS PASSED"
