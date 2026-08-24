#!/usr/bin/env bash
# TRANSITIONAL SHIM. The real guard is
# .claude/skills/personal-stuff-diagnostics-and-tooling/scripts/check-descriptions.sh,
# which since 2026-08-25 covers every skill in the repo — the store this file used to
# scan is gone, and nothing in the tree calls this path any more.
#
# It stays because `pp-land` picks verify commands by matching CHANGED paths against
# verify-map.tsv, and a diff that DELETES `tooling/claude-skills/**` still matches the
# rule that base's map had for that prefix. The landing commit for the rename therefore
# tried to run this script after removing it, and parked. Deleting this file is safe
# once no in-flight branch still touches `tooling/claude-skills/`.
exec "$(cd "$(dirname "$0")/.." && pwd)/.claude/skills/personal-stuff-diagnostics-and-tooling/scripts/check-descriptions.sh" "$@"
