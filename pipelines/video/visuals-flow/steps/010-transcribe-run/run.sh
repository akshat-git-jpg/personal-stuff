#!/usr/bin/env bash
set -euo pipefail
arg="${1:-}"
if [ -z "$arg" ]; then echo "usage: run.sh <slug-or-path>" >&2; exit 1; fi
shift

# Slug-or-path, mirroring the libs' resolveWorkdir: a path containing '/' or an
# existing dir is used as-is; a bare slug resolves under this pipeline's videos/.
if [[ "$arg" == */* || -d "$arg" ]]; then
  case "$arg" in
    /*) workdir="$arg" ;;
    *) workdir="$PWD/$arg" ;;
  esac
else
  workdir=""
fi

cd "$(dirname "$0")/../.."
pipeline_root="$PWD"
[ -z "$workdir" ] && workdir="$pipeline_root/videos/$arg"

if [ ! -d "$workdir" ]; then
  echo "error: workdir $workdir does not exist" >&2
  exit 1
fi

# Accept video input too: if vo.mp3 is absent, extract it from a video/audio file.
cd "$workdir"
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
  echo "error: $workdir needs vo.mp3 (or vo.mp4/mov/mkv/m4a/wav to extract from)" >&2
  exit 1
fi
cd "$pipeline_root"

# Fast path: Groq whisper-large-v3-turbo (~30s for a 30-min VO, word timestamps,
# and better proper-noun spelling than local small.en — test-01 finding).
# Falls back to local whisper when the key is missing or the API call fails.
[ -z "${GROQ_API_KEY:-}" ] && [ -f "$HOME/.zshenv" ] && source "$HOME/.zshenv" 2>/dev/null || true
if [ -n "${GROQ_API_KEY:-}" ]; then
  if node lib/transcribe-groq.mjs "$workdir"; then
    exit 0
  fi
  echo "groq path failed — falling back to local whisper" >&2
fi
cd "$workdir"
# Pinned version; central pin for the flow is in lib/render.mjs
npx hyperframes@0.7.62 transcribe vo.mp3 --json -m small.en "$@"
