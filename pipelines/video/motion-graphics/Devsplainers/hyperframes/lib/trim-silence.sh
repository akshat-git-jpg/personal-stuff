#!/bin/bash
# trim-silence.sh — step 050. Trim leading/trailing silence from each VO clip so
# per-scene cuts aren't gappy.
#   bash lib/trim-silence.sh --video <slug>
# In:  videos/<slug>/audio/beatNN.wav   Out: videos/<slug>/audio/beatNN.trim.wav
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
VIDEO="test"
while [ $# -gt 0 ]; do case "$1" in --video) VIDEO="$2"; shift 2 ;; *) echo "unknown arg: $1"; exit 2 ;; esac; done
AUD="videos/$VIDEO/audio"
[ -d "$AUD" ] || { echo "no audio dir: $AUD (run step 040 first)"; exit 2; }
# trim front, reverse, trim front again (= trim back), reverse back
FILT="silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:detection=peak,areverse,silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:detection=peak,areverse"
n=0
for f in "$AUD"/beat*.wav; do
  case "$(basename "$f")" in *.trim.wav) continue ;; esac
  out="${f%.wav}.trim.wav"
  ffmpeg -y -i "$f" -af "$FILT" "$out" >/dev/null 2>&1
  n=$((n+1))
done
echo "trimmed $n clip(s) -> $AUD/*.trim.wav"
