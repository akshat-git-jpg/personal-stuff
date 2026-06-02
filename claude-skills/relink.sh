#!/usr/bin/env bash
# Recreate the per-account skill symlinks for both Claude accounts from the
# manifests. Idempotent — safe to run any time; run it after any membership
# change and as the first step on a new laptop after cloning.
#
#   manifest/work.txt     -> skills linked into ~/.claude-work/skills/
#   manifest/personal.txt -> skills linked into ~/.claude-personal/skills/
#   a name in both = shared; in one = exclusive to that account.
#
# Each skill's SOURCE is auto-resolved: the repo store if present, else
# ~/.agents/skills (printing-press pp-* skills). The manifest is the source of
# truth — a managed symlink (pointing into the store or ~/.agents/skills) that
# is NOT in that account's manifest gets PRUNED. Anything else is left alone.
set -euo pipefail

STORE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="${CLAUDE_WORK_CONFIG_DIR:-$HOME/.claude-work}/skills"
PERS_DIR="${CLAUDE_PERSONAL_CONFIG_DIR:-$HOME/.claude-personal}/skills"
AGENTS_DIR="$HOME/.agents/skills"   # printing-press-published pp-* skills

resolve_src() {                       # echo the source folder for a skill name
  local name="$1"
  if   [ -d "$STORE/$name" ];      then echo "$STORE/$name"
  elif [ -d "$AGENTS_DIR/$name" ]; then echo "$AGENTS_DIR/$name"
  else return 1; fi
}

is_managed() {                        # true if symlink target is under store or agents
  case "$(readlink "$1")" in "$STORE"/*|"$AGENTS_DIR"/*) return 0 ;; *) return 1 ;; esac
}

sync_account() {
  local account="$1" dir="$2" manifest="$3" n=0 pruned=0
  mkdir -p "$dir"
  # 1) link everything the manifest asks for
  while IFS= read -r name; do
    [ -z "$name" ] && continue
    case "$name" in \#*) continue ;; esac
    local src; if ! src="$(resolve_src "$name")"; then
      echo "  WARN [$account] '$name' has no source (store/agents) — skipping"; continue; fi
    rm -rf "$dir/$name"; ln -s "$src" "$dir/$name"; n=$((n+1))
  done < "$manifest"
  # 2) prune managed links no longer in the manifest
  for e in "$dir"/*; do
    [ -L "$e" ] && is_managed "$e" || continue
    local base; base="$(basename "$e")"
    grep -qxF "$base" "$manifest" || { rm -f "$e"; echo "  prune [$account] $base"; pruned=$((pruned+1)); }
  done
  echo "  $account: $n linked, $pruned pruned -> $dir"
}

echo "store:  $STORE"
echo "agents: $AGENTS_DIR"
sync_account work     "$WORK_DIR" "$STORE/manifest/work.txt"
sync_account personal "$PERS_DIR" "$STORE/manifest/personal.txt"
echo "done. Restart any running claude-work / claude-personal session to pick up changes."
