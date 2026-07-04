#!/bin/bash
# make-cut.sh — render the built scenes of the `test` video in order and stitch
# them into one MP4. Run from the hyperframes/ project root:
#     bash videos/test/make-cut.sh
# Skips scenes still carrying the scaffold TODO marker. Renders sequentially
# (headless Chrome is heavy) then concatenates with ffmpeg.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"   # -> hyperframes/
cd "$ROOT"
OUT="videos/test/renders"
mkdir -p "$OUT"
LIST="$OUT/concat.txt"; : > "$LIST"
n=0
for d in videos/test/scenes/s*/; do
  d="${d%/}"; name="$(basename "$d")"
  if grep -qE 'TODO\(static\)|—[[:space:]]*TODO' "$d/index.html"; then
    echo "skip (todo): $name"; continue
  fi
  echo "render: $name"
  npx --yes hyperframes@0.7.22 render "$d" -o "$OUT/$name.mp4" --fps 30 --quality high >/dev/null 2>&1
  echo "file '$name.mp4'" >> "$LIST"
  n=$((n+1))
done
echo "rendered $n scene(s); stitching…"
# try stream-copy concat first (all scenes share codec/res/fps); fall back to re-encode
if ! ffmpeg -y -f concat -safe 0 -i "$LIST" -c copy "$OUT/test_cut.mp4" >/dev/null 2>&1; then
  ffmpeg -y -f concat -safe 0 -i "$LIST" -c:v libx264 -pix_fmt yuv420p -crf 18 -r 30 "$OUT/test_cut.mp4" >/dev/null 2>&1
fi
echo "done -> $OUT/test_cut.mp4"
ls -la "$OUT/test_cut.mp4"
