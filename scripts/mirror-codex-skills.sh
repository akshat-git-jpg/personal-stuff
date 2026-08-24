#!/usr/bin/env bash
# Rebuild .agents/skills/ — the Codex-facing view of this repo's skills.
#
# Codex scans .agents/skills/<name>/SKILL.md; Claude scans .claude/skills/.
# Rather than keep two copies, every entry here is a SYMLINK to the one real
# skill folder. So there is exactly one copy of each skill on disk and the two
# tools can never drift.
#
# Sources mirrored (both are repo-owned):
#   .claude/skills/<name>              -> ../../.claude/skills/<name>
#   .claude/skills/<name> (a symlink)  -> that symlink's own target, verbatim,
#                                         so pipelines/ skills resolve directly
#                                         instead of via a symlink chain.
#
# Idempotent, and it PRUNES: an entry in .agents/skills/ with no matching
# .claude/skills/ entry is removed, so a renamed or deleted skill does not linger
# for Codex.
#
# WINDOWS. Two things break the naive version, both already paid for once in this
# repo (decisions.md 2026-08-11):
#   1. Without admin/Developer Mode, MSYS `ln -s` on a directory silently makes
#      an NTFS junction, and `[ -L ]` does NOT recognize a junction. So `-L` alone
#      finds nothing to prune and pruning silently no-ops forever. Every check
#      below therefore falls back to "is it a dir containing SKILL.md".
#   2. `git clone` without core.symlinks writes each committed symlink as a plain
#      TEXT FILE holding its target path. Those are detected and reported, not
#      followed — see the degraded-source warning.
# Deletion uses `rmdir`, never `rm -rf`: rmdir removes a junction itself without
# following into its target, and fails safely on a real directory. `rm -rf` on a
# junction can delete the REAL skill folder it points at.
#
# Run standalone, or let scripts/relink.sh call it.
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPTS_DIR/.." && pwd)"
SRC="$REPO_ROOT/.claude/skills"
DST="$REPO_ROOT/.agents/skills"

[[ -d "$SRC" ]] || { echo "mirror-codex-skills: no $SRC — nothing to do."; exit 0; }
mkdir -p "$DST"

# A mirror entry counts as ours if it is a real symlink OR a junction/dir that
# holds a SKILL.md. Matches link_state() in scripts/skills-status.sh.
is_managed() {
  [[ -L "$1" ]] && return 0
  [[ -d "$1" && -f "$1/SKILL.md" ]] && return 0
  return 1
}

# Remove one mirror entry without ever following a junction into its target.
unlink_entry() {
  local path="$1" name="$2"
  if [[ -L "$path" ]]; then
    rm -f "$path"
  elif [[ -d "$path" ]]; then
    rmdir "$path" 2>/dev/null || {
      echo "  WARN refusing to remove non-empty real dir: $name" >&2
      return 1
    }
  else
    rm -f "$path"
  fi
}

linked=0 pruned=0 broken=0 degraded=0

for path in "$SRC"/*; do
  [[ -e "$path" || -L "$path" ]] || continue
  name="$(basename "$path")"

  if [[ -L "$path" ]]; then
    # Reuse the source symlink's target verbatim. .claude/skills and .agents/skills
    # sit at the same depth (repo_root/X/skills), so a ../../ relative target is
    # correct from either one.
    target="$(readlink "$path")"
  elif [[ -f "$path" ]]; then
    # A plain FILE here is never a real skill — it is a symlink that git degraded
    # on a clone without core.symlinks. Claude is broken here too, so say so.
    echo "  WARN $name is a degraded symlink (git clone without core.symlinks)." >&2
    echo "       Fix the clone, or run: git config core.symlinks true && git checkout -- ." >&2
    degraded=$((degraded + 1))
    continue
  else
    target="../../.claude/skills/$name"
  fi

  # A junction cannot be overwritten by ln -sfn, so clear a non-symlink first.
  if [[ -e "$DST/$name" || -L "$DST/$name" ]]; then
    [[ -L "$DST/$name" ]] || unlink_entry "$DST/$name" "$name" || continue
  fi
  ln -sfn "$target" "$DST/$name"
  linked=$((linked + 1))
  [[ -f "$DST/$name/SKILL.md" ]] || { echo "  WARN broken: $name -> $target" >&2; broken=$((broken + 1)); }
done

# Prune entries whose source skill is gone. Only managed entries are considered;
# .agents/hooks/ and friends live outside .agents/skills/ and are never touched.
for path in "$DST"/*; do
  [[ -e "$path" || -L "$path" ]] || continue
  is_managed "$path" || continue
  name="$(basename "$path")"
  if [[ ! -e "$SRC/$name" && ! -L "$SRC/$name" ]]; then
    unlink_entry "$path" "$name" && { echo "  pruned: $name"; pruned=$((pruned + 1)); }
  fi
done

echo "codex mirror: $linked linked, $pruned pruned, $broken broken, $degraded degraded"
[[ "$broken" -eq 0 && "$degraded" -eq 0 ]] || exit 1
