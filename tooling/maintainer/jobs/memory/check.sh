#!/bin/bash
# memory — the mechanical half. Reports; never writes to a store.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
#
# MEMORY_ROOTS lets the test point this at a fixture instead of the real stores.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

ROOTS="${MEMORY_ROOTS:-$HOME/.claude-work $HOME/.claude-personal}"
AGE_DAYS="${MEMORY_AGE_DAYS:-30}"

found=0
note() { echo "- $1"; found=1; }

echo "# memory findings — $(today)"
echo

stores="$("$FIND" $ROOTS -maxdepth 4 -type d -name memory 2>/dev/null | sort)"
if [ -z "$stores" ]; then
  echo "no memory stores found under: $ROOTS"
  exit 0
fi

echo "## 1. index sync — every note indexed, every pointer resolving"
for d in $stores; do
  [ -f "$d/MEMORY.md" ] || { note "no MEMORY.md in $d"; continue; }
  for f in "$d"/*.md; do
    [ -e "$f" ] || continue
    b="$(basename "$f")"
    [ "$b" = MEMORY.md ] && continue
    "$GREP" -q "$b" "$d/MEMORY.md" || note "ORPHAN $d/$b (note exists, not in the index, so nothing will ever open it)"
  done
  "$GREP" -oE '\(([a-zA-Z0-9_.-]+\.md)\)' "$d/MEMORY.md" | tr -d '()' | sort -u | while read -r p; do
    [ -f "$d/$p" ] || echo "- DEAD POINTER $d/$p (indexed, file missing)"
  done
done
echo

echo "## 2. notes older than $AGE_DAYS days — promote candidates, NOT deletions"
echo "(runbook §3: any fact still true after about a month gets promoted to its repo home."
echo " This is a review list. Age alone is never a reason to remove anything.)"
for d in $stores; do
  for f in "$d"/*.md; do
    [ -e "$f" ] || continue
    [ "$(basename "$f")" = MEMORY.md ] && continue
    if [ -n "$("$FIND" "$f" -mtime +"$AGE_DAYS" 2>/dev/null)" ]; then
      desc="$("$GREP" -m1 '^description:' "$f" | "$SED" 's/^description: *//')"
      printf -- '- %s  %s :: %s\n' "$("$STAT" -f '%Sm' -t '%Y-%m-%d' "$f")" "$(basename "$f")" "$desc"
    fi
  done
done
echo

echo "## 3. store-count alarm"
n_stores=$(echo "$stores" | wc -l | tr -d ' ')
[ "$n_stores" -gt 2 ] && note "$n_stores real stores found — the design is ONE canonical store per repo (runbook §4)"
for d in $stores; do
  sess="$("$FIND" "$(dirname "$d")" -maxdepth 1 -name '*.jsonl' 2>/dev/null | wc -l | tr -d ' ')"
  [ "$sess" = "0" ] && note "$d has NO session history — it was written to but never read (how backend-scripts was found)"
done
echo

echo "## 4. dead-path check — a projects/ entry whose source directory is gone"
for root in $ROOTS; do
  [ -d "$root/projects" ] || continue
  for entry in "$root"/projects/*/; do
    [ -d "$entry" ] || continue
    slug="$(basename "$entry")"
    case "$slug" in -*) ;; *) continue ;; esac
    src="$(echo "$slug" | "$SED" 's|-|/|g')"
    [ -e "$src" ] || note "dead path: $slug (source directory $src no longer exists)"
  done
done

exit $found
