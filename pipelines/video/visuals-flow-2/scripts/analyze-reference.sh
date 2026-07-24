#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

usage() {
  echo "Usage: scripts/analyze-reference.sh <url> [--keep-video] | --self-test"
  exit 1
}

if [[ $# -eq 0 ]]; then
  usage
fi

if [[ "$1" == "--self-test" ]]; then
  echo "Running self-test..."
  OUT=~/kb-scratch/video/visuals-flow-2/_reference/self-test
  mkdir -p "$OUT"
  
  ffmpeg -f lavfi -i testsrc2=d=5 -f lavfi -i smptebars=d=5 -f lavfi -i color=c=red:d=4 -f lavfi -i color=c=white:d=0.1 -f lavfi -i color=c=red:d=5.9 -filter_complex "[0:v][1:v][2:v][3:v][4:v]concat=n=5:v=1[v]" -map "[v]" -c:v libx264 -y "$OUT/ref.mp4" >/dev/null 2>&1
  
  ffmpeg -i "$OUT/ref.mp4" -vf "select='gt(scene,0.25)',metadata=print" -an -f null - 2> "$OUT/scene.log"
  ffprobe -v error -f lavfi -i "movie=$OUT/ref.mp4,signalstats" -show_entries frame=pts_time:frame_tags=lavfi.signalstats.YAVG -of csv=p=0 > "$OUT/luma.csv"
  
  node lib/reference-moments.mjs --cli --scene-log "$OUT/scene.log" --luma-csv "$OUT/luma.csv" --out "$OUT/moments.json"
  
  MOMENT_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$OUT/moments.json', 'utf8')).length)")
  if (( MOMENT_COUNT < 2 )); then
    echo "self-test failed: expected >= 2 moments, found $MOMENT_COUNT"
    exit 1
  fi
  
  HAS_FLASH=$(node -e "
    const m = JSON.parse(require('fs').readFileSync('$OUT/moments.json', 'utf8'));
    console.log(m.some(x => x.kinds.includes('flash')) ? 'true' : 'false')
  ")
  if [[ "$HAS_FLASH" != "true" ]]; then
    echo "self-test failed: no flash moment found"
    exit 1
  fi
  
  echo "self-test OK"
  exit 0
fi

URL="$1"
shift

KEEP_VIDEO=0
if [[ "${1:-}" == "--keep-video" ]]; then
  KEEP_VIDEO=1
fi

VIDEO_ID=$(echo "$URL" | grep -oE '[a-zA-Z0-9_-]{11}' | head -n 1 || true)
if [[ -z "$VIDEO_ID" ]]; then
  echo "Could not extract video-id from URL: $URL"
  exit 1
fi

OUT=~/kb-scratch/video/visuals-flow-2/_reference/$VIDEO_ID
mkdir -p "$OUT"

if [[ ! -f "$OUT/ref.mp4" ]]; then
  yt-dlp --no-plugin-dirs -f "bv*[height<=720]+ba/b[height<=720]" --merge-output-format mp4 -o "$OUT/ref.mp4" "$URL"
fi

ffmpeg -i "$OUT/ref.mp4" -vf "select='gt(scene,0.25)',metadata=print" -an -f null - 2> "$OUT/scene.log"
ffprobe -v error -f lavfi -i "movie=$OUT/ref.mp4,signalstats" -show_entries frame=pts_time:frame_tags=lavfi.signalstats.YAVG -of csv=p=0 > "$OUT/luma.csv"

node lib/reference-moments.mjs --cli --scene-log "$OUT/scene.log" --luma-csv "$OUT/luma.csv" --out "$OUT/moments.json"

COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$OUT/moments.json', 'utf8')).length)")
echo "Found $COUNT moments"

ffmpeg -i "$OUT/ref.mp4" -vf "fps=1/10,scale=320:-1,tile=6x5" "$OUT/overview-%d.jpg" -y

node -e "
const fs = require('fs');
const moments = JSON.parse(fs.readFileSync('$OUT/moments.json', 'utf8')).slice(0, 40);
for (const m of moments) {
  let start = Math.max(0, m.t - 0.7);
  let min = Math.floor(m.t / 60).toString().padStart(2, '0');
  let sec = (m.t % 60).toFixed(1).padStart(4, '0');
  console.log(\`\${start} moment-\${min}\${sec}.jpg\`);
}
" | while read -r start sheet_name; do
  ffmpeg -ss "$start" -t 1.4 -i "$OUT/ref.mp4" -vf "fps=30,scale=480:-1,tile=4x11" "$OUT/$sheet_name" -y
done

if (( COUNT > 40 )); then
  echo "Capped moment sheets to top 40 by score."
fi

if [[ "$KEEP_VIDEO" -eq 0 ]]; then
  rm "$OUT/ref.mp4"
fi

echo "Done. Output at $OUT"
