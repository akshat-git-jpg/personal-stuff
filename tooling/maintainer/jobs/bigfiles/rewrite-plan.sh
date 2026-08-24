#!/bin/bash
# Emit a REVIEWED history-rewrite plan. This script NEVER rewrites anything.
# It has no --apply, no --force, and no code path that calls git filter-repo.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"
cd "$REPO_ROOT" || die "cannot reach repo root"

out="$STATE_DIR/findings/$(today)-bigfiles-rewrite-plan.md"
mkdir -p "$(dirname "$out")"

{
  echo "# History rewrite plan — $(today)"
  echo
  echo "**Nothing here has been executed.** This is a proposal for the owner to review,"
  echo "then run BY HAND, once, with everything below settled first."
  echo
  echo "## Current cost"
  git count-objects -vH | "$GREP" size-pack
  git ls-tree -r -l HEAD | "$AWK" '{printf "HEAD: %.1f MB across %d files\n", s+=$4, NR}' | tail -1
  echo
  echo "## Candidate paths (biggest history-only blobs)"
  git rev-list --objects --all \
    | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
    | "$AWK" '$1=="blob"' | sort -k3 -n -r | head -30 \
    | "$AWK" '{printf "- %8.1f MB  %s\n", $3/1048576, $4}'
  echo
  echo "## The command (DO NOT RUN UNTIL THE CHECKLIST BELOW IS COMPLETE)"
  echo
  echo "    git filter-repo --invert-paths --path <path> [--path <path> ...]"
  echo
  echo
  echo "## Impact checklist — every box must be ticked first"
  echo
  echo "A rewrite changes EVERY commit SHA. That means:"
  echo
  echo "- [ ] **Every open boss PR is invalidated.** List them: \`gh pr list --state open\`."
  echo "      Each must be landed or closed and re-raised afterwards."
  echo "- [ ] **Every \`wt\` worktree lease is stale.** \`wt list\`; reap them all first."
  echo "- [ ] **Every \`pp-work\` workspace is stale.** \`pp-work list\`; all work landed first."
  echo "- [ ] **Every existing clone breaks**, including the VPS clone at"
  echo "      \`/srv/projects/personal-stuff/\` (VPS-CRONS.md). It must be re-cloned, or every"
  echo "      cron that pulls it starts failing."
  echo "- [ ] **personal-stuff is PUBLIC.** Any fork keeps the old history; the bytes are not"
  echo "      recalled by rewriting. If the goal is removing something sensitive, rewriting"
  echo "      alone does not achieve it."
  echo "- [ ] **A full backup clone exists** and has been verified restorable."
  echo "- [ ] **The owner has explicitly approved this specific path list.**"
  echo
  echo "If any box is unticked, do not run it. There is no partial version of this."
} > "$out"

echo "rewrite plan written -> $out"
echo "NOTHING was rewritten. Read the impact checklist before acting."
