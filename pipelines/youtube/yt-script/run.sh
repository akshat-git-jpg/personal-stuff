#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ $# -lt 2 ]; then
  echo "usage: bash run.sh <key> <status|vo|vo-lock>"
  exit 2
fi

key="$1"
verb="$2"

YTS_ROOT="${YTS_ROOT:-$(pwd)}"
# The voiceover engine lives in the TTS hub, never in this pipeline
# (pipelines/video/tts/CLAUDE.md, plan 251). --root is the whole contract.
TTS_LIB="../../video/tts/lib"

case "$verb" in
  status)
    script_json="$YTS_ROOT/videos/$key/script.json"
    if [ -f "$script_json" ]; then
      echo "script.json: present"
      node -e "const o=require('fs').readFileSync('$script_json','utf8');const s=JSON.parse(o);console.log('stage: '+s.stage);console.log('sections: '+s.sections.length);console.log('locked: '+s.sections.filter(x=>x.tts&&x.tts.locked).length);"
    else
      echo "script.json: missing"
    fi
    ;;
  vo)
    node "$TTS_LIB/vo-synth.mjs" "$key" --root "$YTS_ROOT" "${@:3}"
    ;;
  vo-lock)
    node "$TTS_LIB/vo-lock.mjs" "$key" --root "$YTS_ROOT" "${@:3}"
    ;;
  *)
    echo "usage: bash run.sh <key> <status|vo|vo-lock>"
    exit 2
    ;;
esac
