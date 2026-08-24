#!/usr/bin/env bash
# verify_cuts.sh <video.mp4> <cut1> [cut2 ...]
#
# The 8-frame strip test. Tiles 8 consecutive frames spanning each cut.
# PASS CONDITION: you cannot identify which frame is the cut.
#
# Also reports per-segment motion with max_spike — a low average with a high spike
# means a LURCH. Look at the frames; never trust the average alone. That is exactly
# how the frozen-scene bug and the end_image warp bug both hid.

set -euo pipefail
VID="${1:?usage: verify_cuts.sh <video.mp4> <cut_seconds> [more cuts...]}"
shift
OUT="${VOX_VERIFY_OUT:-${TMPDIR:-/tmp}/vox_verify}"
mkdir -p "$OUT"

echo "video: $VID"
echo "strips → $OUT"
echo

for CUT in "$@"; do
  START=$(awk "BEGIN{s=$CUT-0.10; if(s<0)s=0; print s}")
  F="$OUT/cut_${CUT}.png"
  ffmpeg -v error -ss "$START" -t 0.24 -i "$VID" \
         -vf "scale=370:-1,tile=4x2" -frames:v 1 "$F" -y
  echo "  cut ${CUT}s → $F"
done

echo
echo "--- motion per segment (avg + max_spike) ---"
PREV=0
for CUT in "$@" ; do
  DUR=$(awk "BEGIN{print $CUT-$PREV}")
  printf "  %6.2f-%6.2f  " "$PREV" "$CUT"
  ffmpeg -v error -ss "$PREV" -t "$DUR" -i "$VID" \
         -vf "select=gt(scene\,0),metadata=print:file=-" -f null - 2>/dev/null \
    | grep -o "scene_score=[0-9.]*" \
    | awk -F= '{s+=$2;n++; if($2>m)m=$2} END{ if(n) printf "avg=%.4f  max_spike=%.4f\n", s/n, m; else print "no data" }'
  PREV=$CUT
done
TOTAL=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VID")
DUR=$(awk "BEGIN{print $TOTAL-$PREV}")
printf "  %6.2f-%6.2f  " "$PREV" "$TOTAL"
ffmpeg -v error -ss "$PREV" -t "$DUR" -i "$VID" \
       -vf "select=gt(scene\,0),metadata=print:file=-" -f null - 2>/dev/null \
  | grep -o "scene_score=[0-9.]*" \
  | awk -F= '{s+=$2;n++; if($2>m)m=$2} END{ if(n) printf "avg=%.4f  max_spike=%.4f\n", s/n, m; else print "no data" }'

echo
echo "Now LOOK at each strip. If you can spot the cut, it failed."
