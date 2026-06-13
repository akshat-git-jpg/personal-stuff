#!/usr/bin/env bash
# Local dev runner. Loads .env if present, then starts the API on :8080.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "warning: ANTHROPIC_API_KEY is not set — /parse will fail until you set it" >&2
fi

if [[ -x .venv/bin/uvicorn ]]; then
  UVICORN=.venv/bin/uvicorn
else
  UVICORN=uvicorn
fi

exec "$UVICORN" app.main:app --reload --port "${PORT:-8080}"
