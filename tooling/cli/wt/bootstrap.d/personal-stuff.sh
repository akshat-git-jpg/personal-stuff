#!/bin/bash
# wt bootstrap for personal-stuff worktrees: link machine-local runtime files
# from the main checkout. Symlinks (not copies) so secrets have one home.
set -u
main="${WT_MAIN_CHECKOUT:?}"
link() {  # link <relpath>
  [ -e "$main/$1" ] || return 0
  mkdir -p "$(dirname "$1")"
  ln -sfn "$main/$1" "$1"
}
link pipelines/.env
link pipelines/credentials.json
link .mcp.json
