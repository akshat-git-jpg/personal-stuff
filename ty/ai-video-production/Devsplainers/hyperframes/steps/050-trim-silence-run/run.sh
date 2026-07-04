#!/bin/bash
# Thin wrapper → lib/trim-silence.sh.
#   bash steps/050-trim-silence-run/run.sh --video <slug>
exec bash "$(cd "$(dirname "$0")/../.." && pwd)/lib/trim-silence.sh" "$@"
