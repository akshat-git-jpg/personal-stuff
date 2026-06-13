#!/usr/bin/env bash
# VPS-only sync: keep the VPS clone of personal-stuff current and rebuild the
# Claude Code skill symlinks for the single root account (~/.claude on the VPS,
# which runs the personal Claude Pro plan via Remote Control / Claude mobile).
#
# This is the VPS counterpart to relink.sh (which targets the Mac's two
# accounts). Here there is ONE account: ~/.claude. Idempotent — safe to run by
# hand or from cron. A cron runs it every 15 min so interactive Claude on the
# VPS always sees the latest pushed code + skills without a manual pull.
#
#   git pull   /srv/projects/personal-stuff
#   manifest/personal.txt -> ~/.claude/skills   (source: tooling/claude-skills, else ~/.agents/skills)
#
# The manifest is the source of truth: a managed symlink (into the store or
# ~/.agents/skills) that is no longer in the manifest gets pruned.
set -euo pipefail

REPO="${PERSONAL_STUFF_DIR:-/srv/projects/personal-stuff}"
STORE="$REPO/tooling/claude-skills"
SKILLS_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"
AGENTS_DIR="$HOME/.agents/skills"          # printing-press pp-* skills, if installed
MANIFEST="$STORE/manifest/personal.txt"

echo "repo:   $REPO"

# 1) pull latest code (soft-fail: keep working with the existing checkout)
if [ -d "$REPO/.git" ]; then
  if git -C "$REPO" pull --quiet; then echo "git pull: ok"; else echo "git pull: failed (network?); using existing checkout"; fi
else
  echo "FATAL: $REPO is not a git repo" >&2; exit 1
fi

[ -f "$MANIFEST" ] || { echo "FATAL: manifest not found at $MANIFEST" >&2; exit 1; }

resolve_src() {                            # echo the source folder for a skill name
  local name="$1"
  if   [ -d "$STORE/$name" ];      then echo "$STORE/$name"
  elif [ -d "$AGENTS_DIR/$name" ]; then echo "$AGENTS_DIR/$name"
  else return 1; fi
}
is_managed() {                             # true if symlink target is under store or agents
  case "$(readlink "$1")" in "$STORE"/*|"$AGENTS_DIR"/*) return 0 ;; *) return 1 ;; esac
}

mkdir -p "$SKILLS_DIR"
n=0; pruned=0; missing=0

# 2) link everything the personal manifest asks for
while IFS= read -r name; do
  [ -z "$name" ] && continue
  case "$name" in \#*) continue ;; esac
  if src="$(resolve_src "$name")"; then
    rm -rf "$SKILLS_DIR/$name"; ln -s "$src" "$SKILLS_DIR/$name"; n=$((n+1))
  else
    echo "  WARN '$name' has no source on this box (not in store or ~/.agents/skills) — skipping"; missing=$((missing+1))
  fi
done < "$MANIFEST"

# 3) prune managed links no longer in the manifest (also clears stale ones that
#    pointed at an old clone, since those are not under the current store)
for e in "$SKILLS_DIR"/*; do
  [ -e "$e" ] || [ -L "$e" ] || continue
  [ -L "$e" ] || continue
  base="$(basename "$e")"
  # drop links into a different store path, and managed links dropped from the manifest
  if is_managed "$e"; then
    grep -qxF "$base" "$MANIFEST" || { rm -f "$e"; echo "  prune $base"; pruned=$((pruned+1)); }
  elif [ ! -e "$e" ]; then
    rm -f "$e"; echo "  prune (dangling) $base"; pruned=$((pruned+1))
  fi
done

echo "skills: $n linked, $pruned pruned, $missing missing -> $SKILLS_DIR"
echo "done."
