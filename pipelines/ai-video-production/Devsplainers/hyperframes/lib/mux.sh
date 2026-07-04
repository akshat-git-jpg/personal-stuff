#!/bin/bash
# mux.sh — step 210. Mux the VO track onto the silent video → the final file.
#   bash lib/mux.sh --video <slug>
# In:  videos/<slug>/renders/<slug>.silent.mp4 + <slug>.vo.wav
# Out: videos/<slug>/renders/<slug>_final.mp4
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
VIDEO="test"
while [ $# -gt 0 ]; do case "$1" in --video) VIDEO="$2"; shift 2 ;; *) echo "unknown arg: $1"; exit 2 ;; esac; done
OUT="videos/$VIDEO/renders"
V="$OUT/${VIDEO}.silent.mp4"; A="$OUT/${VIDEO}.vo.wav"; F="$OUT/${VIDEO}_final.mp4"
[ -e "$V" ] || { echo "missing silent video: $V (run step 190)"; exit 2; }
[ -e "$A" ] || { echo "missing VO track: $A (run step 200)"; exit 2; }
ffmpeg -y -i "$V" -i "$A" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest "$F" >/dev/null 2>&1
echo "muxed -> $F"
ls -la "$F"
