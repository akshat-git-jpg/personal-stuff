#!/usr/bin/env bash
# Read-only skill symlink status script.
# Prints a markdown table of account membership, link health, and source.

set -uo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STORE="$(cd "$SCRIPTS_DIR/../tooling/claude-skills" && pwd)"
WORK_DIR="${CLAUDE_WORK_CONFIG_DIR:-$HOME/.claude-work}/skills"
PERS_DIR="${CLAUDE_PERSONAL_CONFIG_DIR:-$HOME/.claude-personal}/skills"
AGENTS_DIR="$HOME/.agents/skills"
MANIFEST_WORK="$STORE/manifest/work.txt"
MANIFEST_PERS="$STORE/manifest/personal.txt"

resolve_src() {
  local name="$1"
  if   [ -d "$STORE/$name" ];      then echo "$STORE/$name"
  elif [ -d "$AGENTS_DIR/$name" ]; then echo "$AGENTS_DIR/$name"
  else return 1; fi
}

is_managed() {
  local link="$1"
  local target
  target="$(readlink "$link" 2>/dev/null || echo "")"
  case "$target" in
    "$STORE"/*|"$AGENTS_DIR"/*) return 0 ;;
    *) return 1 ;;
  esac
}

in_manifest() {
  local name="$1"
  local manifest="$2"
  [ -f "$manifest" ] || return 1
  grep -v '^\s*#' "$manifest" | grep -qxF "$name"
}

ALL_SKILLS_RAW=""
if [ -f "$MANIFEST_WORK" ]; then
  ALL_SKILLS_RAW+=$(grep -v '^\s*#' "$MANIFEST_WORK" | grep -v '^\s*$')
  ALL_SKILLS_RAW+=$'\n'
fi
if [ -f "$MANIFEST_PERS" ]; then
  ALL_SKILLS_RAW+=$(grep -v '^\s*#' "$MANIFEST_PERS" | grep -v '^\s*$')
  ALL_SKILLS_RAW+=$'\n'
fi

declare -a SORTED_SKILLS
if [ -n "$ALL_SKILLS_RAW" ]; then
  IFS=$'\n'
  SORTED_SKILLS=($(echo "$ALL_SKILLS_RAW" | grep -v '^\s*$' | sort -u))
  unset IFS
fi

echo "| Skill | Accounts | Work link | Personal link | Source |"
echo "|---|---|---|---|---|"

count_both=0
count_work=0
count_pers=0
problems=0

for name in "${SORTED_SKILLS[@]:-}"; do
  has_w=0
  has_p=0
  if in_manifest "$name" "$MANIFEST_WORK"; then has_w=1; fi
  if in_manifest "$name" "$MANIFEST_PERS"; then has_p=1; fi
  
  if [ "$has_w" -eq 1 ] && [ "$has_p" -eq 1 ]; then
    acc="both"
    count_both=$((count_both + 1))
  elif [ "$has_w" -eq 1 ]; then
    acc="work"
    count_work=$((count_work + 1))
  else
    acc="personal"
    count_pers=$((count_pers + 1))
  fi

  src_txt="UNRESOLVED"
  if resolve_src "$name" >/dev/null; then
    src_path="$(resolve_src "$name")"
    if [[ "$src_path" == "$STORE/"* ]]; then src_txt="store"
    elif [[ "$src_path" == "$AGENTS_DIR/"* ]]; then src_txt="agents"
    fi
  else
    problems=$((problems + 1))
  fi

  w_link="-"
  if [ "$has_w" -eq 1 ]; then
    if [ ! -L "$WORK_DIR/$name" ]; then
      w_link="MISSING"
      problems=$((problems + 1))
    elif [ ! -e "$WORK_DIR/$name" ]; then
      w_link="DANGLING"
      problems=$((problems + 1))
    else
      w_link="ok"
    fi
  fi

  p_link="-"
  if [ "$has_p" -eq 1 ]; then
    if [ ! -L "$PERS_DIR/$name" ]; then
      p_link="MISSING"
      problems=$((problems + 1))
    elif [ ! -e "$PERS_DIR/$name" ]; then
      p_link="DANGLING"
      problems=$((problems + 1))
    else
      p_link="ok"
    fi
  fi

  echo "| $name | $acc | $w_link | $p_link | $src_txt |"
done

total=${#SORTED_SKILLS[@]}
echo ""
echo "$total skills — $count_both both / $count_work work-only / $count_pers personal-only; problems: $problems"

declare -a STRAYS

check_strays() {
  local dir="$1"
  local manifest="$2"
  [ -d "$dir" ] || return
  for e in "$dir"/*; do
    [ -e "$e" ] || [ -L "$e" ] || continue
    [ -L "$e" ] || continue
    local base="$(basename "$e")"
    
    if is_managed "$e"; then
      if ! in_manifest "$base" "$manifest"; then
        if [ ! -e "$e" ]; then
          STRAYS+=("$dir/$base (stray and dangling)")
        else
          STRAYS+=("$dir/$base (stray, not in manifest)")
        fi
        problems=$((problems + 1))
      else
        if [ ! -e "$e" ]; then
          STRAYS+=("$dir/$base (dangling)")
        fi
      fi
    fi
  done
}

check_strays "$WORK_DIR" "$MANIFEST_WORK"
check_strays "$PERS_DIR" "$MANIFEST_PERS"

if [ "${#STRAYS[@]}" -gt 0 ]; then
  echo ""
  echo "## Strays / dangling"
  for s in "${STRAYS[@]}"; do
    echo "- $s"
  done
fi

if [ "$problems" -gt 0 ]; then
  exit 1
fi
exit 0
