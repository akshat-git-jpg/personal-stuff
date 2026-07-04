#!/bin/bash
# Thin wrapper → lib/mux.sh. Run from anywhere:
#   bash steps/<this>/run.sh --video <slug>
exec bash "$(cd "$(dirname "$0")/../.." && pwd)/lib/mux.sh" "$@"
