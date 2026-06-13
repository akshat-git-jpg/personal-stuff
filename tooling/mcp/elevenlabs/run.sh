#!/usr/bin/env bash
# Launches the official ElevenLabs MCP server via uvx (auto-installs/caches it).
# Loads ELEVENLABS_API_KEY from the .env file sitting next to this script so the
# key never has to live inside Claude Code's config.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

set -a
# shellcheck disable=SC1091
source "$DIR/.env"
set +a

exec /Users/kbtg/.local/bin/uvx elevenlabs-mcp "$@"
