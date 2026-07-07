#!/bin/bash
# stitch-video.sh — step 190. Align each scene to T=max(scene,VO) and concatenate
# into one silent video. Scenes shorter than their VO freeze their last frame; the
# per-scene target comes from lib/align.mjs (shared with step 200 so A/V never drift).
#   bash lib/stitch-video.sh --video <slug>
# In:  videos/<slug>/renders/scenes/*.mp4  +  audio/*.trim.wav  (via align.mjs)
# Out: videos/<slug>/renders/<slug>.silent.mp4
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
VIDEO="test"
while [ $# -gt 0 ]; do case "$1" in --video) VIDEO="$2"; shift 2 ;; *) echo "unknown arg: $1"; exit 2 ;; esac; done
OUT="videos/$VIDEO/renders"; WORK="$OUT/aligned/video"
rm -rf "$WORK"; mkdir -p "$WORK"
LIST="$OUT/video-concat.txt"; : > "$LIST"

count=0
# align.mjs prints: n <TAB> mp4 <TAB> wav <TAB> video <TAB> vo <TAB> T
while IFS=$'\t' read -r n mp4 wav video vo T; do
  [ -n "${n:-}" ] || continue
  out="$WORK/$(printf '%02d' "$n").mp4"
  ext="$(python3 -c "print(round(max(0.0,$T-$video),3))")"
  if python3 -c "exit(0 if $ext>0.05 else 1)"; then
    # scene shorter than VO → hold the final frame for the remainder
    ffmpeg -nostdin -y -v error -i "$mp4" -vf "tpad=stop_mode=clone:stop_duration=${ext}" \
      -c:v libx264 -pix_fmt yuv420p -r 30 -an "$out"
  else
    # scene >= VO → cut to T (uniform re-encode so concat can stream-copy)
    ffmpeg -nostdin -y -v error -i "$mp4" -t "$T" -c:v libx264 -pix_fmt yuv420p -r 30 -an "$out"
  fi
  echo "file '$(cd "$(dirname "$out")" && pwd)/$(basename "$out")'" >> "$LIST"
  count=$((count+1))
done < <(node lib/align.mjs --video "$VIDEO")

[ "$count" -gt 0 ] || { echo "no scenes to stitch"; exit 1; }
CUT="$OUT/${VIDEO}.silent.mp4"
ffmpeg -y -v error -f concat -safe 0 -i "$LIST" -c copy "$CUT"
echo "stitched $count scene(s) (aligned to VO) -> $CUT"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$CUT" | xargs printf "  silent video: %ss\n"
