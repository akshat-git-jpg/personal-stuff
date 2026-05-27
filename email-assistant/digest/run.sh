#!/usr/bin/env bash
# Gmail digest — generate a daily summary for one Gmail account.
#
# Usage:
#   ./run.sh <email>
#   ./run.sh kushalbakliwal25@gmail.com
#
# Optional env vars:
#   WINDOW    Gmail query for the time window (default: newer_than:2d)
#             Examples: newer_than:1d, newer_than:12h, after:2026/05/25
#
# Output: the formatted digest text to stdout. Pipe wherever (Telegram, file, etc.).
# Errors: a single line starting with "ERROR: " to stdout, exit 1.

set -euo pipefail

EMAIL="${1:-}"
if [[ -z "$EMAIL" ]]; then
  echo "Usage: $0 <email>" >&2
  echo "Example: $0 kushalbakliwal25@gmail.com" >&2
  exit 1
fi

DIGEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSISTANT_DIR="$(cd "$DIGEST_DIR/.." && pwd)"
REPO_ROOT="$(cd "$ASSISTANT_DIR/.." && pwd)"

PREFS_FILE="$ASSISTANT_DIR/email-preferences-${EMAIL}.md"
if [[ ! -f "$PREFS_FILE" ]]; then
  echo "ERROR: preferences not found for $EMAIL at $PREFS_FILE" >&2
  exit 1
fi

GMAIL_MCP="$REPO_ROOT/mcp/gmail-mcp-server/server.py"
if [[ ! -f "$GMAIL_MCP" ]]; then
  echo "ERROR: gmail MCP not found at $GMAIL_MCP" >&2
  exit 1
fi

WINDOW="${WINDOW:-newer_than:2d}"

# Inline MCP config so we don't have to maintain a per-machine .mcp.json file.
MCP_JSON=$(cat <<EOF
{
  "mcpServers": {
    "gmail": {
      "type": "stdio",
      "command": "python3",
      "args": ["${GMAIL_MCP}"]
    }
  }
}
EOF
)

# Compose the full prompt: base prompt.md + run context appended.
RUN_CONTEXT=$(cat <<EOF

---

## Run context

- **Email account to summarize**: \`${EMAIL}\`
- **Preferences file**: \`${PREFS_FILE}\` (read this first via the Read tool or directly)
- **Time window**: \`${WINDOW}\` (use this as the Gmail query, e.g., \`search_emails(account="${EMAIL}", query="${WINDOW}")\`)
EOF
)

FULL_PROMPT="$(cat "$DIGEST_DIR/prompt.md")${RUN_CONTEXT}"

# Resolve claude binary — works on Mac (homebrew) and VPS (~/.local/bin/claude)
CLAUDE_BIN="${CLAUDE_BIN:-$(command -v claude || echo /root/.local/bin/claude)}"

# Run Claude non-interactively. bypassPermissions so MCP tool calls + file reads
# proceed without hanging on prompts in a non-TTY environment.
#
# Prompt is piped via stdin to avoid claude's variadic --add-dir / --mcp-config
# greedily consuming the positional prompt arg.
exec "$CLAUDE_BIN" -p \
  --output-format text \
  --permission-mode bypassPermissions \
  --mcp-config "$MCP_JSON" \
  --add-dir "$ASSISTANT_DIR" \
  <<< "$FULL_PROMPT"
