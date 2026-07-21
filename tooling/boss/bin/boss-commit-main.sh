#!/bin/bash
# boss-commit-main.sh [commit-message]
#
# Commit + push the main checkout's uncommitted changes so greenlight can land.
#
# Why this exists: greenlight refuses to land onto a REPO_ROOT with ANY
# uncommitted TRACKED change (it never stashes/switches), so a dirty main
# silently parks EVERY merge as "main checkout busy" and swallows a whole
# dispatch batch. Historically boss just refused and made the owner clean up by
# hand every time. This lets boss clear it in one command.
#
# What it stages: `git add -A`, which honors .gitignore — so generated media
# (videos/*/screen.mp4, slices/, renders/, vo.mp3, …) stays untracked and out of
# the commit, while small tracked/source changes and referenced assets go in.
# That mirrors the repo's own convention (video working dirs track only the JSON
# cue artifacts, never the heavy media).
#
# Exit 0 = clean (nothing to do) or committed+pushed. Exit 1 = push failed.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/boss-lib.sh"

msg="${1:-}"

if [ -z "$(boss_repo_dirty)" ] && [ -z "$(git -C "$REPO_ROOT" status --porcelain)" ]; then
  echo "main checkout clean — nothing to commit"
  exit 0
fi

# Summarize what we're about to commit (respecting .gitignore, i.e. what actually
# gets staged) for the auto-message and the log.
staged_preview="$(git -C "$REPO_ROOT" add -A --dry-run | sed 's/^add //; s/^remove //' | tr -d "'" | head -6)"
nfiles="$(git -C "$REPO_ROOT" add -A --dry-run | wc -l | tr -d ' ')"

if [ -z "$msg" ]; then
  # Auto-message: name the top-level areas touched so the commit is legible.
  areas="$(git -C "$REPO_ROOT" add -A --dry-run \
    | sed "s/^add '//; s/^remove '//; s/'$//" \
    | awk -F/ 'NF>=2{print $1"/"$2} NF<2{print $1}' | sort -u | paste -sd, -)"
  msg="boss: commit dirty main to unblock land (${areas:-working tree})"
fi

echo "Committing $nfiles path(s) on main (gitignored media excluded):"
echo "$staged_preview" | sed 's/^/  /'
[ "$nfiles" -gt 6 ] && echo "  … and $((nfiles - 6)) more"

git -C "$REPO_ROOT" add -A
git -C "$REPO_ROOT" commit -q -m "$msg"
if git -C "$REPO_ROOT" push -q origin HEAD 2>&1; then
  echo "committed + pushed: $msg"
  boss_notify "boss: auto-committed dirty main to unblock land — $msg"
else
  echo "ERROR: commit succeeded but push failed — main is ahead of origin; resolve manually." >&2
  exit 1
fi
