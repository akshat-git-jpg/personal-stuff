---
name: video-and-tts-reference
description: Use when reasoning about TTS voiceover, voice cloning, audio↔video sync, Whisper transcription, avatar/lip-sync generation, or GPU-vs-local placement in personal-stuff — picking a TTS engine, explaining why swapping narration desyncs a video, estimating per-video costs, weighing HeyGen vs fal-lipsync, or deciding whether a step needs Modal GPU. Also use when a TTS/avatar "improvement" idea might re-litigate a settled decision (VO-first, IndexTTS-2, fal-lipsync deferral).
---

# Video + TTS reference (the theory as used HERE)

## Overview

This repo replaces human narration and human on-camera presence with generated assets: **TTS voiceover** (IndexTTS-2 cloning a reference voice, synth on Modal GPU) and **avatar clips** (HeyGen today; a validated-but-deferred fal.ai lip-sync path). The load-bearing decision (2026-07-12): new videos are **VO-first** — the voiceover is generated FIRST and the tutorial maker records the screen while listening to it, so sync is frame-perfect by construction and the whole dub-sync machinery below applies only to dubbing pre-existing recordings. Asset hubs: `pipelines/video/tts/` (voices) and `pipelines/video/heygen/` (avatars); generated media lives OUTSIDE the repo in `~/kb-scratch/video/{tts,heygen}/<pipeline>/` with a manifest row in `OUTPUTS.md`/`RENDERS.md`.

## Voice cloning theory

- **Zero-shot cloning** = the engine clones a voice from one short reference clip at inference time — no training or fine-tuning. OmniVoice and IndexTTS-2 both work this way: they need a **5–10s clean clip** of the target voice (auto-transcribed by the engine's built-in Whisper).
- **The reference clones STYLE and energy, not just timbre** (timbre = the tonal color of a voice). A calm reference → plain, flat output; a livelier reference is the cheapest lever for more energetic delivery — no engine change needed. (The original 4-engine benchmarks used a throwaway Kokoro-generated reference clip, so they *sound* robotic — that was the reference, not the engines.)
- **Emotion control**: IndexTTS-2 has true emotion parameters — `emo_vector`, `emo_audio_prompt`, `use_emo_text`, `emo_text`. The Modal wrapper (`modal/indextts2_app.py`) currently exposes `emo_text` + `interval_silence` (default 200ms between sentences). OmniVoice has NO emotion control — its `instruct` vocabulary is only voice attributes (gender, age, pitch, whisper, accents), verified against `_INSTRUCT_VALID_EN`.
- **Why not ElevenLabs**: it is the quality benchmark but bills per generation. The owner's hard constraint is **no recurring/subscription cost**, so any per-generation API is ruled out; only local/open-source engines qualify (Modal GPU compute for synth is the accepted exception — ~$0.50/video, see costs below).
- **Why TTS and not voice conversion (RVC)**: RVC is a voice skin — it copies the source recording's accent, pacing, and mispronunciations exactly. Fixing *how words are said* requires regenerating speech from corrected TEXT, i.e. TTS. RVC flow archived at `pipelines/archive/rvc-flow/`.
- Reference voices are tracked in `pipelines/video/tts/references/` and cataloged in `REFERENCES.md`; consumers use the slug (production voice: `jamila-30s`), never copy the wav.

### Engine inventory (as of 2026-07-12)

| Engine (`engines/<name>/`) | Status | Quality | Speed on Mac (MPS) | Notes |
|---|---|---|---|---|
| `indextts2` | **CHOSEN** (2026-06-23) | great + true emotion control | RTF ~32.7 → unusable locally | Runs on **Modal GPU (A10G)** via `modal/indextts2_app.py` — the only GPU step. ~9.5 GB models |
| `omnivoice` | no-GPU fallback | human-sounding, clone-only | ~1.4× realtime | Was the 06-21 pick, superseded. Switching back is just `--engine`. Gradio audition UI: `omnivoice-demo --port 7860` |
| `kokoro` | REJECTED | robotic (small synthetic model) | <1× realtime (fast) | py3.11 venv, `en_core_web_sm` pre-installed |
| `qwen3-tts` | REJECTED | 1.7B good / 0.6B garbled (defaults to Chinese) | ~20–30× realtime | GPU-class, needs SoX |
| `chatterbox` | present in tree, **undocumented** | — | — | `engines/chatterbox/` exists (config.json + synth.py) but is not in the hub CLAUDE.md's engine list; no recorded verdict |

All engines honor the same contract: `synth.py <segments.json> <out_dir>`.

## Audio↔video sync math (dubbing pre-existing recordings ONLY)

Status: **solved by decision, not by code** — VO-first (2026-07-12) makes new videos synced by construction and drops Whisper from the new-video pipeline entirely (script is locked before recording). Everything below is the theory for the legacy fallback: dubbing a recording that already exists.

- **Why swapping narration desyncs**: the visuals have fixed-time events (clicks, menus). The original narration was recorded simultaneously, so it was time-glued to those events. Swap in TTS and the glue is gone — and TTS speech is a **different length** (measured ~6% slower on IndexTTS-2: 167s voiceover vs a 158s video), so phrases drift LATE and the drift **accumulates** over the video. (An older ~18% figure is OmniVoice-specific and historical.)
- **Two hard-won constraints**:
  1. **Slowing the TTS makes sync WORSE.** The voice is already slower than the original; slowing pushes every phrase later. Slowing helps clarity only, never sync.
  2. **Gaps are one-directional.** Padding silence pushes a phrase later (easy, natural). Pulling a phrase EARLIER only works until the gap hits zero — and since TTS runs long, earlier is the direction mostly needed. So gaps must pair with a small targeted speed-up, never a global slow-down.
- **What `assemble.py` actually does** (`pipelines/video/tts/pipeline/assemble.py`): per-clip trim (kills the leading onset/breath artifact, with fades), anchors each ~22s chunk to its **original** timestamp, **gap-normalizes** inter-chunk silence into `[MIN_GAP, MAX_GAP] = [0.18s, 0.42s]`, and `--fit` applies one UNIFORM pitch-preserving **atempo** (ffmpeg's tempo filter that changes speed without changing pitch) so the last word lands within the video length. Speech is never stretched per-slot.

### The alignment ladder (each rung's ceiling)

| Approach | Ceiling | Status |
|---|---|---|
| Chunk-anchored + gap-normalize + global `--fit` (what's built) | ±1–2s global — fine for talking-over-screen, NOT click-along | Built, legacy fallback |
| Per-sentence anchoring (feed `segments.json` not `chunks.json`; pad-if-early / trim+micro-atempo-if-late) | ~±0.3s theoretical; a click MID-sentence can still be off | **NOT built** — retired by the VO-first decision |
| VO-first (record screen to the finished voiceover) | Frame-perfect by construction; also kills the transcript-error class | **Adopted** for all new videos |

Full derivation: `pipelines/video/tts/SYNC-PROBLEM.md` (header marks it answered).

## Lip-sync / avatar economics (as of 2026-07-12)

**Lip-sync** = repainting only the mouth region of an existing video so it matches new audio. **I2V (image-to-video)** = generating a short video clip from a still image.

- **HeyGen (the current path)**: owner decision 2026-07-12 (decisions.md) says exactly "keeps HeyGen ($1/min, ~$5/video at 5 min)" — the **~$1/min / ~$5/video** figure is the final-workflow cost model's number (`pipelines/youtube/final-workflow/final-workflow-notes.md` cost row), stated without an Avatar-tier attribution there. Note the reconciliation: `pipelines/video/heygen/CLAUDE.md` quotes $1/min as **Avatar IV's** price, so the pricing reference is Avatar IV — but the sanctioned generation path is **Avatar III via the `tooling/cli/heygen-web` web-session CLI, never `--iv`, never the official metered MCP** (the hard rule lives in `tooling/cli/heygen-web/CLAUDE.md`; prove every create op stayed free with `usage --save` before / `usage --diff` after). Read that CLAUDE.md before generating. **Gotcha**: `generate-from-audio` only accepts OWNED Talking Photos (photo avatars on the account); public/stock avatar ids fail with `photar_not_found`. **Structural limit**: HeyGen frontalizes every face — it cannot hold a side-view / gaze-down "working at laptop" pose.
- **fal-lipsync (validated 2026-07-11, DEFERRED by owner 2026-07-12 — do not push the migration or build the avatar CLI)**: replicates Avatar III's actual architecture (looped base video + lip-sync on top, not per-minute diffusion). Lands at **~$0.30–0.40/min** at 1080p and holds the pose HeyGen can't. Per component:

| Step | Tool | Cost | Frequency |
|---|---|---|---|
| Base motion clip | Kling 2.5 Turbo Pro I2V (`fal-ai/kling-video/v2.5-turbo/pro/image-to-video`) | $0.35 per 5s | once per character |
| Pose-variant edit | `fal-ai/nano-banana/edit` | ~$0.04/image | once per character |
| Loop to voiceover length | ffmpeg ping-pong (forward then reversed, seamless) | free | per video |
| Lip-sync | `fal-ai/latentsync` | ~$0.20 flat up to 40s, then $0.005/s (~$0.30/min) | per video |

- **Pose drift + the A→B frame-pinning trick**: I2V models' prior pulls faces frontal over the clip; prompting against it barely helps. Pinning first AND last frame to the same image stops drift but freezes the head (blinking only, looks dead). The working fix: pin the first frame to source pose **A** and the last frame to **B**, a slightly shifted variant of the same side pose (made with nano-banana; eyes at screen level, never lowered). Motion is bounded between two side poses — it can neither drift frontal nor freeze. The base clip must have a closed, still mouth or leftover jaw motion fights LatentSync.
- LatentSync passed the de-risk test on the actual stylized side-view face: in sync, no face-detection failures across 624 frames, held through motion. Adopting fal later would save ~$3.25/video.
- Character ids/slugs: `pipelines/video/heygen/registry.json` (single source of truth); every render gets a `RENDERS.md` row; media outside the repo.

## GPU / serverless economics

- **RTF (real-time factor)** = compute time ÷ audio duration produced. RTF 1 = realtime; RTF 32.7 (IndexTTS-2 on Mac MPS) means 1 minute of audio costs ~33 minutes of compute — unusable locally, so synth runs on **Modal GPU (A10G)** in `modal/indextts2_app.py`.
- **The placement rule used here**: a step gets a GPU only when its local RTF is far above 1 AND it runs per-video. Everything else stays local: transcribe, chunk, assemble, mux all run on CPU (the target deployment box is the Hostinger VPS — 2 vCPU, 7.8 GB RAM, no GPU). OmniVoice (~1.4× realtime) exists precisely as the no-GPU fallback.
- Self-hosting heavy avatar diffusion models was cost-analyzed and rejected: InfiniteTalk on a RunPod 4090 ≈ $0.73/output-min at 480p (thin saving, lower quality) and $2–3.5/min at 720p — worse than HeyGen. See `pipelines/video/heygen/fal-lipsync/README.md` for the full math.

### Per-video cost (corrected 2026-07-12, `pipelines/youtube/final-workflow/final-workflow-notes.md`)

| Line | Cost | Notes |
|---|---|---|
| TTS | **~$0.50** | IndexTTS-2 on Modal (the earlier $2 was a stale placeholder) |
| Avatar (5 min) | **~$5** | HeyGen $1/min; fal path would cut ~$3.25 but is deferred |
| Tutorial maker | $20 | VO-first means no narration skill needed — cheaper hires later |
| Video editor | $10 | |
| Reviewer share | $12.50 at 12 videos/mo | $150/mo retainer ÷ volume; 18/mo → $8.33, 30/mo → $5 |
| **Total** | **~$48/video at 12/mo** | ~$43.83 at 18/mo, ~$40.50 at 30/mo |

## Whisper / ASR (the transcription stage)

- Engine: local **faster-whisper large-v3, int8** quantization — runs on CPU (VPS-viable) at **~1.4× realtime** on the 2.6-min sample, near-perfect accuracy.
- Only misses were niche brand names (HeyGen→"Hagen", OpenArt→"open art") + one garbled phrase — fixed via an `initial_prompt` vocabulary list (Whisper's parameter for biasing recognition toward known terms) plus the editor's text pass.
- **Three timestamp granularities**, coarse to fine: **word-level timestamps** (`transcript.json` — a start/end time per word), sentence **segments** (`segments.json` via `pipeline/make_segments.py`), and **~22s chunks** (`pipeline/chunk_segments.py` merges segments). Chunking trades sync tightness for fewer audible seams and stable pacing within a chunk; per-sentence sync would have needed segment granularity.
- VO-first removes Whisper from the new-video pipeline entirely (script locked before recording); it remains only for dubbing pre-existing recordings.
- Existing Whisper assets (script, venv, ~2.9 GB large-v3 model): `~/kb-scratch/voice-pipeline-test/`.

## When NOT to use this skill

- Operating the pipelines day-to-day (running synth, generating a render) → `pipelines/CLAUDE.md`, then `pipelines/video/tts/CLAUDE.md` / `pipelines/video/heygen/CLAUDE.md`
- Executing the scale-up campaign (productizing the processor, thumbnails, QC) → **personal-stuff-video-automation-campaign**
- Validating an engine swap / running a bake-off or budget spike → **personal-stuff-research-methodology**
- What was tried and abandoned (RVC, OmniVoice-era fixes, self-hosting) → **personal-stuff-failure-archaeology**
- Cloudflare / VPS platform theory → **cloudflare-and-vps-reference**
- Browsing generated voiceovers/renders visually → **media-board** skill ("open my media board" → localhost:4100)

## Provenance and maintenance

Verified against `pipelines/video/tts/{CLAUDE.md,SYNC-PROBLEM.md,REFERENCES.md,OUTPUTS.md,SYSTEMS-COST-COMPARISON.md,pipeline/assemble.py,modal/indextts2_app.py}`, `pipelines/video/heygen/{CLAUDE.md,registry.json,RENDERS.md,fal-lipsync/README.md}`, `pipelines/youtube/final-workflow/final-workflow-notes.md`, and `decisions.md` (2026-07-11/12 entries) on 2026-07-12. Costs and engine choices are volatile — re-check dates before quoting. Re-verify:
- Engine inventory: `ls pipelines/video/tts/engines/` against the table in `pipelines/video/tts/CLAUDE.md`
- Gap/fit constants: `rtk proxy grep -n "MIN_GAP\|MAX_GAP\|atempo" pipelines/video/tts/pipeline/assemble.py`
- VO-first / fal-deferral still standing: `rtk proxy grep -n "2026-07-12" decisions.md`
- Cost table: `pipelines/youtube/final-workflow/final-workflow-notes.md` "Cost per video"
- Character slugs: `cat pipelines/video/heygen/registry.json`
