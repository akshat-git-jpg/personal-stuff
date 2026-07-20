#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

usage() { echo "Usage: scripts/qc-video.sh <slug> [--final]"; exit 1; }
[[ $# -ge 1 ]] || usage
SLUG="$1"; shift
VARIANT="final-draft"
[[ "${1:-}" == "--final" ]] && VARIANT="final"

WORKDIR="videos/$SLUG"
MEDIA=~/kb-scratch/video/visuals-flow/$SLUG
VIDEO="$MEDIA/$VARIANT.mp4"
QC="$MEDIA/qc"
[[ -f "$VIDEO" ]] || { echo "missing $VIDEO — run the assemble step first"; exit 1; }
[[ -f "$WORKDIR/assembly.md" ]] || { echo "missing $WORKDIR/assembly.md"; exit 1; }
rm -rf "$QC"; mkdir -p "$QC"

node lib/qc-plan.mjs "$SLUG" --out "$QC/events.json" --checklist "$QC/checklist.md" --variant "$VARIANT"

# waveform of the muxed audio (whole video, one image)
ffmpeg -y -i "$VIDEO" -filter_complex "aformat=channel_layouts=mono,showwavespic=s=3840x256:colors=white" -frames:v 1 "$QC/waveform.png" >/dev/null 2>&1

# overview strips: 1 frame / 10s, 6x5 tiles (same recipe as analyze-reference.sh)
ffmpeg -y -i "$VIDEO" -vf "fps=1/10,scale=320:-1,tile=6x5" "$QC/overview-%d.jpg" >/dev/null 2>&1

# one 30fps sheet per event (window starts 0.7s before the event)
node -e "
const evs = JSON.parse(require('fs').readFileSync('$QC/events.json', 'utf8'));
for (const e of evs) console.log(Math.max(0, e.t - 0.7).toFixed(3), e.sheet);
" | while read -r start sheet; do
  ffmpeg -y -ss "$start" -t 1.4 -i "$VIDEO" -vf "fps=30,scale=480:-1,tile=4x11" "$QC/$sheet" >/dev/null 2>&1
done

COUNT=$(ls "$QC" | grep -c '^event-' || true)
EXPECTED=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$QC/events.json','utf8')).length)")
[[ "$COUNT" -eq "$EXPECTED" ]] || { echo "sheet count $COUNT != events $EXPECTED — a sheet failed to render"; exit 1; }
echo "qc pack ready: $QC ($EXPECTED event sheets + overviews + waveform + checklist.md)"
