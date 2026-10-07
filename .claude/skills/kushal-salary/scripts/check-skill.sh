#!/usr/bin/env bash
# Structural gate for the kushal-salary skill.
set -uo pipefail
D="$(cd "$(dirname "$0")/.." && pwd)"
S="$D/SKILL.md"; fail=0
for h in "## Rules" "## Setup check" "## What is already stored" "## Get the payslips" "## Parse and check" "## Push" "## Mail notes (appraisal letters, revised salary)" "## Confirm" "## Fix a month"; do
  grep -qxF "$h" "$S" || { echo "missing section: $h"; fail=1; }
done
for s in "Never control Chrome with scripts" "messageFormat: RAW" "raw-to-pdf.py" "from:razorpay has:attachment filename:pdf" "push-month.mjs --history" "push-note.mjs" "python3 -I" ".ingest.env" "Wait for ok"; do
  grep -qF -- "$s" "$S" || { echo "missing text: $s"; fail=1; }
done
grep -q '^name: kushal-salary$' "$S" || { echo "bad frontmatter name"; fail=1; }
python3 -I -c "import ast,sys; ast.parse(open(sys.argv[1]).read())" "$D/scripts/raw-to-pdf.py" || { echo "raw-to-pdf.py does not parse"; fail=1; }
[ "$fail" -eq 0 ] && echo "check-skill OK"
exit "$fail"
