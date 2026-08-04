# 010 · transcribe · [RUN] (first step)

- **In:** `videos/<slug>/vo.mp3` — or a video/audio file to extract it from
  (`vo.mp4`/`vo.mov`/`vo.mkv`/`vo.m4a`/`vo.wav`; run.sh ffmpeg-extracts `vo.mp3` first,
  since the later steps — board slices, render — need the mp3); optionally
  `videos/<slug>/script.txt` (see below)
- **Out:** `videos/<slug>/transcript.json` (word-level timestamps) + `vo.mp3` if extracted
- **Run:** `bash run.sh <slug>` — tries Groq `whisper-large-v3-turbo` first
  (`GROQ_API_KEY` from `~/.zshenv`; ~30s for a 30-min VO, word timestamps, better
  proper-noun spelling), falls back to local whisper
  (`npx hyperframes@latest transcribe vo.mp3 --json -m small.en`, ~8 min) when the
  key is missing or the API errors. Both write the same flat
  `[{text,start,end}]` transcript.json.
- **Next:** step 015 maps the segments; 020 and 030 then read `transcript.json`

**Transcript quality pass (before the cue pass, always — plan 149).** Whisper's
punctuation is a prosody guess, not a proofread, and step 110 burns captions
from transcript words VERBATIM — commas, run-ons, and brand-name garbles all
ship onto the final video unedited unless fixed here. `run.sh` always keeps
the raw engine output as `transcript.<engine>-raw.bak.json` first, then runs
one of two modes, machine-gated by `lib/transcript-quality.mjs`'s
`checkTimingIntegrity()` so a text edit can never desync captions from the
audio:

- **`script.txt` present → script-first mode (automatic).** The voiceover was
  read from a script, so the script text is authoritative. `run.sh` aligns it
  to the ASR word times itself: `node lib/transcript-quality.mjs align <slug>`.
- **`script.txt` absent → cleanup pass (default; manual/LLM).** The voiceover
  is improvised over a screen recording, so an LLM cleanup pass repunctuates
  the transcript, fixes brand names, and trims leading discourse fillers
  ("Now,", "So,", "Right,", "Okay,") — **never grammar or phrasing**, since a
  caption that visibly differs from the audio reads as a subtitling error.
  Feed `cleanup-prompt.md` plus the transcript to your executor, save its
  cleaned word list as JSON, then apply it:
  `node lib/transcript-quality.mjs apply <slug> <cleaned.json>`.

Either mode **fails loudly and leaves `transcript.json` as the raw ASR
output** if the result doesn't pass `checkTimingIntegrity()` — a cleanup that
breaks word timing is a worse defect than the punctuation it set out to fix.
Do this BEFORE any anchor exists — anchors quote the transcript verbatim, so
later text edits break them. (Fold 2026-07-20, test-02: 67 single-word fixes +
7 pair merges predates this pass and still applies as `lib/captions.mjs`'s
`mergeBrandWords` last-line-of-defence.)

Needs `.npmrc` at the pipeline root (already present) so `npx` resolves the public
registry instead of the work registry that 401s.
