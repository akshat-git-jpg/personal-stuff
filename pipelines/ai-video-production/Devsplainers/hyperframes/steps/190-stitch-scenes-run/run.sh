#!/bin/bash
# Thin wrapper → lib/stitch-video.sh. Run from anywhere:
#   bash steps/<this>/run.sh --video <slug>
exec bash "$(cd "$(dirname "$0")/../.." && pwd)/lib/stitch-video.sh" "$@"
