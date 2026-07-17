#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
slug="$1"; shift
cd "videos/$slug"

# Accept video input too: if vo.mp3 is absent, extract it from a video/audio file.
if [ ! -f vo.mp3 ]; then
  for v in vo.mp4 vo.mov vo.mkv vo.m4a vo.wav; do
    if [ -f "$v" ]; then
      echo "no vo.mp3 — extracting audio from $v"
      ffmpeg -y -loglevel error -i "$v" -vn -c:a libmp3lame -q:a 2 vo.mp3
      break
    fi
  done
fi
if [ ! -f vo.mp3 ]; then
  echo "error: videos/$slug needs vo.mp3 (or vo.mp4/mov/mkv/m4a/wav to extract from)" >&2
  exit 1
fi

npx hyperframes@latest transcribe vo.mp3 --json -m small.en "$@"
