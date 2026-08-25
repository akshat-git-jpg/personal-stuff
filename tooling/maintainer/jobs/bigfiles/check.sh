#!/bin/bash
# bigfiles — the mechanical half. Reports; deletes nothing, rewrites nothing.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
#
# BIGFILES_ROOT points at a fixture repo. BIGFILES_HISTORY=1 adds the slow scan.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

ROOT="${BIGFILES_ROOT:-$REPO_ROOT}"
MAXKB="${BIGFILES_MAX_KB:-4096}"          # pp-push refuses a single path over 4 MB
cd "$ROOT" || die "cannot reach $ROOT"
git rev-parse --git-dir >/dev/null 2>&1 || die "$ROOT is not a git repo"

found=0
note() { echo "- $1"; found=1; }
# Subshell loops below cannot set `found`; they append to this instead.
FOUND_FLAG="$(mktemp -t bigfiles-found)"
trap '/bin/rm -f "$FOUND_FLAG"' EXIT

echo "# bigfiles findings — $(today)"
echo

echo "## 1. sizes"
pack="$(git count-objects -vH | "$GREP" size-pack || true)"
head_size="$(git ls-tree -r -l HEAD | "$AWK" '{s+=$4} END {printf "%.1f MB across %d files", s/1048576, NR}')"
echo "- .git $pack"
echo "- tracked at HEAD: $head_size"
echo "- anything in the pack but not at HEAD is history-only. Deleting from HEAD does NOT"
echo "  shrink a clone; only a history rewrite does, and this job never performs one."
echo

echo "## 2. tracked files over ${MAXKB} KB"
# Both loops below are `| while`, i.e. subshells, so a plain `found=1` inside
# one is lost on the way out and the job reports "clean" while printing
# findings. They raise the flag through a file instead.
# Do NOT "simplify" either into $(...): a case pattern's unbalanced `)` closes
# the command substitution early and the script stops parsing.
git ls-tree -r -l HEAD | while read -r _ _ _ size path; do
  case "$size" in ''|*[!0-9]*) continue ;; esac
  if [ "$size" -gt $((MAXKB * 1024)) ]; then
    echo "- BIG-TRACKED $path ($((size / 1024)) KB)"
    echo x >> "$FOUND_FLAG"
  fi
done
[ -s "$FOUND_FLAG" ] && found=1
echo

echo "## 3. tracked media — A CANDIDATE LIST, NEVER A VERDICT"
echo "(the character registry, reference voices, vendor packs, app assets and the ui:true"
echo " screenshots are all committed ON PURPOSE. See runbook.md for the allowlist.)"
for e in png jpg jpeg mp4 mov wav mp3 pdf zip; do
  n=$(git ls-files "*.$e" | wc -l | tr -d ' ')
  [ "$n" != "0" ] && echo "- tracked .$e: $n"
done
echo

echo "## 4. untracked local junk (candidates for the archive, NOT for rm)"
git status --porcelain --ignored 2>/dev/null | "$AWK" '$1=="!!"{print $2}' | while read -r p; do
  [ -f "$p" ] || continue
  kb=$(( $("$STAT" -f %z "$p" 2>/dev/null || echo 0) / 1024 ))
  if [ "$kb" -gt "$MAXKB" ]; then
    echo "- LOCAL-JUNK $p (${kb} KB, gitignored)"
    echo x >> "$FOUND_FLAG"
  fi
done
[ -s "$FOUND_FLAG" ] && found=1
echo
echo "  A gitignored file has NO copy in git. Removing one is a MOVE to"
echo "  $ARCHIVE_ROOT/<date>-bigfiles/, never an rm."
echo

if [ "${BIGFILES_HISTORY:-0}" = "1" ]; then
  echo "## 5. biggest blobs in ALL history (slow — tens of seconds on a 610 MB pack)"
  git rev-list --objects --all \
    | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
    | "$AWK" '$1=="blob"' | sort -k3 -n -r | head -15 \
    | "$AWK" '{printf "- %8.1f MB  %s\n", $3/1048576, $4}'
else
  echo "## 5. history scan skipped (set BIGFILES_HISTORY=1 — it is slow)"
fi

exit $found
