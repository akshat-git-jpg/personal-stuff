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
# Idempotent, and it PRUNES: a symlink in .agents/skills/ with no matching
# .claude/skills/ entry is removed, so a renamed or deleted skill does not linger
# for Codex. Real directories and files in .agents/skills/ are never touched.
#
# Run standalone, or let scripts/relink.sh call it.
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPTS_DIR/.." && pwd)"
SRC="$REPO_ROOT/.claude/skills"
DST="$REPO_ROOT/.agents/skills"

[[ -d "$SRC" ]] || { echo "mirror-codex-skills: no $SRC — nothing to do."; exit 0; }
mkdir -p "$DST"

linked=0 pruned=0 broken=0

for path in "$SRC"/*; do
  [[ -e "$path" || -L "$path" ]] || continue
  name="$(basename "$path")"
  if [[ -L "$path" ]]; then
    # Reuse the source symlink's target verbatim. .claude/skills and .agents/skills
    # sit at the same depth (repo_root/X/skills), so a ../../ relative target is
    # correct from either one.
    target="$(readlink "$path")"
  else
    target="../../.claude/skills/$name"
  fi
  ln -sfn "$target" "$DST/$name"
  linked=$((linked + 1))
  [[ -f "$DST/$name/SKILL.md" ]] || { echo "  WARN broken: $name -> $target" >&2; broken=$((broken + 1)); }
done

# Prune managed symlinks whose source skill is gone. Only symlinks are considered
# managed; .agents/hooks/ and friends are real dirs and are left alone.
for path in "$DST"/*; do
  [[ -L "$path" ]] || continue
  name="$(basename "$path")"
  if [[ ! -e "$SRC/$name" && ! -L "$SRC/$name" ]]; then
    rm -f "$path"
    echo "  pruned: $name"
    pruned=$((pruned + 1))
  fi
done

echo "codex mirror: $linked linked, $pruned pruned, $broken broken"
[[ "$broken" -eq 0 ]] || exit 1
