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
engine=""
if [ -n "${GROQ_API_KEY:-}" ]; then
  if node lib/transcribe-groq.mjs "$workdir"; then
    engine="groq"
  else
    echo "groq path failed — falling back to local whisper" >&2
  fi
fi
if [ -z "$engine" ]; then
  cd "$workdir"
  # Pinned version; central pin for the flow is in lib/render.mjs
  npx hyperframes@0.7.62 transcribe vo.mp3 --json -m small.en "$@"
  cd "$pipeline_root"
  engine="whisper"
fi

# Transcript quality pass (plan 149) — step 090 burns captions from transcript
# words VERBATIM, so raw ASR punctuation ships unedited unless fixed here,
# BEFORE the cue pass reads transcript.json (anchors quote it verbatim; a
# later text edit would silently break every anchor).
raw_backup="$workdir/transcript.$engine-raw.bak.json"
cp "$workdir/transcript.json" "$raw_backup"

if [ -f "$workdir/script.txt" ]; then
  echo "script.txt present — aligning it to the ASR word times (script-first mode)"
  if ! node lib/transcript-quality.mjs align "$workdir"; then
    echo "error: script alignment failed the timing-integrity gate (see above) — transcript.json left as the raw ASR output ($raw_backup)" >&2
    exit 1
  fi
else
  cat <<EOF
No script.txt — run the ASR cleanup pass before the cue pass reads this transcript:
  1. Feed steps/010-transcribe-run/cleanup-prompt.md plus $workdir/transcript.json to your executor.
  2. Save its cleaned word list as JSON, e.g. $workdir/transcript.cleaned.json.
  3. node lib/transcript-quality.mjs apply "$workdir" "$workdir/transcript.cleaned.json"
transcript.json remains the raw ASR output ($raw_backup) until the cleanup pass is applied.
EOF
fi
