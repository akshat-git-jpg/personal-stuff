#!/usr/bin/env bash
# Symlink this repo's own PATH-facing CLIs into ~/.local/bin. Idempotent —
# safe to run any time; run it alongside relink.sh as a first step on a new
# laptop after cloning, and re-run after moving/renaming the repo (the links
# store absolute paths, so a move leaves them stale until re-run).
#
# The repo root is resolved relative to this script, so it survives a repo
# rename/move.
#
# Scope: ONLY the CLIs in the list below — add a new repo CLI by appending one
# line. Nothing else in ~/.local/bin is ever touched (uv/pipx-managed tools,
# other symlinks). A real (non-symlink) file sitting at a managed name is
# warned about and left alone; the run then exits non-zero so it's visible.
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPTS_DIR/.." && pwd)"
BIN_DIR="$HOME/.local/bin"

# name -> repo-relative path. One CLI per line; only these names are managed.
CLIS=(
  "wt         tooling/cli/wt/wt"
  "yt-claude  tooling/cli/yt-claude/yt-claude"
)

mkdir -p "$BIN_DIR"

echo "repo: $REPO_ROOT"
echo "bin:  $BIN_DIR"
status=0
for entry in "${CLIS[@]}"; do
  read -r name rel <<<"$entry"
  target="$REPO_ROOT/$rel"
  link="$BIN_DIR/$name"

  if [[ ! -x "$target" ]]; then
    echo "WARN      $name: source missing or not executable: $target"
    status=1
    continue
  fi

  if [[ -L "$link" ]]; then
    current="$(readlink "$link")"
    if [[ "$current" == "$target" ]]; then
      echo "ok        $name -> $target"
    else
      ln -sfn "$target" "$link"
      echo "repaired  $name -> $target (was: $current)"
    fi
  elif [[ -e "$link" ]]; then
    echo "WARN      $name: real file at $link — refusing to clobber it"
    status=1
  else
    ln -s "$target" "$link"
    echo "linked    $name -> $target"
  fi
done

if [[ "$status" -eq 0 ]]; then
  echo "done. all CLIs linked."
else
  echo "done. WARNINGS above — fix by hand (this script never clobbers real files)."
fi
exit "$status"
