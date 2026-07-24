#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# Do NOT add an --all or all step. The chain has three human gates 
# (owner approval at 040, the Opus-only fold at 060, live HeyGen at 080)
# and a driver that walks past them would be actively dangerous.

usage() {
  cat <<EOF
Usage: run.sh <slug> <step>

Steps:
  status
  transcribe
  concept-pass
  cue-pass
  resolve
  audit
  board
  render
  fold
  shot-pass
  shots
  avatar
  assemble
  export
  qc
EOF
}

if [[ $# -eq 0 ]] || [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
  usage
  exit 2
fi

if [[ $# -ne 2 ]]; then
  usage
  exit 2
fi

slug="$1"
step="$2"

case "$step" in
  status)
    if [[ ! -d "videos/$slug" ]]; then
      echo "no workdir: videos/$slug"
      exit 1
    fi
    
    transcript_present="missing"
    [[ -f "videos/$slug/transcript.json" ]] && transcript_present="present"
    
    segments_present="missing"
    [[ -f "videos/$slug/segments.json" ]] && segments_present="present"
    
    cues_present="missing"
    cues_approved="NOT approved"
    if [[ -f "videos/$slug/cues.json" ]]; then
      cues_present="present"
      cues_approved=$(node -e "const c=require('./videos/$slug/cues.json');console.log(c.approved?'approved':'NOT approved')")
    fi
    
    resolved_present="missing"
    [[ -f "videos/$slug/resolved.json" ]] && resolved_present="present"
    
    renders_present="missing"
    [[ -d "videos/$slug/renders/" ]] && renders_present="present"
    
    shots_present="missing"
    [[ -f "videos/$slug/shots.json" ]] && shots_present="present"
    
    echo "artifact          status"
    echo "--------          ------"
    echo "transcript.json   $transcript_present"
    echo "segments.json     $segments_present"
    echo "cues.json         $cues_present ($cues_approved)"
    echo "resolved.json     $resolved_present"
    echo "renders/          $renders_present"
    echo "shots.json        $shots_present"
    
    if [[ "$transcript_present" == "missing" ]]; then
      echo "next: run.sh $slug transcribe"
    elif [[ "$segments_present" == "missing" ]]; then
      echo "next: create segments.json (see steps/020-cue-pass-llm/README.md)"
    elif [[ "$cues_present" == "missing" ]]; then
      echo "next: run.sh $slug cue-pass"
    elif [[ "$resolved_present" == "missing" ]]; then
      echo "next: run.sh $slug resolve"
    elif [[ "$cues_approved" == "NOT approved" ]]; then
      echo "next: run.sh $slug board  (OWNER GATE)"
    elif [[ "$renders_present" == "missing" ]]; then
      echo "next: run.sh $slug render"
    elif [[ "$shots_present" == "missing" ]]; then
      echo "next: run.sh $slug shot-pass"
    else
      echo "next: run.sh $slug assemble"
    fi
    ;;

  transcribe)
    bash steps/010-transcribe-run/run.sh "$slug"
    ;;

  concept-pass)
    cat <<EOF
018 is an LLM step, not a command. Assemble the prompt:
  1. steps/018-concept-pass-llm/concept-pass-prompt.md   (the prompt; fill its placeholders)
  2. node lib/transcript-text.mjs $slug         -> {{TRANSCRIPT}}
  3. cat videos/$slug/segments.json             -> {{SEGMENTS}}
After the concept pass: node lib/lint-concept.mjs $slug
EOF
    exit 0
    ;;

  cue-pass)
    cat <<EOF
020 is an LLM step, not a command. Assemble the prompt:
  1. steps/020-cue-pass-llm/cue-pass-prompt.md   (the prompt; fill its placeholders)
  2. node lib/plan-skeleton.mjs $slug           -> {{SKELETON}}
  3. node lib/transcript-text.mjs $slug         -> {{TRANSCRIPT}}
  4. ../card-library/catalog.json                -> {{CATALOG}}
  5. videos/$slug/concept.json                  -> {{CONCEPT}}
Pre-flight: node lib/feedback-status.mjs and node lib/lint-concept.mjs $slug must exit 0.
After the cue pass: run.sh $slug resolve
EOF
    exit 0
    ;;

  resolve)
    node lib/resolve.mjs "$slug" && node lib/lint-cues.mjs "$slug"
    ;;

  audit)
    cat <<EOF
035 is an LLM step, not a command. Assemble the prompt:
  1. steps/035-cue-audit-llm/audit-prompt.md     (the prompt; fill its placeholders)
  2. node lib/transcript-text.mjs $slug         -> {{TRANSCRIPT}}
  3. cat videos/$slug/resolved.json             -> {{CUES}}
  4. node -e "const c=require('../card-library/catalog.json'); c.cards.forEach(card => console.log(card.slug + ': ' + card.purpose));" -> {{CATALOG_PURPOSES}}
After the audit pass: run.sh $slug board
EOF
    exit 0
    ;;

  board)
    bash steps/040-storyboard-review-owner/run.sh "$slug"
    ;;

  render)
    bash steps/050-render-run/run.sh "$slug"
    ;;

  fold)
    node lib/feedback-status.mjs
    echo "060 is an owner step. Proceed manually."
    exit 0
    ;;

  shot-pass)
    cat <<EOF
070 is an LLM step, not a command. Assemble the prompt:
  1. steps/070-shot-pass-llm/shot-pass-prompt.md (the prompt; fill its placeholders)
  2. node lib/plan-skeleton.mjs $slug           -> {{SKELETON}}
  3. node lib/transcript-text.mjs $slug         -> {{TRANSCRIPT}}
  4. ../card-library/catalog.json                -> {{CATALOG}}
Pre-flight: node lib/feedback-status.mjs must exit 0.
After the shot pass: run.sh $slug shots
EOF
    exit 0
    ;;

  shots)
    node lib/resolve-shots.mjs "$slug" && node lib/lint-shots.mjs "$slug"
    ;;

  avatar)
    bash steps/080-avatar-render-run/run.sh "$slug"
    ;;

  assemble)
    bash steps/090-assemble-run/run.sh "$slug"
    ;;

  export)
    bash steps/095-resolve-export-run/run.sh "$slug"
    ;;

  qc)
    bash scripts/qc-video.sh "$slug"
    ;;

  *)
    echo "unknown step: $step"
    usage
    exit 2
    ;;
esac
