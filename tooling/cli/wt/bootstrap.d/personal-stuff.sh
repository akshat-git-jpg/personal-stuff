#!/bin/bash
# wt bootstrap for personal-stuff worktrees: link machine-local runtime files
# from the main checkout. Symlinks (not copies) so secrets have one home.
set -u
main="${WT_MAIN_CHECKOUT:?}"
link() {  # link <relpath>
  [ -e "$main/$1" ] || return 0
  mkdir -p "$(dirname "$1")"
  MSYS="winsymlinks:nativestrict" ln -sfn "$main/$1" "$1"
}
link pipelines/.env
link pipelines/credentials.json
link .mcp.json

# Every app's .dev.vars is machine-local and gitignored, so a leased worktree gets none of
# them and any suite needing one fails there while passing in the main checkout. The
# tracker's absence produced "gate unprovable", loginAs timeouts and blank "Not found"
# screenshots (recorded lesson tracker-e2e-needs-devvars). Loop rather than naming one:
# there are 8 today, and a new app must not have to remember to edit this hook.
for _dv in "$main"/apps/*/.dev.vars; do
  [ -e "$_dv" ] || continue
  link "apps/$(basename "$(dirname "$_dv")")/.dev.vars"
done
