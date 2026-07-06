#!/bin/bash
# boss shared helpers. Source, don't execute.
set -uo pipefail
BOSS_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOSS_HOME="$(cd "$BOSS_BIN/.." && pwd)"
REPO_ROOT="$(cd "$BOSS_HOME/../.." && pwd)"   # tooling/boss -> repo root
STATE_DIR="$BOSS_HOME/state"; mkdir -p "$STATE_DIR"

meta_get()    { local f="$STATE_DIR/$1.meta"; [ -f "$f" ] || return 1; grep "^$2=" "$f" | tail -1 | cut -d= -f2-; }
meta_set()    { echo "$2=$3" >> "$STATE_DIR/$1.meta"; }

# YAML frontmatter reader: fm_get <key> <plan-file>  (first --- ... --- block)
fm_get() {
  awk -v k="$1" '
    /^---[[:space:]]*$/ { n++; next }
    n==1 && $0 ~ "^"k":" { sub("^"k":[[:space:]]*",""); gsub(/^"|"$/,""); print; exit }
  ' "$2"
}

slug_of()     { echo "${1#boss/}"; }
boss_notify() { "$REPO_ROOT/tooling/cli/notify/notify" send "$1" || true; }
boss_ensure_labels() {
  local l; for l in type:feature type:bug type:refactor type:chore \
                    boss:ready boss:in-progress boss:done boss:blocked; do
    gh label create "$l" >/dev/null 2>&1 || true
  done
}
