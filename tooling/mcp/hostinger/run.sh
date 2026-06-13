#!/usr/bin/env bash
# Launches the unified Hostinger API MCP server (all 118 tools:
# VPS, Domains, DNS, Hosting, Billing, Reach).
# Loads API_TOKEN from the .env file sitting next to this script so the
# token never has to live inside Claude Code's config.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

set -a
# shellcheck disable=SC1091
source "$DIR/.env"
set +a

exec /Users/kbtg/.npm-global/bin/hostinger-api-mcp "$@"
