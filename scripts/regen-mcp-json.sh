#!/usr/bin/env bash
# Regenerate .mcp.json at the repo root.
#
# .mcp.json is gitignored because it holds machine-absolute paths — each clone
# generates its own. Only `google-drive` and `cloudflare` are still wired as
# MCPs; everything else moved to tooling/cli (see tooling/mcp/README.md).
#
# Run this after cloning, or after the repo moves/renames, so the paths inside
# .mcp.json point at this machine's tooling/mcp servers.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MCP="$REPO/tooling/mcp"
PYTHON="${MCP_PYTHON:-/Library/Frameworks/Python.framework/Versions/3.11/bin/python3}"

cat > "$REPO/.mcp.json" <<JSON
{
  "mcpServers": {
    "google-drive": {
      "type": "stdio",
      "command": "$PYTHON",
      "args": [
        "$MCP/google-drive-mcp-server/server.py"
      ],
      "env": {}
    },
    "cloudflare": {
      "type": "stdio",
      "command": "$PYTHON",
      "args": [
        "$MCP/cloudflare-mcp-server/server.py"
      ],
      "env": {}
    }
  }
}
JSON

echo "Wrote $REPO/.mcp.json (python: $PYTHON)"
