#!/bin/bash
# improve — RECON ONLY. This job's audit is session judgement, not a script.
# Writes the facts every plan needs (verification commands, hotspots, intent docs).
# Exit 0 = recon clean, 1 = findings worth a proposal, 2 = the check itself broke.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

ROOT="${IMPROVE_ROOT:-${1:-$REPO_ROOT}}"
cd "$ROOT" || die "cannot reach $ROOT"

found=0
note() { echo "- $1"; found=1; }

echo "# improve recon — $(today)"
echo
echo "Target: \`$ROOT\`"
echo

echo "## 1. verification baseline (goes into every plan)"
if [ -f package.json ]; then
  echo '- package.json scripts:'
  "$GREP" -oE '"(test|build|lint|typecheck|check)[^"]*":[[:space:]]*"[^"]*"' package.json | "$SED" 's/^/  - /' || true
  "$GREP" -qE '"(test|typecheck)' package.json || note "NO BASELINE no test/typecheck script — 'establish a verification baseline' is finding #1"
fi
[ -f pyproject.toml ] && echo "- pyproject.toml present"
[ -f go.mod ] && echo "- go.mod present"
[ -f Makefile ] && echo "- Makefile targets:" && "$GREP" -oE '^[a-zA-Z0-9_-]+:' Makefile | "$SED" 's/^/  - /' | head -20
echo

echo "## 2. intent docs (a tradeoff recorded here is NOT a finding)"
for f in README.md CLAUDE.md AGENTS.md CONTRIBUTING.md CONTEXT.md DESIGN.md PRODUCT.md decisions.md; do
  [ -f "$f" ] && echo "- $f"
done
for d in docs/adr docs/adrs docs/decisions; do
  [ -d "$d" ] && echo "- $d/ ($(ls "$d" | wc -l | tr -d ' ') entries)"
done
echo

echo "## 3. churn hotspots (last 90 days, top 15)"
if git rev-parse --git-dir >/dev/null 2>&1; then
  git log --since="90 days ago" --name-only --pretty=format: 2>/dev/null \
    | "$GREP" -vE '^$|^plans/|\.md$' | sort | uniq -c | sort -rn | head -15 | "$SED" 's/^/- /'
else
  echo "- (not a git repo)"
fi
echo

echo "## 4. size signal (largest source files)"
"$FIND" . -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.py' -o -name '*.go' -o -name '*.js' \) \
  -not -path '*/node_modules/*' -not -path '*/.venv/*' -not -path '*/dist/*' 2>/dev/null \
  | xargs wc -l 2>/dev/null | sort -rn | "$SED" -n '2,11p' | "$SED" 's/^/- /' || true
echo

echo "## 5. what recon did NOT cover"
echo "- correctness, security, performance, tests, tech debt, deps, DX, docs, direction"
echo "- those nine are the session's job; read \`runbook.md\` then \`references/audit-playbook.md\`"

exit $found
