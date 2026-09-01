#!/bin/bash
# diskspace — act on ONE approved path. One path per invocation, on purpose:
# the blast radius of a wrong argument here is unrecoverable bytes, so there is
# no "reclaim everything" verb and there will not be one.
#
#   fix.sh <path>            # dry run — prints what it would do, touches nothing
#   fix.sh <path> --commit   # does it
#
# CACHE and REBUILD are deleted. DERIVED is MOVED to the archive. KEEP and
# UNCLASSIFIED are refused, whatever the caller passes.
set -uo pipefail
JOB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$(cd "$JOB_DIR/../../bin" && pwd)/lib.sh"
source "$JOB_DIR/classify.sh"

DU=/usr/bin/du
RM=/bin/rm
MV=/bin/mv

target="${1:-}"
mode="${2:-}"
[ -n "$target" ] || die "usage: fix.sh <path> [--commit]"

# Same knob as check.sh so the two always agree on what they are looking at,
# and so this can be pointed at a fixture. The guards below do the real work —
# a different root does not loosen check-ignore or the classifier.
ROOT="${DISKSPACE_ROOT:-$REPO_ROOT}"
cd "$ROOT" || die "cannot reach $ROOT"
[ -e "$target" ] || die "no such path: $target (under $ROOT)"

# The path must still be gitignored AT THE MOMENT OF ACTING. A .gitignore edit
# between the check and here would otherwise let this delete tracked work.
git check-ignore -q "$target" \
  || die "$target is NOT gitignored — refusing. This job only touches ignored paths."

cls="$(classify "$target")"
kb=$("$DU" -sk "$target" 2>/dev/null | "$AWK" '{print $1+0}')
size=$("$AWK" -v k="${kb:-0}" 'BEGIN{printf "%.0f MB", k/1024}')
dest=""

case "$cls" in
  CACHE|REBUILD)
    action="DELETE"
    ;;
  DERIVED)
    action="ARCHIVE"
    dest="$ARCHIVE_ROOT/$(today)-diskspace/$(dirname "$target")"
    ;;
  KEEP)
    die "$target is KEEP — owner-recorded source or a live secret. Refusing."
    ;;
  *)
    die "$target is UNCLASSIFIED. Teach classify() in classify.sh first; never act on a guess."
    ;;
esac

echo "path:   $target"
echo "class:  $cls"
echo "size:   $size"
echo "action: $action${dest:+ -> $dest}"
[ "$cls" = "REBUILD" ] && echo "back via: $(rebuild_cmd "$target")"

if [ "$mode" != "--commit" ]; then
  echo
  echo "DRY RUN. Nothing changed. Re-run with --commit to act."
  exit 0
fi

if [ "$action" = "ARCHIVE" ]; then
  mkdir -p "$dest" || die "cannot create $dest"
  "$MV" "$target" "$dest/" || die "move failed — nothing was deleted"
  echo "archived -> $dest/$(basename "$target")"
else
  "$RM" -rf -- "$target" || die "delete failed"
  echo "deleted."
fi

echo
echo "Append one line to $LEDGER: $(today) diskspace $action $size $target"
