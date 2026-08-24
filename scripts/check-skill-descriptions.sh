#!/usr/bin/env bash
# Forward to the new location (to unblock landing during the rename)
exec "$(cd "$(dirname "$0")/.." && pwd)/.claude/skills/personal-stuff-diagnostics-and-tooling/scripts/check-descriptions.sh" "$@"
