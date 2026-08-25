#!/usr/bin/env bash
# Keep the handful of PERSON-level skills identical in this repo and in the private
# work-skills plugin.
#
# WHY TWO COPIES AT ALL. Skills are repo-scoped now, so a skill loads only where its
# files are. These five describe the operator rather than a project, so they are
# wanted in both places: here (public, personal-stuff work) and in the private
# work-skills plugin (loaded local-scope inside a ZluriHQ repo). A symlink cannot
# span the two: this repo is public and work-skills is private, so a link either way
# is dead for anyone else who clones it. Two real copies plus this script is the
# honest version of that trade.
#
# THIS REPO IS THE SOURCE. work-skills is always the copy. Edit here.
#
#   ./scripts/sync-shared-skills.sh           # copy here -> work-skills
#   ./scripts/sync-shared-skills.sh --check   # exit 1 if they differ, change nothing
#
# WORK_SKILLS_DIR overrides the default location.
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPTS_DIR/.." && pwd)"
SRC="$REPO_ROOT/.claude/skills"
DST="${WORK_SKILLS_DIR:-$HOME/codebase/work-skills}/skills"

SHARED=(claude-router github-router humanizer i-have-adhd session-handoff)

CHECK=0
[ "${1:-}" = "--check" ] && CHECK=1

if [ ! -d "$DST" ]; then
  # Not an error: a machine without the private plugin checked out is a normal
  # state (the VPS, a fresh clone). Nothing to sync, nothing to warn about.
  echo "sync-shared-skills: no work-skills checkout at $DST — skipping."
  exit 0
fi

drift=0
copied=0
for name in "${SHARED[@]}"; do
  s="$SRC/$name"
  d="$DST/$name"
  if [ ! -d "$s" ]; then
    echo "sync-shared-skills: MISSING source $s" >&2
    drift=1
    continue
  fi
  if [ -d "$d" ] && diff -rq "$s" "$d" >/dev/null 2>&1; then
    continue
  fi
  drift=1
  if [ "$CHECK" -eq 1 ]; then
    echo "  differs: $name"
    continue
  fi
  rm -rf "${d:?}"
  cp -R "$s" "$d"
  echo "  synced: $name"
  copied=$((copied + 1))
done

if [ "$CHECK" -eq 1 ]; then
  [ "$drift" -eq 0 ] && { echo "shared skills: in sync (${#SHARED[@]})"; exit 0; }
  echo "shared skills: OUT OF SYNC — run scripts/sync-shared-skills.sh" >&2
  exit 1
fi

echo "shared skills: $copied copied, ${#SHARED[@]} checked -> $DST"
