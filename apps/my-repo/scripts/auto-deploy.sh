#!/usr/bin/env bash
# Redeploys my-repo after a land that changed what the map draws. pp-land runs it in the background.
#   auto-deploy.sh <main checkout> <main sha before the land> <main sha after>
# MYREPO_AUTODEPLOY=0 turns it off; MYREPO_AUTODEPLOY_DRY=1 prints the decision instead of deploying.
set -u
MAIN="$1" OLD="$2" NEW="$3"

# Paths the scanner reads: skills, hooks, CLIs, mods, MCPs, launchd, crons, routing, the app itself.
MAP='^(\.claude/(skills|hooks)/|\.claude/settings\.json|pipelines/\.claude/skills/|tooling/(cli|mods|mcp|press-clis)/|\.mcp\.json|scripts/regen-mcp-json\.sh|VPS-CRONS\.md|apps/my-repo/)|\.plist$|(^|/)CLAUDE\.md$'

[ "${MYREPO_AUTODEPLOY:-1}" = 1 ] || exit 0
git -C "$MAIN" diff --name-only "$OLD" "$NEW" 2>/dev/null | grep -qE "$MAP" || exit 0
if [ -n "${MYREPO_AUTODEPLOY_DRY:-}" ]; then echo "would deploy"; exit 0; fi
# The deploy needs the owner's Cloudflare login, which only his Mac holds.
[ "$(uname)" = Darwin ] || exit 0

LOCK="${TMPDIR:-/tmp}/my-repo-auto-deploy.lock"
mkdir "$LOCK" 2>/dev/null || { echo "$(date '+%F %T') deploy already running, skipped"; exit 0; }
trap 'rmdir "$LOCK"' EXIT

cd "$MAIN/apps/my-repo" || exit 0
[ -d node_modules ] || { echo "$(date '+%F %T') no node_modules in $PWD, skipped"; exit 0; }
echo "$(date '+%F %T') deploying my-repo for ${NEW:0:8}"
. ../../scripts/node22-path.sh && npm run deploy 2>&1 | tail -5
