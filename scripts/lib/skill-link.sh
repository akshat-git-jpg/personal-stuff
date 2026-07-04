#!/usr/bin/env bash
# Shared library for managing Claude Code skill symlinks.
# Sourced by relink.sh and vps-sync.sh.

sync_skills_dir() {
  local account="$1"
  local target_dir="$2"
  local manifest="$3"
  local store="$4"
  local agents_dir="$5"

  local n=0
  local pruned=0
  local unresolved_names=()

  mkdir -p "$target_dir"

  # Helper to resolve source path
  resolve_src() {
    local name="$1"
    if   [ -d "$store/$name" ];      then echo "$store/$name"
    elif [ -d "$agents_dir/$name" ]; then echo "$agents_dir/$name"
    else return 1; fi
  }

  # Helper to check if a link is managed under store or agents
  is_managed() {
    local link="$1"
    local target
    target="$(readlink "$link")"
    case "$target" in
      "$store"/*|"$agents_dir"/*) return 0 ;;
      *) return 1 ;;
    esac
  }

  # 1) link everything the manifest asks for
  while IFS= read -r name; do
    [ -z "$name" ] && continue
    case "$name" in \#*) continue ;; esac
    local src
    if src="$(resolve_src "$name")"; then
      rm -rf "$target_dir/$name"
      ln -s "$src" "$target_dir/$name"
      n=$((n+1))
    else
      echo "  WARN [$account] '$name' has no source (store/agents) — skipping"
      unresolved_names+=("$name")
    fi
  done < "$manifest"

  # 2) prune links
  for e in "$target_dir"/*; do
    [ -e "$e" ] || [ -L "$e" ] || continue
    [ -L "$e" ] || continue
    local base
    base="$(basename "$e")"

    local prune_it=0
    if is_managed "$e"; then
      if ! grep -qxF "$base" "$manifest"; then
        prune_it=1
      fi
    fi
    if [ ! -e "$e" ]; then
      prune_it=1
    fi

    if [ "$prune_it" -eq 1 ]; then
      rm -f "$e"
      echo "  prune [$account] $base"
      pruned=$((pruned+1))
    fi
  done

  echo "  $account: $n linked, $pruned pruned, ${#unresolved_names[@]} missing -> $target_dir"

  if [ "${#unresolved_names[@]}" -gt 0 ]; then
    echo "WARN: ${#unresolved_names[@]} manifest entries unresolved: ${unresolved_names[*]}"
    return 2
  fi
  return 0
}
