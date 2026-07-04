#!/bin/bash
# concat-vo.sh — step 200. Pad each VO clip to its scene's aligned length T and
# concatenate into one audio track. T=max(scene,VO) comes from lib/align.mjs — the
# SAME plan step 190 uses — so the VO track and the silent video are equal length
# per scene and overall. Mux (210) is then drift-free.
#   bash lib/concat-vo.sh --video <slug>
# In:  videos/<slug>/audio/beatNN.trim.wav  (+ renders/scenes via align.mjs)
# Out: videos/<slug>/renders/<slug>.vo.wav
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
VIDEO="test"
while [ $# -gt 0 ]; do case "$1" in --video) VIDEO="$2"; shift 2 ;; *) echo "unknown arg: $1"; exit 2 ;; esac; done
OUT="videos/$VIDEO/renders"; WORK="$OUT/aligned/audio"; mkdir -p "$OUT"
rm -rf "$WORK"; mkdir -p "$WORK"
LIST="$OUT/vo-concat.txt"; : > "$LIST"

count=0
# align.mjs prints: n <TAB> mp4 <TAB> wav <TAB> video <TAB> vo <TAB> T
while IFS=$'\t' read -r n mp4 wav video vo T; do
  [ -n "${n:-}" ] || continue
  out="$WORK/$(printf '%02d' "$n").wav"
  if [ -n "$wav" ] && [ -e "$wav" ]; then
    # pad trailing silence up to T (T>=vo by construction), resample uniform for concat
    ffmpeg -nostdin -y -v error -i "$wav" -af apad -t "$T" -ar 24000 -ac 1 "$out"
  else
    # no VO for this scene → T seconds of silence so alignment holds
    ffmpeg -nostdin -y -v error -f lavfi -i anullsrc=r=24000:cl=mono -t "$T" -ar 24000 -ac 1 "$out"
  fi
  echo "file '$(cd "$(dirname "$out")" && pwd)/$(basename "$out")'" >> "$LIST"
  count=$((count+1))
done < <(node lib/align.mjs --video "$VIDEO")

[ "$count" -gt 0 ] || { echo "no VO clips to concat"; exit 1; }
VO="$OUT/${VIDEO}.vo.wav"
ffmpeg -y -v error -f concat -safe 0 -i "$LIST" -c copy "$VO"
echo "concatenated $count clip(s) (padded to scene lengths) -> $VO"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$VO" | xargs printf "  vo track: %ss\n"
