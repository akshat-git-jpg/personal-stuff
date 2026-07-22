#!/usr/bin/env bash
# Shared config for debug-from-backendlib scripts. Sourced, not executed.
set -euo pipefail

DASH="${BL_DASH_DIR:-/Users/kbtg/codebase/dashboard-api/postgres}"
LIBS="${BL_LIBS_DIR:-/Users/kbtg/codebase/backend-libs}"
PKG="@zluri/backend-libs"
SCRATCH="${BL_SCRATCH:-$HOME/.cache/debug-from-backendlib}"
LOGFILE="$SCRATCH/bl-debug.log"        # instrumentation output ([bl] lines)
SERVER_LOG="$SCRATCH/server.log"       # captured server stdout/stderr
PIDFILE="$SCRATCH/server.pid"
MANIFEST="$SCRATCH/instrument-manifest.tsv"  # type \t abs_path \t sha_at_add \t snapshot_file
ORIGINALS="$SCRATCH/originals"
MARKER="BLDBG"                          # every injected debug line must contain this
# the app reads PORT from its .env; resolve the same way (override > .env > code default 3000)
ENV_PORT="$(node -e "require('$DASH/node_modules/dotenv').config({path:'$DASH/.env'});console.log(process.env.PORT||'')" 2>/dev/null || true)"
SERVER_PORT="${BL_SERVER_PORT:-${ENV_PORT:-3000}}"
READY_LINE="Your server is ready to listen"  # printed by src/server.ts once listening

mkdir -p "$SCRATCH" "$ORIGINALS"

ok()   { printf '  \033[32mOK\033[0m   %s\n' "$*"; }
warn() { printf '  \033[33mWARN\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$*"; }
sha()  { shasum -a 256 "$1" | awk '{print $1}'; }
