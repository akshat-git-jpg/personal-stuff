#!/usr/bin/env bash
# Guard the skill-description token budget for REPO-OPERATING skills in
# .claude/skills/ — companion to scripts/check-skill-descriptions.sh (repo
# root), which only scans the tooling/claude-skills/ store and runs inside
# relink.sh. This one is NOT wired into relink.sh; run it on demand after any
# .claude/skills description edit. Same thresholds as the store guard
# (decisions.md 2026-07-04): budget ≤500 chars (WARN above), hard cap 700
# (FAIL above → exit 1).
# Follows symlinked skill dirs (pipelines/ skills are symlinked in) but counts
# each resolved SKILL.md once. Handles both single-line and `description: |`
# block-scalar YAML.
# Usage: check-descriptions.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS="$(cd "$SCRIPT_DIR/../.." && pwd)"
python3 - "$SKILLS" <<'PY'
import os, re, sys, textwrap
skills = sys.argv[1]
fails = warns = scanned = dups = 0
rows = []
seen = {}
for d in sorted(os.listdir(skills)):
    f = os.path.join(skills, d, "SKILL.md")
    if not os.path.isfile(f):  # os.path.isfile follows symlinks
        continue
    real = os.path.realpath(f)
    if real in seen:
        dups += 1
        continue
    seen[real] = d
    m = re.match(r"^---\n(.*?)\n---", open(f).read(), re.S)
    if not m:
        rows.append(("-", "NONE", d + " (no frontmatter)")); continue
    dm = re.search(r"^description:\s*(.*?)(?=^\w[\w-]*:|\Z)", m.group(1), re.S | re.M)
    if not dm:
        rows.append(("-", "NONE", d + " (no description)")); continue
    raw = dm.group(1)
    first, _, rest = raw.partition("\n")
    if first.strip().startswith(("|", ">")):  # block scalar (description: |)
        desc = textwrap.dedent(rest).strip()
    else:
        desc = raw.strip()
    n = len(desc)
    scanned += 1
    if n > 700:
        status = "FAIL"; fails += 1
    elif n > 500:
        status = "WARN"; warns += 1
    else:
        status = "ok"
    rows.append((str(n), status, d))
print(f"{'CHARS':>5}  {'STATUS':<6} SKILL")
for n, status, name in rows:
    print(f"{n:>5}  {status:<6} {name}")
print(f"{fails} over hard cap (>700), {warns} over budget (>500) — "
      f"{scanned} skills scanned, {dups} symlink duplicates skipped")
sys.exit(1 if fails else 0)
PY
