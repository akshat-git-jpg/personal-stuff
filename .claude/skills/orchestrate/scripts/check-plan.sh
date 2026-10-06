#!/usr/bin/env bash
# Step 3.5 mechanical checks on a plan file. Usage: check-plan.sh <plan.md> [<plan.md> ...]
# Exit 0 = all checks pass, 1 = at least one failure (listed), 2 = usage error.
# Covers only what a script can see; the judgment items of the readiness gate stay manual.
set -uo pipefail

[ $# -ge 1 ] || { echo "usage: $0 <plan.md> [...]" >&2; exit 2; }

# Value of a frontmatter key: first ---...--- block, trailing "# comment" stripped.
fm() {
  awk -v k="$2" '
    /^---[[:space:]]*$/ { n++; if (n == 2) exit; next }
    n == 1 && $0 ~ "^" k ":" {
      sub("^" k ":[[:space:]]*", ""); sub(/[[:space:]]+#.*$/, ""); sub(/^#.*$/, "")
      sub(/[[:space:]]+$/, ""); print; exit
    }' "$1"
}

# Plan body: everything after the frontmatter, fenced code blocks removed, with line numbers.
body() {
  awk '
    /^---[[:space:]]*$/ && n < 2 { n++; next }
    n < 2 { next }
    /^[[:space:]]*```/ { fence = !fence; next }
    !fence { print NR ": " $0 }' "$1"
}

status=0
for plan in "$@"; do
  fails=()
  [ -f "$plan" ] || { echo "FAIL $plan: no such file"; status=1; continue; }

  [ -n "$(fm "$plan" test_cmd)" ] || fails+=("test_cmd is empty (it is the merge gate)")
  exe="$(fm "$plan" executor)"
  case "$exe" in
    claude-p|agy|codex) ;;
    '') fails+=("executor is empty (claude-p | agy | codex)") ;;
    *)  fails+=("executor '$exe' is not one boss runs (claude-p | agy | codex)") ;;
  esac

  # Mutation recipe: all-or-nothing, and required when the plan adds a gate.
  set_n=0
  for k in mutation_apply mutation_command mutation_expect; do
    [ -n "$(fm "$plan" "$k")" ] && set_n=$((set_n + 1))
  done
  if [ "$set_n" -gt 0 ] && [ "$set_n" -lt 3 ]; then
    fails+=("mutation recipe is partial: set all of mutation_apply/command/expect")
  fi
  if [ "$set_n" -eq 0 ] && [ -z "$(fm "$plan" mutation_waived)" ]; then
    gate_hits="$(body "$plan" | grep -iE '\b(add|adds|adding|new|introduce|introduces)\b[^.]{0,30}\b(gate|lint code|lint rule|guard test|assertion)s?\b' \
      | grep -viE '\bno (mutation|gate)|adds no ' | head -3)"
    if [ -n "$gate_hits" ]; then
      fails+=("plan looks like it adds a gate but has no mutation_* recipe (or set mutation_waived: <reason>):"$'\n'"$gate_hits")
    fi
  fi

  # Open decisions left for the executor.
  vague="$(body "$plan" | grep -iE 'as needed|as appropriate|appropriate|sensible' | head -10)"
  [ -z "$vague" ] || fails+=("open-decision phrasing (as needed / appropriate / sensible):"$'\n'"$vague")

  if [ ${#fails[@]} -eq 0 ]; then
    echo "PASS $plan"
  else
    status=1
    echo "FAIL $plan"
    for f in "${fails[@]}"; do printf '  - %s\n' "$f"; done
  fi
done
exit $status
