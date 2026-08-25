#!/bin/bash
# mcp - regenerate only after proving the generator preserves every server.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

check="$MAINT_DIR/jobs/mcp/check.sh"
regen="${MCP_REGEN:-$REPO_ROOT/scripts/regen-mcp-json.sh}"
before="$(bash "$check" 2>&1)"
rc=$?
[ "$rc" -le 1 ] || die "mcp check broke before regeneration"

if echo "$before" | "$GREP" -q 'DROPPED-BY-REGEN'; then
  echo "$before" >&2
  die "refusing to regenerate: the generator would drop a configured server"
fi

bash "$regen" || die "MCP generator failed"
bash "$check"
