# TTS flow — pluggable local-TTS voiceover pipeline

**Date:** 2026-06-20
**Status:** Approved design; first increment (Kokoro sample) in progress.

## Goal

Turn a tutorial-maker's messy, male-voiced screen recording into a CLEAN, clear,
accent-neutral female voiceover that stays in sync with the video — with **no recurring
cost**. The system must let us trial different open-source TTS engines (Kokoro, IndexTTS2,
Qwen-TTS, …) easily, each isolated in its own folder.

See `TY/video-voice/tts-flow/CLAUDE.md` for the why (RVC can't fix delivery; only
regenerating from corrected text can) and `TY/video-voice/RVC-flow/CLAUDE.md` for the
rejected-but-kept fallback.

## Requirements

- Output: clean female narration — no pronunciation/punctuation errors, proper sentence
  breaks, good pacing, accent-neutral, synced to the on-screen video.
- No recurring/subscription cost → local/open-source TTS only (ElevenLabs is the quality
  benchmark but is rejected by the no-recurring constraint unless local genuinely fails).
- Engines must be swappable for trial-and-error; each engine self-contained in its folder.
- Eventually: runs on the Hostinger VPS (2 vCPU, 7.8 GB RAM, no GPU, no swap) behind a
  simple web UI a non-techy editor drives.

## Architecture — CLI-subprocess seam

The shared pipeline NEVER imports a TTS engine (their deps are mutually incompatible).
It calls each engine as a **subprocess across a fixed contract**. Engine internals (venv,
models, framework) are fully isolated. Adding an engine = adding a folder that honors the
contract; the pipeline code does not change.

### Folder structure

```
tts-flow/
├── CLAUDE.md
├── pipeline/                  # SHARED, stable deps (faster-whisper + ffmpeg)
│   ├── transcribe.py          # video → segments.json (sentence + word timestamps)
│   ├── assemble.py            # per-segment wavs + timestamps → synced track → mux  [DEFERRED]
│   └── run.py                 # orchestrator: --engine <name> ties stages together   [DEFERRED]
├── engines/
│   └── kokoro/                # SELF-CONTAINED per engine
│       ├── ADAPTER.md         # setup + run notes for this engine
│       ├── setup.sh           # builds ITS OWN venv, downloads ITS model
│       ├── synth.py           # THE CONTRACT (below)
│       ├── config.json        # engine-specific knobs (voice, speed, lang)
│       └── venv/ models/      # gitignored
└── work/                      # per-job IO (gitignored)
```

### The engine contract

Every engine exposes a `synth.py`, run by that engine's OWN venv, that:

- **reads** a `segments.json`: `[{ "id": "0001", "text": "..." }, ...]`
- **writes** one `<id>.wav` per segment into a given output directory
- loads its model **once** per process (segments looped in-process)
- reads engine-specific settings (voice, speed, …) from its own `config.json`

Invocation by the orchestrator:
`engines/<name>/venv/bin/python engines/<name>/synth.py <segments.json> <out_dir>`

This subprocess boundary is the entire flexibility mechanism. The pipeline only knows
"give text, get wavs." Voice selection is the engine's concern (Kokoro = preset voice id;
IndexTTS2/F5 later = a reference clip to clone).

## Sync method (for the deferred assemble stage)

faster-whisper gives each segment a start time. Each regenerated TTS wav is placed at its
**original** segment start time on a silent timeline (stretch/pad to fit), NOT glued
end-to-end. Anchoring re-pins every segment to truth, so timing errors never accumulate
into whole-video drift — only tiny per-segment wobble, invisible for narration-over-screen.

## Increment plan

**Increment 1 (now): prove Kokoro quality before building the machine.**
1. Folder skeleton + engine contract.
2. Kokoro engine: `setup.sh` (own venv + model) and `synth.py` honoring the contract.
3. Build `segments.json` from the existing transcript
   (`personal-stuff/docs/voice-pipeline-test/transcript.json`).
4. Synthesize → one continuous sample MP3 for the user to judge against the RVC clips.

Acceptance: user listens and decides if local-TTS quality clears the bar.

**Deferred until Kokoro passes:**
- `assemble.py` (anchoring + mux) and `run.py` orchestrator.
- The editor's transcript-fix step (fix names, punctuation, split run-ons).
- Additional engines (IndexTTS2, Qwen-TTS) via the same contract.
- VPS deployment + web UI (upload → fix transcript → generate → download synced video).

## Engine candidates (for later trials)

| Engine     | Fit |
|------------|-----|
| **Kokoro** | ~82M, fast on CPU, high quality, preset voices. Best VPS fit. FIRST. |
| IndexTTS2  | SOTA quality + voice cloning; GPU-leaning. Quality ceiling contender. |
| Qwen-TTS   | Powerful; ComfyUI dependency is heavy/GUI-oriented, awkward headless. |
| F5-TTS / Chatterbox / XTTS | Other open voice-cloning options if needed. |

## Pronunciation control

Brand names/acronyms fixed in the transcript text (phonetic respelling) or via the chosen
engine's lexicon/phoneme support. Main lever for "no pronunciation mistakes."

## Non-goals

- No real-time conversion (workflow is async upload-and-collect).
- No re-recording by freelancers (the point is to fix delivery without them).
- No paid/cloud TTS unless local definitively fails the quality bar.
