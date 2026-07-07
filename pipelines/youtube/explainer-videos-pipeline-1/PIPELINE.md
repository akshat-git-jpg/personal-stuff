# explainer-videos-pipeline-1

One linear pipeline that turns a topic + three independently-chosen competitor
channel styles (script, motion-graphics, thumbnail) into a published-ready
explainer video draft. No screen recording, no avatar — fully generated via
Hyperframes motion graphics timed to a synthesized voiceover.

## The flow (run top to bottom)

| # | Step | Actor | In → Out |
|---|------|-------|----------|
| 0/010 | `create-drive-folders` | [RUN] | `--topic` → `<base>` manifest + Drive/local input+output folders |
| 1 | `research` | — | intentionally empty — no automation |
| 2/010 | `write-script` | [OPUS] | `--slug --topic` → script.md cloned from a competitor channel's voice (plan 045) |
| 2/020 | `review-script` | [HUMAN] | resolve `[VERIFY:]` placeholders, approve (plan 045) |
| 2/030 | `clean-script-for-tts` | [RUN] | strip markdown/comments → TTS-ready text (plan 045) |
| 3/010 | `synthesize-voice` | [RUN] | TTS via Modal IndexTTS-2, fixed reference voice (plan 046) |
| 3/020 | `trim-silence` | [RUN] | (plan 046) |
| 3/030 | `voice-autoqc` | [RUN] | (plan 046) |
| 3/040 | `review-voice` | [HUMAN] | (plan 046) |
| 3/050 | `make-timestamped-transcript` | [RUN] | the timing spine for stage 4 (plan 046) |
| 4/010 | `plan-visuals` | [OPUS] | `--slug` → timed visual plan from video-style-dna.md (plan 047) |
| 4/020 | `build-graphics` | [AGY] | authors + renders Hyperframes composition (plan 047) |
| 4/030 | `review-visuals` | [HUMAN] | (plan 047) |
| 5/010 | `mux-final-video` | [RUN] | voice + graphics → final MP4, duration-asserted (plan 048) |
| 6/010 | `generate-thumbnail` | [OPUS] | `--slug` → Hyperframes snapshot styled thumbnail (plan 049) |
| 7/010 | `package-for-handoff` | [RUN] | final MP4 + thumbnail → topic's output/ folder (plan 050) |

## Layout

```
explainer-videos-pipeline-1/
  PIPELINE.md            ← this file (the map)
  lib/                   ← shared logic (audio, asr, chunking, modal_tts, drive)
  shared/ref/            ← the fixed reference voice
  0-input/ 1-research/ … 7-upload/
    <NNN-name-actor>/
      README.md
      run.py | rulebook.md
      output/
```

## Conventions
- ×10 numbering per stage (010, 020, 030 …).
- Actor suffix names the executor: `-run` / `-opus` / `-agy` / `-human`.
- Independent `--slug` per style-cloning step (2-scripting, 4-motion-graphics,
  6-thumbnail) — three separate competitor-channel choices by design.
- Every DNA-consuming step hard-stops (never auto-builds) if the named
  channel's `script-style-dna.md` / `video-style-dna.md` is missing.

## Status
Built across plans 044 (this scaffold) through 050. See `plans/README.md`.
