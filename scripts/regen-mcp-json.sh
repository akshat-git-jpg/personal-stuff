#!/usr/bin/env bash
# Regenerate .mcp.json at the repo root.
#
# .mcp.json is gitignored because it holds machine-absolute paths - each clone
# generates its own. The five active servers are listed in tooling/mcp/README.md.
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
    },
    "indian-railways": {
      "type": "stdio",
      "command": "node",
      "args": [
        "$MCP/indian-railways-mcp/build/index.js"
      ],
      "env": {}
    },
    "davinci-resolve": {
      "type": "stdio",
      "command": "$MCP/davinci-resolve-mcp/venv/bin/python",
      "args": [
        "$MCP/davinci-resolve-mcp/src/server.py"
      ],
      "env": {
        "RESOLVE_SCRIPT_API": "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting",
        "RESOLVE_SCRIPT_LIB": "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so",
        "PYTHONPATH": "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules"
      }
    },
    "davinci-resolve-advanced": {
      "type": "stdio",
      "command": "node",
      "args": [
        "$MCP/davinci-resolve-mcp/bin/davinci-resolve-advanced-mcp.mjs"
      ],
      "env": {
        "AAF_PROBE_PYTHON": "$MCP/davinci-resolve-mcp/venv/bin/python"
      }
    }
  }
}
JSON

echo "Wrote $REPO/.mcp.json (python: $PYTHON)"
