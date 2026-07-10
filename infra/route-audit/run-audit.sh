#!/usr/bin/env bash
# route-audit runner: one read-only claude -p pass over the repo, report to stdout.
# Callable on the Mac for a dry run; the VPS cron wrapper pipes stdout to Telegram.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLAUDE_BIN="${CLAUDE_BIN:-$(command -v claude || echo /root/.local/bin/claude)}"

cd "$REPO_ROOT"
# Belt AND suspenders: the prompt forbids writes; the flags disallow the tools;
# on the VPS the clone additionally cannot push (read-only deploy key).
exec "$CLAUDE_BIN" -p \
  --output-format text \
  --disallowedTools "Edit,Write,NotebookEdit,Bash(git commit:*),Bash(git push:*),Bash(rm:*)" \
  <<< "$(cat "$SCRIPT_DIR/prompt.md")"
