#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

slug="${1:-}"
step="${2:-}"

if [[ -z "$slug" || -z "$step" ]]; then
  echo "Usage: bash run.sh <slug> <step>"
  exit 1
fi

if [[ "$step" == "status" ]]; then
  artifacts=(
    "input/intro.mp4"
    "vo.mp3"
    "screen.mp4"
    "transcript.json"
    "avatar.mp4"
    "screenplay.json"
    "film/index.html"
    "renders/intro-film.mp4"
    "out/intro.mp4"
  )
  for a in "${artifacts[@]}"; do
    if [[ -f "videos/$slug/$a" ]]; then
      echo "[x] $a"
    else
      echo "[ ] $a"
    fi
  done
  
  if [[ ! -f "videos/$slug/input/intro.mp4" ]]; then
    echo "Next: 010-intake-run (needs input/intro.mp4)"
  elif [[ ! -f "videos/$slug/vo.mp3" || ! -f "videos/$slug/screen.mp4" || ! -f "videos/$slug/transcript.json" ]]; then
    echo "Next: 010-intake-run"
  elif [[ ! -f "videos/$slug/avatar.mp4" ]]; then
    echo "Next: 015-avatar-clip-human"
  elif [[ ! -f "videos/$slug/screenplay.json" ]]; then
    echo "Next: 020-write-screenplay-llm"
  elif [[ ! -f "videos/$slug/film/index.html" ]]; then
    echo "Next: 030-author-film-llm"
  elif [[ ! -f "videos/$slug/renders/intro-film.mp4" ]]; then
    echo "Next: 040-render-run"
  elif [[ ! -f "videos/$slug/out/intro.mp4" ]]; then
    echo "Next: 060-deliver-run"
  else
    echo "Done!"
  fi
  exit 0
fi

if [[ "$step" == "intake" ]]; then
  node -e "
    import { runIntake } from './lib/intake.mjs';
    import { runTranscribe } from './lib/transcript.mjs';
    runIntake('$slug');
    runTranscribe('$slug');
  "
  exit 0
fi

if [[ "$step" == "avatar-check" ]]; then
  node -e "
    import { checkAvatarClip } from './lib/avatar.mjs';
    const r = checkAvatarClip('$slug');
    if (!r.ok) {
      console.error(r.reason);
      process.exit(1);
    }
    console.log('avatar clip ok:', r.duration, 's');
  "
  exit 0
fi

if [[ "$step" == "screenplay" ]]; then
  node -e "
    import fs from 'node:fs';
    import { transcriptText } from './lib/transcript.mjs';
    import { resolveWorkdir } from './lib/workdir.mjs';
    const workdir = resolveWorkdir('$slug');
    const transcript = JSON.parse(fs.readFileSync(workdir + '/transcript.json', 'utf8'));
    const intake = JSON.parse(fs.readFileSync(workdir + '/intake.json', 'utf8'));
    const text = transcriptText(transcript);
    let prompt = fs.readFileSync('steps/020-write-screenplay-llm/screenplay-prompt.md', 'utf8');
    prompt = prompt.replace('{{TRANSCRIPT}}', text);
    prompt = prompt.replace('{{INTRO_DURATION}}', intake.duration);
    prompt = prompt.replace(/\{\{SLUG\}\}/g, '$slug');
    console.log(prompt);
  "
  exit 0
fi

if [[ "$step" == "lint" ]]; then
  node lib/lint-screenplay.mjs "$slug"
  exit $?
fi

if [[ "$step" == "author" || "$step" == "render" || "$step" == "critique" || "$step" == "deliver" ]]; then
  echo "not built yet — see plans/181, plans/182"
  exit 1
fi

echo "Unknown step: $step"
echo "Known steps: status, intake, avatar-check, screenplay, lint, author, render, critique, deliver"
exit 1
