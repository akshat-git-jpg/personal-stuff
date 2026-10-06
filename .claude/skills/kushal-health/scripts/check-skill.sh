#!/usr/bin/env bash
# Structural gate for the kushal-health skill.
set -uo pipefail
D="$(cd "$(dirname "$0")/.." && pwd)"
S="$D/SKILL.md"; M="$D/markers.md"; fail=0
for h in "## Rules" "## Setup check" "## Read the PDF" "## Map to markers" "## Owner check" "## Write the verdict" "## Push" "## Confirm" "## Redo or fix a report"; do
  grep -qxF "$h" "$S" || { echo "missing section: $h"; fail=1; }
done
for s in "pdftotext -layout" "push-report.mjs --history" "push-report.mjs <json>" "Worth showing to your doctor." "60 words" ".ingest.env"; do
  grep -qF -- "$s" "$S" || { echo "missing text: $s"; fail=1; }
done
grep -q '^name: kushal-health$' "$S" || { echo "bad frontmatter name"; fail=1; }
rows=$(grep -cE '^\| [a-z0-9_]+ \| (Diabetes|Lipid|Thyroid|Liver|Kidney|CBC|Vitamins|Hormones|Other) \|' "$M")
[ "$rows" -ge 39 ] || { echo "markers.md has $rows valid rows, need >= 39"; fail=1; }
dups=$(grep -oE '^\| [a-z0-9_]+ \|' "$M" | sort | uniq -d)
[ -z "$dups" ] || { echo "duplicate marker keys: $dups"; fail=1; }
[ "$fail" -eq 0 ] && echo "check-skill OK"
exit "$fail"
