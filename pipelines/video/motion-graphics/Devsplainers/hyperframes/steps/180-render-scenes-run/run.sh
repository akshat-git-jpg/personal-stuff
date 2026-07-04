#!/bin/bash
# Thin wrapper → lib/render-scenes.sh. Run from anywhere:
#   bash steps/<this>/run.sh --video <slug>
exec bash "$(cd "$(dirname "$0")/../.." && pwd)/lib/render-scenes.sh" "$@"
