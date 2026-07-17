# 010 · transcribe · [RUN] (first step)

- **In:** `videos/<slug>/vo.mp3` — or a video/audio file to extract it from
  (`vo.mp4`/`vo.mov`/`vo.mkv`/`vo.m4a`/`vo.wav`; run.sh ffmpeg-extracts `vo.mp3` first,
  since the later steps — board slices, render — need the mp3)
- **Out:** `videos/<slug>/transcript.json` (word-level timestamps) + `vo.mp3` if extracted
- **Run:** `bash run.sh <slug>`
  (equivalent to `cd videos/<slug> && npx hyperframes@latest transcribe vo.mp3 --json -m small.en`)
- **Next:** step 020 — the cue pass reads `transcript.json`

Needs `.npmrc` at the pipeline root (already present) so `npx` resolves the public
registry instead of the work registry that 401s.
