#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# A failed pull must NOT stop the poll: the code is already on disk, and a
# missed stock check is worse than running one commit behind. Seen in prod
# 2026-08-18: a duplicated origin/main ref ("cannot lock ref") killed the run
# under set -e before watch.py ever started.
git pull --ff-only --quiet || echo "WARN: git pull failed; polling with the code already on disk" >&2

exec python3 apps/amul-watch/watch.py --once
