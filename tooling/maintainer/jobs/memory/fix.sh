#!/bin/bash
# memory — the repairs needing zero judgement.
# Everything else (promote, archive) is the session's work after approval.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"
cd "$REPO_ROOT" || die "cannot reach repo root"

echo "Re-running the one-store-per-repo link fix (idempotent):"
bash scripts/relink.sh
