#!/usr/bin/env bash
# Email digest — generate a two-part daily summary for one mailbox.
#
# How it works (CLI-first; MCP is no longer used here):
#   1. Bash deterministically fetches the email list + bodies for the time
#      window. No Claude in this phase. Two readers, picked by address:
#        - Gmail accounts -> `cli/gmail/pp-gmail` (Gmail API + OAuth)
#        - anything listed in `imap-accounts.json` -> `fetch-imap.py` (plain
#          IMAP; this is how the Hostinger mailbox is read)
#      Both print the same `=== sender — subject (date) ===` block shape, so
#      everything downstream is identical.
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
#   ./digest.sh khushibakliwal@agrolloo.com
#
# Optional env vars:
#   WINDOW         Gmail query for the time window (default: newer_than:2d)
#                  Examples: newer_than:1d, newer_than:12h, after:2026/05/25
#                  IMAP accounts honour only the `newer_than:Nd` form (IMAP
#                  SINCE is date-granular); anything else falls back to 2 days.
#   MAX_EMAILS     Cap on threads fetched (default: 50)
#   IMAP_ACCOUNTS  Path to the IMAP credentials JSON
#                  (default: <this dir>/imap-accounts.json, gitignored)
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
# apps/telegram-email-assistant -> repo root is two levels up
REPO_ROOT="$(cd "$ASSISTANT_DIR/../.." && pwd)"

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

WINDOW="${WINDOW:-newer_than:2d}"
MAX_EMAILS="${MAX_EMAILS:-50}"

IMAP_ACCOUNTS="${IMAP_ACCOUNTS:-$ASSISTANT_DIR/imap-accounts.json}"
FETCH_IMAP="$ASSISTANT_DIR/fetch-imap.py"

# Route by address: an entry in imap-accounts.json wins, otherwise Gmail.
# `--has-account` reads the file and exits 0/1; it connects to nothing.
USE_IMAP=0
if [[ -x "$FETCH_IMAP" ]] \
   && "$FETCH_IMAP" "$EMAIL" --accounts "$IMAP_ACCOUNTS" --has-account 2>/dev/null; then
  USE_IMAP=1
fi

if [[ "$USE_IMAP" -eq 1 ]]; then
  # ---- IMAP path (Hostinger, and any other non-Gmail mailbox) ----
  DAYS=2
  if [[ "$WINDOW" =~ ^newer_than:([0-9]+)d$ ]]; then
    DAYS="${BASH_REMATCH[1]}"
  fi

  # fetch-imap.py prints one "ERROR: ..." line on no-mail / auth / network
  # failure, which is exactly what run.sh forwards to Telegram.
  if ! EMAIL_BODIES=$("$FETCH_IMAP" "$EMAIL" --days "$DAYS" --max "$MAX_EMAILS" \
                        --accounts "$IMAP_ACCOUNTS" 2>&1); then
    printf '%s\n' "$EMAIL_BODIES" | grep '^ERROR:' \
      || echo "ERROR: IMAP fetch failed for $EMAIL"
    exit 1
  fi

  THREAD_COUNT=$(printf '%s\n' "$EMAIL_BODIES" | grep -c '^=== ' || true)
  WINDOW_LABEL="last ${DAYS}d (IMAP)"
else
  # ---- Gmail path ----
  PP_GMAIL="$REPO_ROOT/tooling/cli/gmail/pp-gmail"
  if [[ ! -x "$PP_GMAIL" ]]; then
    echo "ERROR: pp-gmail not executable at $PP_GMAIL" >&2
    exit 1
  fi

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
  WINDOW_LABEL="$WINDOW"
fi

if [[ "$THREAD_COUNT" -eq 0 ]]; then
  echo "ERROR: no emails matched window '$WINDOW' for $EMAIL"
  exit 1
fi

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
- **Time window covered**: \`${WINDOW_LABEL}\` (${THREAD_COUNT} threads fetched)
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

# Run Claude non-interactively and validate the output SHAPE before shipping.
# run.sh (vps-crons) only catches empty output; a non-empty refusal or error
# dump that exits 0 would otherwise go to Telegram as if it were the digest.
#
# The `if !` matters: a bare `VAR=$(...)` assignment under `set -e` kills the
# script the instant claude exits non-zero, so the reason never reaches
# Telegram and run.sh can only say "digest.sh failed with no output". Quota
# exhaustion ("You've hit your weekly limit") is the common case and is worth
# reading in the alert — observed 2026-08-30.
CLAUDE_STDERR=$(mktemp)
if ! DIGEST_OUTPUT=$("$CLAUDE_BIN" -p \
      --output-format text \
      --permission-mode acceptEdits \
      2>"$CLAUDE_STDERR" \
      <<< "$FULL_PROMPT"); then
  REASON=$(tr -d '\r' < "$CLAUDE_STDERR" | head -c 300)
  rm -f "$CLAUDE_STDERR"
  # The quota message arrives on stdout, so fall back to it when stderr is empty.
  echo "ERROR: claude failed for $EMAIL — ${REASON:-${DIGEST_OUTPUT:-no output}}"
  exit 1
fi
rm -f "$CLAUDE_STDERR"

if [[ ${#DIGEST_OUTPUT} -lt 200 \
      || "$DIGEST_OUTPUT" != *"Part 1: Overall summary"* \
      || "$DIGEST_OUTPUT" != *"Part 2: Per your preferences"* ]]; then
  echo "ERROR: digest output failed shape check for $EMAIL (${#DIGEST_OUTPUT} chars, expected Part 1/Part 2 sections) — got: $(printf '%.200s' "$DIGEST_OUTPUT")"
  exit 1
fi

printf '%s\n' "$DIGEST_OUTPUT"
