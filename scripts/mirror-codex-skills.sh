#!/usr/bin/env bash
# Publish this repo's skills to Codex by symlinking them into $CODEX_HOME/skills
# (default ~/.codex/skills).
#
# WHY THERE, and not .agents/skills/: Codex 0.149 discovers skills ONLY under
# $CODEX_HOME/skills and inside installed plugins. Its own help text says
# "Installs into `$CODEX_HOME/skills/<skill-name>` (defaults to ~/.codex/skills)".
# In this version `.agents/` is the PLUGIN root (~/.agents/plugins/marketplace.json)
# and `.agents/skills/` is read by nothing at all — an earlier mirror there was
# inert and was removed. See decisions.md 2026-08-24.
#
# Codex skills are NOT slash commands. They are injected as a name+description
# list the model reads via `skills.read`, so ask for one in plain language.
#
# $CODEX_HOME/skills is GLOBAL — these skills load in every project, not just
# this repo. That is the accepted trade-off for Codex having no per-repo skill
# path short of building a plugin.
#
# SAFETY. This writes into a shared directory that already holds skills owned by
# other tools (symlinks into ~/.claude-personal/skills and ~/.agents/skills, plus
# real installed directories). So:
#   * only entries that are symlinks RESOLVING INTO THIS REPO are ever touched;
#   * a name already taken by anything else is reported and skipped, never
#     overwritten;
#   * pruning removes a link only when its source skill is gone from this repo.
# Windows notes carried over from the previous script: MSYS `ln -s` makes an NTFS
# junction that `[ -L ]` cannot see, and `git clone` without core.symlinks writes
# committed symlinks as plain text files (decisions.md 2026-08-11).
#
# Run standalone, or let scripts/relink.sh call it.
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPTS_DIR/.." && pwd)"
MANIFEST="$REPO_ROOT/tooling/claude-skills/manifest/codex.txt"
STORE="$REPO_ROOT/tooling/claude-skills"
REPO_SKILLS="$REPO_ROOT/.claude/skills"
DST="${CODEX_HOME:-$HOME/.codex}/skills"

[[ -f "$MANIFEST" ]] || { echo "mirror-codex-skills: no $MANIFEST — nothing to do."; exit 0; }

# Codex has NO per-repo skill path, so everything mirrored here is GLOBAL in every
# Codex project. Only the thin always-on set is listed in codex.txt; repo-specific
# skills stay in .claude/skills and are surfaced to Codex through each repo AGENTS.md.
WANT=()
while IFS= read -r line; do
  line="${line%%#*}"; line="${line// /}"
  [[ -n "$line" ]] && WANT+=("$line")
done < "$MANIFEST"
mkdir -p "$DST"

# Is $1 a link this script owns? Only if it is a symlink AND resolves inside the repo.
# Anything else in $DST belongs to another tool and is off limits.
owned_by_repo() {
  local path="$1" real
  [[ -L "$path" ]] || return 1
  real="$(cd "$(dirname "$path")" && cd "$(dirname "$(readlink "$path")")" 2>/dev/null && pwd)" || return 1
  [[ "$real" == "$REPO_ROOT"/* ]]
}

linked=0 pruned=0 skipped=0 broken=0 degraded=0

for name in "${WANT[@]}"; do
  path="$STORE/$name"
  [[ -e "$path" || -L "$path" ]] || path="$REPO_SKILLS/$name"
  if [[ ! -e "$path" && ! -L "$path" ]]; then
    echo "  WARN $name listed in codex.txt but not found in the repo" >&2
    continue
  fi

  if [[ -L "$path" ]]; then
    target="$(cd "$(dirname "$path")" && cd "$(dirname "$(readlink "$path")")" && pwd)/$(basename "$(readlink "$path")")"
  elif [[ -f "$path" ]]; then
    echo "  WARN $name is a degraded symlink (git clone without core.symlinks)." >&2
    echo "       Fix with: git config core.symlinks true && git checkout -- ." >&2
    degraded=$((degraded + 1)); continue
  else
    target="$path"
  fi

  # Never clobber a name owned by another tool or a real installed skill.
  if [[ -e "$DST/$name" || -L "$DST/$name" ]] && ! owned_by_repo "$DST/$name"; then
    echo "  skip $name — already present in $DST and not owned by this repo" >&2
    skipped=$((skipped + 1)); continue
  fi

  ln -sfn "$target" "$DST/$name"
  linked=$((linked + 1))
  [[ -f "$DST/$name/SKILL.md" ]] || { echo "  WARN broken: $name -> $target" >&2; broken=$((broken + 1)); }
done

# Prune only OUR links whose source skill no longer exists.
for path in "$DST"/*; do
  [[ -L "$path" ]] || continue
  owned_by_repo "$path" || continue
  name="$(basename "$path")"
  if ! printf '%s\n' "${WANT[@]}" | grep -qx "$name" \
     || { [[ ! -e "$STORE/$name" && ! -L "$STORE/$name" ]] \
          && [[ ! -e "$REPO_SKILLS/$name" && ! -L "$REPO_SKILLS/$name" ]]; }; then
    rm -f "$path"; echo "  pruned: $name"; pruned=$((pruned + 1))
  fi
done

echo "codex skills: $linked linked, $pruned pruned, $skipped skipped, $broken broken, $degraded degraded -> $DST"
[[ "$broken" -eq 0 && "$degraded" -eq 0 ]] || exit 1
