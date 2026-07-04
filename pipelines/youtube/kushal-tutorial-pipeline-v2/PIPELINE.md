# kushal-tutorial-pipeline-v2 (v3 flow)

One linear pipeline that turns a topic into a published-ready tutorial draft cut:
research brief → freelancer screen recording → clean script → brand-voice voiceover →
avatar clips → rendered graphics → an auto-assembled draft cut. The editor role is
optional QC, not timeline work. Each step is a folder under `steps/`, numbered in run
order, owning its own `output/`.

`SPEC.md` is the why (design + decisions); this file is the how (run order).

## Who does what, and what it costs

Everything runs locally on your machine. No VPS, no API keys for LLM work.

| Actor | Tag | What it does | Cost |
|---|---|---|---|
| Antigravity | `[ANTIGRAVITY]` | research brief, transcript clean, avatar-block plan | your Antigravity sub |
| Sonnet | `[SONNET]` | script polish + segment map, visual plan, graphics build (Claude Code on model Sonnet) | your Claude sub |
| Run | `[RUN]` | deterministic scripts: transcribe, TTS, trim, QC, assembly math, ffmpeg cut | free (Groq/Modal pennies) |
| Human | `[HUMAN]` | recorder (015) and your review gates | your minutes |

Opus/Fable is not in the loop for any per-video step. Antigravity steps hand off as
paste-ready prompts (`rulebook.md` in each `-antigravity` step); Sonnet steps run in a
Claude Code session switched to Sonnet.

## The timing spine (why no editor is needed)

The voiceover is generated from the recording's own transcript, so script and footage
are causally linked. Step 040 preserves that link as a segment map: each script block
knows which span of the raw recording it came from (timestamps from ASR). After TTS,
each block also knows its exact voiceover duration. Assembly is then arithmetic:

**1 script block = 1 voiceover span = 1 screen slice**, retimed to fit.

Step 125 computes per-block speed/freeze adjustments (screen video tolerates both) and
flags the blocks where footage and voiceover diverge too far. Step 162 executes the plan
with ffmpeg. A human touches only the flagged blocks.

## The flow (run top to bottom)

| # | Step | Actor | In → Out |
|---|------|-------|----------|
| 000 | `research-brief` | [ANTIGRAVITY] | topic → `<base>.brief.md` (sections in recording order, checked facts) |
| 010 | `create-drive-folders` | [RUN] | `--title` → handoff tree in Drive + manifest |
| 015 | `record-screen` | [HUMAN] | brief → raw recording in Drive (recording contract in the README) |
| 020 | `transcribe-video-to-text` | [RUN] | recording → `<base>.transcript.txt` / `.json` (word timestamps) |
| 030 | `clean-and-fix-transcript` | [ANTIGRAVITY] | transcript → `<base>.clean.txt` |
| 040 | `polish-script-for-delivery` | [SONNET] | clean → `<base>.improved.txt` + `<base>.segments.json` (the segment map) |
| 050 | `review-script` | [HUMAN] | read → approve |
| 060 | `plan-avatar-blocks` | [ANTIGRAVITY] | improved → `<base>.avatar-plan.md` (draft) |
| 070 | `review-avatar-plan` | [HUMAN] | approve pre-spend → `<base>.avatar-segments.json` |
| 080 | `synthesize-voice` | [RUN] | → `<base>.voice.wav` + `avatar-audio/*.wav` (A4 per block) |
| 090 | `plan-corner-render-parts` | [RUN] | chunks → `corner-parts/*.wav` (A3, ≤7 min) |
| 100 | `trim-silence` | [RUN] | → `<base>.voice.trim.wav` |
| 105 | `voice-autoqc` | [RUN] | clips → `<base>.voice-qc.json` (WER/loudness/pace flags) |
| 110 | `review-voice` | [HUMAN] | listen to FLAGGED chunks only → redo loop or approve |
| 120 | `make-timestamped-transcript` | [RUN] | → `.srt` / `.timestamps.txt` / `.json` |
| 125 | `build-assembly-plan` | [RUN] | segment map + VO timings → `<base>.assembly-plan.json` (+ flags) |
| 130 | `plan-visuals` | [SONNET] | timestamps + brief → `<base>.visual-plan.md` (timed cues) |
| 135 | `build-graphics` | [SONNET] | visual plan → `output/clips/*.mp4` + `output/overlays/*.mov` |
| 140 | `review-visual-plan` | [HUMAN] | approve cues, spot-check rendered clips |
| 150 | `submit-avatar-videos` | [RUN] | submit HeyGen renders (web session, no polling) |
| 160 | `download-avatar-videos` | [HUMAN] | check HeyGen → download `.mp4`s |
| 162 | `auto-assemble` | [RUN] | plan + recording + VO + avatars + graphics → `<base>.draft-cut.mp4` |
| 165 | `review-draft-cut` | [HUMAN] | watch once, fix only flagged blocks → approve |
| 170 | `package-for-handoff` | [RUN] | final cut + sources → local tree; `--drive` uploads |

Two branches run in parallel after 120: the graphics branch (130 → 135 → 140) and the
avatar branch (150 → 160). Both land in 162.

```
topic
   │ 000 research brief          [ANTIGRAVITY] ⌨
   │ 010 create drive folders    [RUN]
   │ 015 record screen           [HUMAN·freelancer]  (contract: ordered sections, 2s pauses)
   │ 020 transcribe              [RUN]
   │ 030 clean transcript        [ANTIGRAVITY] ⌨
   │ 040 polish + segment map    [SONNET]   ← the map that makes 125/162 possible
   │ 050 review script           [HUMAN] ✋
   │ 060 plan avatar blocks      [ANTIGRAVITY] ⌨
   │ 070 review avatar plan      [HUMAN] ✋ pre-spend gate
   │ 080 synthesize voice        [RUN]  Modal IndexTTS-2
   │ 090 plan corner parts       [RUN]
   │ 100 trim silence            [RUN]
   │ 105 voice auto-QC           [RUN]  → flags
   │ 110 review voice            [HUMAN] ✋ flagged chunks only
   │ 120 timestamped transcript  [RUN]
   │ 125 build assembly plan     [RUN]  → retime math + flags
   ├─────────────┬──────────────────────────────
   │ 130 plan visuals [SONNET]   │ 150 submit avatars [RUN]
   │ 135 build graphics [SONNET] │ 160 download avatars [HUMAN] ✋
   │ 140 review visuals [HUMAN]✋ │
   ├─────────────┴──────────────────────────────
   │ 162 auto assemble           [RUN]  ffmpeg draft cut
   │ 165 review draft cut        [HUMAN] ✋ fix flags only
   │ 170 package for handoff     [RUN]
   ▼
published-ready draft cut (editor optional)
```

## Layout
```
kushal-tutorial-pipeline-v2/
  SPEC.md                ← the v3 design and decisions
  PIPELINE.md            ← this file (the map)
  lib/                   ← shared logic, imported by every run.py
    audio.py    (dur, mmss, to_mp3, concat)
    asr.py      (Groq Whisper transcription)
    chunking.py (sentence-packing; avatar-aware segment chunking)
    modal_tts.py(the IndexTTS-2 Modal call)
    heygen.py   (HeyGen submit/fetch client + anti-ban pacing)
    drive.py    (pp-drive CLI wrappers)
  shared/
    pronunciation-map.md (grows — names/numbers fixed across all videos)
    ref/jamila-30s.wav   (the fixed brand voice)
    heygen_config.py     (avatar knobs incl. corner position/scale)
  steps/<NNN-name-actor>/
    README.md            (the step's card: what · in · out · how)
    run.py | rulebook.md (the implementation; rulebook = paste prompt or Claude Code rules)
    output/              (this step's artifacts)
```

## Conventions
- ×10 numbering with room between (015, 105, 125, 135, 162, 165 slot in without renumbering).
- The actor suffix names the executor: `-run` / `-antigravity` / `-sonnet` / `-human`.
- Every step folder has a `README.md` + one implementation file + an `output/`.
- A step reads `../<prev>/output/…` and writes `./output/…`. Shared code goes in `lib/`.
- `[ANTIGRAVITY]` rulebooks are self-contained paste prompts. `[SONNET]` rulebooks are run
  in a Claude Code session on model Sonnet (`/model sonnet` first).

## Status
Steps 000, 015, 105, 125, 135, 162, 165 are v3 additions. All steps (105, 125, 162) are now fully implemented and 040 emits the segment map (via `plans/011-tutorial-pipeline-v3.md`). Step 135's rulebook is stubbed waiting for a Claude Code session with hyperframes skills. Everything from v2 (080-160 voice + avatar machinery) is unchanged and working as documented in `HANDOVER.md`.
