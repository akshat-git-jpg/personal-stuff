# 010 · transcribe · [RUN] (first step)

- **In:** `videos/<slug>/vo.mp3` (the video's TTS voiceover, from the tts hub)
- **Out:** `videos/<slug>/transcript.json` (word-level timestamps)
- **Run:** `bash run.sh <slug>`
  (equivalent to `cd videos/<slug> && npx hyperframes@latest transcribe vo.mp3 --json -m small.en`)
- **Next:** step 020 — the cue pass reads `transcript.json`

Needs `.npmrc` at the pipeline root (already present) so `npx` resolves the public
registry instead of the work registry that 401s.
