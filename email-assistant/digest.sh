#!/usr/bin/env bash
# Gmail digest — generate a two-part daily summary for one Gmail account.
#
# How it works (CLI-first; MCP is no longer used here):
#   1. Bash uses `cli/gmail/pp-gmail` to deterministically fetch the email
#      list + bodies for the time window. No Claude in this phase.
#   2. Bash reads the preferences file.
#   3. ONE `claude -p` call summarizes the pre-fetched text. No MCP tools
#      attached — Claude only produces the digest.
#
# This trades ~5-8 in-session MCP tool calls (each shoveling JSON into
# context) for one summarization pass over pre-cleaned plain text — same
# output, far fewer tokens, more predictable failure modes.
#
# Usage:
#   ./digest.sh <email>
#   ./digest.sh kushalbakliwal25@gmail.com
#
# Optional env vars:
#   WINDOW       Gmail query for the time window (default: newer_than:2d)
#                Examples: newer_than:1d, newer_than:12h, after:2026/05/25
#   MAX_EMAILS   Cap on threads fetched (default: 50)
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

PP_GMAIL="$REPO_ROOT/cli/gmail/pp-gmail"
if [[ ! -x "$PP_GMAIL" ]]; then
  echo "ERROR: pp-gmail not executable at $PP_GMAIL" >&2
  exit 1
fi

WINDOW="${WINDOW:-newer_than:2d}"
MAX_EMAILS="${MAX_EMAILS:-50}"

# Phase 1 — fetch thread IDs for the window (deterministic, no Claude).
THREAD_IDS=$("$PP_GMAIL" --account "$EMAIL" search "$WINDOW" --max "$MAX_EMAILS" --format ids)
THREAD_COUNT=$(printf '%s\n' "$THREAD_IDS" | grep -c . || true)

if [[ "$THREAD_COUNT" -eq 0 ]]; then
  echo "ERROR: no emails matched window '$WINDOW' for $EMAIL"
  exit 1
fi

# Phase 2 — fetch the full plain-text bodies for those threads.
# shellcheck disable=SC2086
EMAIL_BODIES=$("$PP_GMAIL" --account "$EMAIL" get $THREAD_IDS --format plain)

# Phase 3 — read preferences inline.
PREFS_CONTENT=$(cat "$PREFS_FILE")

# Build the prompt. The digest-prompt.md still owns the output format spec;
# we just neutralize its "Fetch emails" step (no MCP available) by inlining
# the data and prefs above and adding an override note.
FULL_PROMPT=$(cat <<EOF
$(cat "$PROMPT_FILE")

---

## Run context (CLI-fetched — DO NOT call any tools)

- **Email account**: \`${EMAIL}\`
- **Time window covered**: \`${WINDOW}\` (${THREAD_COUNT} threads fetched)
- All emails and preferences are inlined below. The "Fetch emails" step in
  the task spec above is **already done** — do not attempt any tool calls;
  none are available in this run. Just read the data below and produce the
  formatted digest per the Output format section.

## Preferences (already read for you)

\`\`\`
${PREFS_CONTENT}
\`\`\`

## Emails (${THREAD_COUNT} threads, plain text — already fetched)

\`\`\`
${EMAIL_BODIES}
\`\`\`
EOF
)

# Resolve claude binary — works on Mac (homebrew) and VPS (~/.local/bin/claude).
CLAUDE_BIN="${CLAUDE_BIN:-$(command -v claude || echo /root/.local/bin/claude)}"

# Run Claude non-interactively. No --mcp-config, no --allowed-tools for MCP.
# acceptEdits handles any incidental file writes but Claude isn't expected
# to need any tools — just produce the digest text.
exec "$CLAUDE_BIN" -p \
  --output-format text \
  --permission-mode acceptEdits \
  <<< "$FULL_PROMPT"
