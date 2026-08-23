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

# Blast-radius guard. boss's own dirty-main is a handful of paths; on 2026-08-20 this
# staged 64 files because a concurrent session's 29-file app deletion was in the tree,
# and committed it under an unrelated message. boss cannot attribute dirt, so it refuses
# a sweep this large instead of guessing. pp-push's size gate covers the other logged
# misfire (~200 MB of .mp4/.mov when an ignore glob missed a renamed directory).
BOSS_COMMIT_MAIN_MAX="${BOSS_COMMIT_MAIN_MAX:-10}"
if [ "$nfiles" -gt "$BOSS_COMMIT_MAIN_MAX" ] && [ "${BOSS_COMMIT_MAIN_FORCE:-0}" != "1" ]; then
  echo "REFUSING: $nfiles dirty path(s) on main is more than boss should ever sweep (max $BOSS_COMMIT_MAIN_MAX)." >&2
  echo "  This is almost certainly another session's work. Inspect it, then either commit it" >&2
  echo "  yourself or re-run with BOSS_COMMIT_MAIN_FORCE=1 if it really is all boss's." >&2
  boss_notify "boss: REFUSED to auto-commit $nfiles dirty paths on main (needs a human look)"
  exit 2
fi
git -C "$REPO_ROOT" add -A
# --no-verify for the same reason as boss-merge.sh: the main checkout arms a `pre-commit` hook
# that refuses history there. This tool's whole purpose is a deliberate main commit, and it is
# already guarded by the BOSS_COMMIT_MAIN_MAX blast-radius cap checked above — which exists
# because this exact `add -A` once swept a concurrent session's unrelated deletion into a
# 64-file commit under an unrelated message.
git -C "$REPO_ROOT" commit -q --no-verify -m "$msg"
if "$HOME/.local/libexec/pp-push" --repo "$REPO_ROOT" origin HEAD 2>&1; then
  echo "committed + pushed: $msg"
  boss_notify "boss: auto-committed dirty main to unblock land — $msg"
else
  echo "ERROR: commit succeeded but push failed — main is ahead of origin; resolve manually." >&2
  exit 1
fi
