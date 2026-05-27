#!/usr/bin/env bash
# Gmail digest — generate a two-part daily summary for one Gmail account.
#
# This is the PROJECT script. It does the actual work: invokes Claude with the
# Gmail MCP, runs the digest prompt against the given account's inbox, and
# prints the formatted summary to stdout.
#
# Cron is separate: a wrapper in vps-crons/gmail-digest/ will eventually call
# this script and pipe its stdout to Telegram. Run this directly from a Mac or
# VPS terminal anytime; it doesn't know or care about cron.
#
# Usage:
#   ./digest.sh <email>
#   ./digest.sh kushalbakliwal25@gmail.com
#
# Optional env vars:
#   WINDOW    Gmail query for the time window (default: newer_than:2d)
#             Examples: newer_than:1d, newer_than:12h, after:2026/05/25
#
# Output: the formatted digest text to stdout.
# Errors: a single line starting with "ERROR: " to stdout/stderr, exit 1.

set -euo pipefail

EMAIL="${1:-}"
if [[ -z "$EMAIL" ]]; then
  echo "Usage: $0 <email>" >&2
  echo "Example: $0 kushalbakliwal25@gmail.com" >&2
  exit 1
fi

ASSISTANT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$ASSISTANT_DIR/.." && pwd)"

PREFS_FILE="$ASSISTANT_DIR/email-preferences-${EMAIL}.md"
if [[ ! -f "$PREFS_FILE" ]]; then
  echo "ERROR: preferences not found for $EMAIL at $PREFS_FILE" >&2
  exit 1
fi

PROMPT_FILE="$ASSISTANT_DIR/digest-prompt.md"
if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "ERROR: prompt file missing at $PROMPT_FILE" >&2
  exit 1
fi

GMAIL_MCP="$REPO_ROOT/mcp/gmail-mcp-server/server.py"
if [[ ! -f "$GMAIL_MCP" ]]; then
  echo "ERROR: gmail MCP not found at $GMAIL_MCP" >&2
  exit 1
fi

# Pick a python that has the MCP deps installed.
#   - On the VPS we create a shared venv at mcp/.venv (mcp + google-api-python-client + ...).
#   - On Mac the deps live in the system python3.
# Auto-detect the venv; fall back to system python3.
if [[ -x "$REPO_ROOT/mcp/.venv/bin/python3" ]]; then
  PYTHON_BIN="$REPO_ROOT/mcp/.venv/bin/python3"
else
  PYTHON_BIN="python3"
fi

WINDOW="${WINDOW:-newer_than:2d}"

# Inline MCP config so we don't have to maintain a per-machine .mcp.json file.
MCP_JSON=$(cat <<EOF
{
  "mcpServers": {
    "gmail": {
      "type": "stdio",
      "command": "${PYTHON_BIN}",
      "args": ["${GMAIL_MCP}"]
    }
  }
}
EOF
)

# Compose the full prompt: digest-prompt.md + run context appended.
RUN_CONTEXT=$(cat <<EOF

---

## Run context

- **Email account to summarize**: \`${EMAIL}\`
- **Preferences file**: \`${PREFS_FILE}\` (read this first via the Read tool or directly)
- **Time window**: \`${WINDOW}\` (use this as the Gmail query, e.g., \`search_emails(account="${EMAIL}", query="${WINDOW}")\`)
EOF
)

FULL_PROMPT="$(cat "$PROMPT_FILE")${RUN_CONTEXT}"

# Resolve claude binary — works on Mac (homebrew) and VPS (~/.local/bin/claude)
CLAUDE_BIN="${CLAUDE_BIN:-$(command -v claude || echo /root/.local/bin/claude)}"

# Run Claude non-interactively. bypassPermissions so MCP tool calls + file reads
# proceed without hanging on permission prompts in a non-TTY environment.
#
# Prompt is piped via stdin to avoid claude's variadic --add-dir / --mcp-config
# greedily consuming the positional prompt arg.
exec "$CLAUDE_BIN" -p \
  --output-format text \
  --permission-mode bypassPermissions \
  --mcp-config "$MCP_JSON" \
  --add-dir "$ASSISTANT_DIR" \
  <<< "$FULL_PROMPT"
