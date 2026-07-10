#!/usr/bin/env bash
# Guard the skill-description token budget (decisions.md 2026-07-04): every
# linked skill's description loads into EVERY session of that account.
# Budget ≤500 chars (WARN above), hard cap 700 (FAIL above → exit 1).
# Usage: check-skill-descriptions.sh [--list]
set -euo pipefail
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STORE="$(cd "$SCRIPTS_DIR/../tooling/claude-skills" && pwd)"
python3 - "$STORE" "${1:-}" <<'PY'
import os, re, sys
store, mode = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "")
fails = warns = 0
for d in sorted(os.listdir(store)):
    f = os.path.join(store, d, "SKILL.md")
    if not os.path.isfile(f):
        continue
    m = re.match(r"^---\n(.*?)\n---", open(f).read(), re.S)
    if not m:
        continue
    dm = re.search(r"^description:\s*(.*?)(?=^\w[\w-]*:|\Z)", m.group(1), re.S | re.M)
    if not dm:
        continue
    n = len(dm.group(1).strip())
    if mode == "--list":
        print(f"{n:5d}  {d}")
    if n > 700:
        print(f"FAIL {d}: {n} chars (hard cap 700)"); fails += 1
    elif n > 500:
        print(f"WARN {d}: {n} chars (budget 500)"); warns += 1
print(f"{fails} over hard cap, {warns} over budget (42-ish skills scanned)")
sys.exit(1 if fails else 0)
PY
