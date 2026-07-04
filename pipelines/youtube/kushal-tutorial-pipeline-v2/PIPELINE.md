# kushal-tutorial-pipeline-v2

One linear pipeline that turns a tutorial screen-recording into an editor-ready package:
a clean script, a brand-voice voiceover, the full-screen avatar clips, and a visual plan.
Each step is a folder under `steps/`, numbered in run order, owning its own `output/`.

## The flow (run top to bottom)
Each step reads the previous step's `output/` and writes its own. `[RUN]` = a script you run;
`[CLAUDE]` = a rulebook Claude applies; `[HUMAN]` = a review gate.

| # | Step | Type | In → Out |
|---|------|------|----------|
| 010 | `create-drive-folders` | [RUN] | `--title` → empty handoff tree in Drive under `video production/` + `<title>.drive-folders.json` |
| 020 | `transcribe-video-to-text` | [RUN] | Drive video URL → `<base>.transcript.txt` / `.json` |
| 030 | `clean-and-fix-transcript` | [CLAUDE] | `…transcript.txt` → `<base>.clean.txt` |
| 040 | `polish-script-for-delivery` | [CLAUDE] | `…clean.txt` → `<base>.improved.txt` |
| 050 | `review-script-human` | [HUMAN] | read the script → approve to proceed |
| 060 | `plan-avatar-blocks` | [CLAUDE] | `…improved.txt` → `<base>.avatar-plan.md` (draft) |
| 070 | `review-avatar-plan-human` | [HUMAN] | approve the plan (pre-spend) → `<base>.avatar-segments.json` |
| 080 | `synthesize-voice` | [RUN] | `…avatar-segments.json` → `<base>.voice.wav` + `avatar-audio/*.wav` (A4 per-block) + `<base>.avatar-fullscreen.md` |
| 090 | `plan-corner-render-parts` | [RUN] | step 080 chunks → `corner-parts/<base>__a3__corner[-pNN].wav` (≤7-min, A3) |
| 100 | `trim-silence` | [RUN] | `…voice.wav` → `<base>.voice.trim.wav` |
| 110 | `review-voice-human` | [HUMAN] | listen → flag bad chunks (redo loop) or approve |
| 120 | `make-timestamped-transcript` | [RUN] | `…voice.trim.wav` → `<base>.srt` / `.timestamps.txt` / `.json` |
| 130 | `plan-visuals` | [CLAUDE] | `…timestamps.txt` + avatar plan → `<base>.visual-plan.md` |
| 140 | `review-visual-plan-human` | [HUMAN] | review the editor plan → approve |
| 150 | `submit-avatar-videos` | [RUN] | `run-a4.py` (per-block) + `run-a3.py` (corner parts) → submit HeyGen renders (web session, no polling) |
| 160 | `download-avatar-videos-human` | [HUMAN] | check HeyGen → download finished `.mp4`s into `output/videos/` (`check.py` verifies; `download.py` when the API is wired) |
| 170 | `package-for-handoff` | [RUN] | all outputs → local `video-editor/input` tree; `--drive` uploads them into step 010's Drive folders |

```
[ 010 create drive folders   [RUN]   → empty tree in Drive/video production + manifest (run first) ]
Drive video
   │ 020 transcribe             [RUN]
   │ 030 clean                  [CLAUDE]
   │ 040 polish                 [CLAUDE]
   │ 050 review script human    [HUMAN] ✋
   │ 060 plan avatar blocks     [CLAUDE]  (draft)
   │ 070 review avatar plan human [HUMAN] ✋ pre-spend gate → avatar-segments.json
   │ 080 synthesize voice       [RUN]   → voice.wav + avatar-audio/*.wav (A4) (+ avatar-fullscreen.md)
   │ 090 plan corner parts      [RUN]   → corner-parts/*.wav (A3, ≤7-min, grouped from chunks)
   │ 100 trim silence           [RUN]
   │ 110 review voice human     [HUMAN] ✋ (redo loop here)
   │ 120 timestamped transcript [RUN]   → srt + timestamps
   │ 130 plan visuals           [CLAUDE] → visual-plan.md
   │ 140 review visual plan human [HUMAN] ✋
   │ 150 submit avatar videos   [RUN]   → run-a4.py + run-a3.py (web session, no polling)
   │ 160 download avatar videos [HUMAN] ✋ check HeyGen → download .mp4s (check.py)
   │ 170 package for handoff    [RUN]   → local tree; --drive uploads files into step 010's folders
   ▼
editor cuts in their NLE  (corner avatar always on; full-screen clips dropped at their timestamps)
```

## Layout
```
kushal-tutorial-pipeline-v2/
  PIPELINE.md            ← this file (the map)
  lib/                   ← shared logic, imported by every run.py
    audio.py    (dur, mmss, to_mp3, concat)
    asr.py      (Groq Whisper transcription)
    chunking.py (sentence-packing; avatar-aware segment chunking)
    modal_tts.py(the IndexTTS-2 Modal call)
    heygen.py   (HeyGen submit/fetch client + anti-ban pacing)
    drive.py    (pp-drive CLI wrappers — steps 010 + 170)
  shared/
    pronunciation-map.md (grows — names/numbers fixed across all videos)
    ref/jamila-30s.wav   (the fixed brand voice)
  steps/<NNN-name>/
    README.md            (the step's card: what · in · out · how)
    run.py | rulebook.md (the implementation)
    output/              (this step's artifacts)
```

## Conventions (what makes it scalable)
- **×10 numbering (010, 020, 030…)** — drop a `015-…` between 010 and 020 without renumbering
  anything. Three digits, zero-padded, so folders always sort in run order.
- **Uniform step anatomy** — every step folder has a `README.md` + one implementation file
  (`run.py` for [RUN], `rulebook.md` for [CLAUDE]) + an `output/`.
- **Each step owns its output** — a step reads `../<prev>/output/…` and writes `./output/…`.
- **Shared code lives in `lib/`** — change a primitive once, every step gets it.
- **Config + growing assets live in `shared/`** — pronunciation map, brand voice, avatar knobs.

## Adding a step later
1. `mkdir steps/015-my-step/output`, add `README.md` + `run.py`/`rulebook.md`.
2. Point its input at the upstream step's `output/`; write to its own `output/`.
3. Add a row to the table above. Done — numbers leave room, nothing else moves.
