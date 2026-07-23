#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ $# -lt 2 ]; then
  echo "usage: bash run.sh <slug> <verb>"
  exit 2
fi

slug="$1"
verb="$2"

TP3_ROOT="${TP3_ROOT:-$(pwd)}"

case "$verb" in
  status)
    script_json="$TP3_ROOT/videos/$slug/script.json"
    if [ -f "$script_json" ]; then
      echo "script.json: present"
      node -e "const fs = require('fs'); const obj = JSON.parse(fs.readFileSync('$script_json', 'utf8')); console.log('stage: ' + obj.stage);"
    else
      echo "script.json: missing"
    fi
    ;;
  010)
    node lib/init-video.mjs "$slug" --root "$TP3_ROOT"
    ;;
  lint)
    node lib/lint-script.mjs "$TP3_ROOT/videos/$slug/script.json"
    ;;
  render)
    node lib/render-script-md.mjs "$slug" --root "$TP3_ROOT"
    ;;
  publish)
    node lib/publish-ui.mjs "$slug" --root "$TP3_ROOT" ${3:+--drive-url "$3"}
    ;;
  pull)
    node lib/pull-ui.mjs "$slug" --root "$TP3_ROOT"
    ;;
  pull-audio)
    node lib/pull-audio.mjs "$slug" --root "$TP3_ROOT"
    ;;
  pull-recordings)
    node lib/drive-pull.mjs "$slug" --root "$TP3_ROOT"
    ;;
  qc)
    node lib/intake-qc.mjs "$slug" --root "$TP3_ROOT"
    node lib/filmstrip.mjs "$slug" --root "$TP3_ROOT"
    ;;
  handoff)
    node lib/handoff.mjs "$slug" --root "$TP3_ROOT"
    ;;
  gate)
    node lib/lint-script.mjs "$TP3_ROOT/videos/$slug/script.json" --stage polished
    ;;
  *)
    echo "Unknown verb: $verb"
    echo "usage: bash run.sh <slug> <status|010|lint|render|publish|pull|pull-audio|pull-recordings|qc|handoff|gate>"
    exit 2
    ;;
esac
