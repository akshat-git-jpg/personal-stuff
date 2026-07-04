#!/bin/bash
# render-scenes.sh — step 180. Render each built scene to a silent MP4.
#   bash lib/render-scenes.sh --video <slug> [--quality high|standard|draft]
# Skips scenes still carrying the scaffold TODO marker. Output:
#   videos/<slug>/renders/scenes/<sceneName>.mp4
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
VIDEO="test"; QUALITY="high"
while [ $# -gt 0 ]; do case "$1" in
  --video) VIDEO="$2"; shift 2 ;; --quality) QUALITY="$2"; shift 2 ;;
  *) echo "unknown arg: $1"; exit 2 ;; esac; done
SCENES="videos/$VIDEO/scenes"; OUT="videos/$VIDEO/renders/scenes"
[ -d "$SCENES" ] || { echo "no scenes dir: $SCENES"; exit 2; }
mkdir -p "$OUT"
n=0
for d in "$SCENES"/s*/; do
  d="${d%/}"; name="$(basename "$d")"
  if grep -qE 'TODO\(static\)|—[[:space:]]*TODO' "$d/index.html"; then echo "skip (todo): $name"; continue; fi
  echo "render: $name"
  npx --yes hyperframes@0.7.22 render "$d" -o "$OUT/$name.mp4" --fps 30 --quality "$QUALITY" >/dev/null 2>&1
  n=$((n+1))
done
echo "rendered $n scene(s) -> $OUT/"
