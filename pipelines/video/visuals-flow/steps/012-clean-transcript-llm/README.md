# 012 · clean the transcript · [LLM] + [RUN]

- **In:** `transcript.json` (raw from ASR)
- **Out:** `transcript.json` (cleaned) + `transcript.diff.json`
- **Run:** `bash run.sh <slug> clean-transcript`

**Transcript quality pass (before the cue pass, always).** Whisper's
punctuation is a prosody guess, not a proofread, and step 110 burns captions
from transcript words VERBATIM — commas, run-ons, and brand-name garbles all
ship onto the final video unedited unless fixed here. The raw engine output
is kept as `transcript.<engine>-raw.bak.json`.

There are two modes, machine-gated by `lib/transcript-quality.mjs`'s
`checkTimingIntegrity()` so a text edit can never desync captions from the
audio:

- **`script.txt` present → script-first mode (automatic).** The voiceover was
  read from a script, so the script text is authoritative. `run.sh` aligns it
  to the ASR word times itself.
- **`script.txt` absent → cleanup pass (default; manual/LLM).** The voiceover
  is improvised over a screen recording, so an LLM cleanup pass repunctuates
  the transcript, fixes brand names, and trims leading discourse fillers
  ("Now,", "So,", "Right,", "Okay,") — **never grammar or phrasing**, since a
  caption that visibly differs from the audio reads as a subtitling error.
  `run.sh <slug> clean-transcript` will guide you through running the prompt and applying the result.

Either mode **fails loudly and leaves `transcript.json` as the raw ASR
output** if the result doesn't pass `checkTimingIntegrity()` — a cleanup that
breaks word timing is a worse defect than the punctuation it set out to fix.
Do this BEFORE any anchor exists — anchors quote the transcript verbatim, so
later text edits break them. (Fold 2026-07-20, test-02: 67 single-word fixes +
7 pair merges predates this pass and still applies as `lib/captions.mjs`'s
`mergeBrandWords` last-line-of-defence.)
