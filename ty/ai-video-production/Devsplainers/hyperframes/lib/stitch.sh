#!/bin/bash
# stitch.sh — render a video's built scenes in order and concat into one MP4.
# Run from the hyperframes/ project root:
#     bash lib/stitch.sh --video test [--quality high|standard|draft]
# Skips scenes still carrying the scaffold TODO marker. Renders sequentially
# (headless Chrome is heavy) then concatenates with ffmpeg. Output:
#     videos/<slug>/renders/<slug>_cut.mp4
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"   # lib/ -> hyperframes/
cd "$ROOT"
VIDEO="test"; QUALITY="high"
while [ $# -gt 0 ]; do
  case "$1" in
    --video) VIDEO="$2"; shift 2 ;;
    --quality) QUALITY="$2"; shift 2 ;;
    *) echo "unknown arg: $1"; exit 2 ;;
  esac
done
SCENES="videos/$VIDEO/scenes"
OUT="videos/$VIDEO/renders"
[ -d "$SCENES" ] || { echo "no scenes dir: $SCENES"; exit 2; }
mkdir -p "$OUT"
LIST="$OUT/concat.txt"; : > "$LIST"
n=0
for d in "$SCENES"/s*/; do
  d="${d%/}"; name="$(basename "$d")"
  if grep -qE 'TODO\(static\)|—[[:space:]]*TODO' "$d/index.html"; then
    echo "skip (todo): $name"; continue
  fi
  echo "render: $name"
  npx --yes hyperframes@0.7.22 render "$d" -o "$OUT/$name.mp4" --fps 30 --quality "$QUALITY" >/dev/null 2>&1
  echo "file '$name.mp4'" >> "$LIST"
  n=$((n+1))
done
[ "$n" -gt 0 ] || { echo "no built scenes to stitch"; exit 1; }
echo "rendered $n scene(s); stitching…"
CUT="$OUT/${VIDEO}_cut.mp4"
if ! ffmpeg -y -f concat -safe 0 -i "$LIST" -c copy "$CUT" >/dev/null 2>&1; then
  ffmpeg -y -f concat -safe 0 -i "$LIST" -c:v libx264 -pix_fmt yuv420p -crf 18 -r 30 "$CUT" >/dev/null 2>&1
fi
echo "done -> $CUT"
ls -la "$CUT"
