# TTS flow — clean female voiceover from corrected text

The production system. Turns a tutorial-maker's messy male-voiced screen recording into a
CLEAN, clear, accent-neutral female voiceover that stays in sync with the video — with
**no recurring cost**.

**STATUS (2026-06-21):** OmniVoice chosen (4 engines benchmarked). Full pipeline BUILT &
runs end-to-end (transcript → chunked synth → trim+anchor → mux). Real reference voice in
use (cloned from a user-supplied YouTube Short). Currently iterating on output QUALITY —
see "Quality engineering" and "Known issues" below.

## Why this exists (vs the RVC flow)

The user's hard requirements: voiceover must be **clear, clean, correctly pronounced,
correctly punctuated, properly sentence-broken, well-paced, and synced** — with **no
recurring/subscription cost**.

Voice-conversion (RVC, in `../RVC-flow/`) CANNOT meet this. RVC is a voice skin: it copies
the freelancer's accent, pacing, mispronunciations, and gibberish exactly. To fix *how
words are said*, you must regenerate speech from **corrected text** — i.e. TTS. So:

- Fixing delivery/pronunciation/pacing  → requires text → **TTS**, not RVC.
- "No recurring cost"                   → requires **local/open-source TTS**, not ElevenLabs.
- Accent-neutral output (bonus)         → falls out of TTS for free (consistent voice
  regardless of which freelancer recorded).

## The pipeline

```
video
 └─ extract audio
     └─ Whisper transcript (free, local)            # segments + word-level timestamps
         └─ editor fixes the TEXT                    # names, punctuation, split run-ons,
             │                                       # delete gibberish — easy, non-techy
             └─ local TTS regenerates each segment   # clean female voice, free
                 └─ anchor each segment to its       # place at original timestamp on a
                     original timestamp + mux        # silent timeline, then one mux
                     └─ final video (in sync)
```

### Pipeline scripts (`pipeline/`)
- `make_segments.py`  — faster-whisper `transcript.json` → `segments.json` (`[{id,text,start,end}]`).
- `chunk_segments.py` — merge fine segments → ~22s **chunks** (`chunks.json`). Fewer seams,
  stable pacing. Run BEFORE synth; feed `chunks.json` to the engine's `synth.py`.
- `assemble.py`       — trim per-clip artifacts + **silence-absorbed** placement, then output
  voiceover (`.wav`/`.mp3`) OR mux into video (`.mp4`). See "Quality engineering".
- `run.py`            — orchestrator: `--video --segments --engine` → synth → assemble.

### Sync method — anchor + silence-absorb (NO speech stretching)
Each chunk is placed at its **original** start time, but we NEVER time-stretch the speech
(stretching = artifacts + unnatural). Drift is absorbed by the gaps between chunks
(`MIN_GAP`), pushing a chunk later only if the previous one overran. Tutorials have **no
lip-sync constraint** (screen recording, no face), so coarse sentence-level alignment is
fine — the words always play at the engine's natural rate.

## Quality engineering (the "flawless output" work — 3 principles)
Root-caused two artifacts (see "Known issues") to ISOLATED per-sentence generation. Fixes:
1. **Chunking** (`chunk_segments.py`): ~22s chunks instead of 26 micro-clips → fewer onset
   artifacts (one per chunk) + stable pacing within a chunk.
2. **Per-clip hygiene** (`assemble.py: trim_clip`): every OmniVoice clip has a ~200ms leading
   breath/onset artifact (peak ~0.019, below the 0.02 speech threshold). We trim lead to
   onset−10ms + trailing breath, with 15/20ms fades. THIS removes the audible "tsh".
3. **Silence-absorbed placement**: never stretch speech; absorb timing in inter-chunk gaps.

## Whisper stage — already proven
Local `faster-whisper large-v3`, int8, runs on CPU (VPS-viable). On the 2.6-min sample:
~1.4× realtime, near-perfect accuracy. Only misses were niche brand names (HeyGen→"Hagen",
OpenArt→"open art") + one garbled phrase — all fixable via an `initial_prompt` vocab list
+ the editor's text pass.

**Existing Whisper assets live at:**
`/Users/kbtg/codebase/personal-stuff/docs/voice-pipeline-test/` — `transcribe.py`, its
`.venv`, `models/large-v3` (~2.9 GB), and `transcript.txt` / `transcript.json` for the
sample. Consider moving these here when this flow is built out.

## Benchmark results — 4 engines tested on the user's Mac (Apple Silicon, MPS)

All four are wired into the same `synth.py` contract (see each `engines/<name>/`). Tested on
the 2.6-min sample transcript. Speed = compute time ÷ audio length (lower is better).

| Engine | Quality | Speed on Mac (MPS) | Verdict |
|--------|---------|--------------------|---------|
| **OmniVoice** | **human ✅** (clones a reference voice) | **~1.4× realtime**, correct durations | ✅ **CHOSEN** |
| Kokoro | robotic (small synthetic model) | <1× realtime (fast) | ❌ quality |
| Qwen3-TTS 1.7B | good | ~20–30× realtime (unusable) | ❌ needs GPU |
| Qwen3-TTS 0.6B | garbled / defaults to Chinese | slow | ❌ broken |
| IndexTTS2 | likely great, correct durations | **RTF 32.7 (~32× realtime)** | ❌ needs GPU |

**Decision: OmniVoice.** Only engine that is both human-sounding AND fast enough on this
hardware. Qwen + IndexTTS2 are GPU-class — kept in the repo (same contract) as the
"if we get an NVIDIA box" premium options; switching is just `--engine`.

Reference clip: OmniVoice/IndexTTS2 are zero-shot CLONERS — they need a 5–10s clean clip of
the target female voice (+ auto-transcribed by built-in Whisper). The user provides the
voice they actually want for their videos. Benchmarks used a throwaway Kokoro clip (so they
*sound* robotic — that's the reference, not the engine).

ElevenLabs is the quality benchmark but is **recurring per-generation** → rejected by the
"no recurring cost" constraint. Only revisit if OmniVoice fails on real references.

## Pronunciation control
Brand names / acronyms get fixed in text (phonetic respelling) or via the chosen TTS's
pronunciation/lexicon support. This is the main lever for "no pronunciation mistakes."

## Emotion / expressiveness
OmniVoice **cannot add emotion via `instruct`** — its `instruct` vocabulary is ONLY voice
attributes (`female`, `male`, `child/teenager/.../elderly`, pitch levels, `whisper`, and
accents like `indian accent`). No happy/excited/warm tags. Verified against
`_INSTRUCT_VALID_EN`. So emotion comes from one of:
1. **A more expressive reference clip** — OmniVoice clones the reference's STYLE, so a livelier
   reference → livelier output. Cheapest lever, no engine change. (RECOMMENDED.)
2. **IndexTTS2** — has true emotion control (`emo_vector`, `emo_audio_prompt`, `use_emo_text`,
   `emo_text`) but is GPU-class (RTF 32.7 on Mac). Only practical on a GPU box.

## Known issues / root causes (debugged 2026-06-21)
- **"tsh" before every segment** → ROOT CAUSE: OmniVoice emits a consistent ~200ms onset
  breath at the start of EVERY clip (all 26 measured, onset 157–279ms, peak ~0.019). Stitching
  N clips exposes it N times. FIX: `trim_clip` in assemble.py. (Was present in the Gradio UI
  too — it's the engine, not the pipeline.)
- **Uneven pacing (fast/slow)** → ROOT CAUSE: isolated per-clip generation, no shared rhythm.
  NOT caused by stretching (assemble stretched ~0). FIX: chunking + (future) `speed` param.
- **OPEN: voiceover longer than video.** OmniVoice speaks ~18% slower than the original
  narration (chunked sample = 188.9s vs 158s video). Fix at MUX time the CLEAN way: regenerate
  with OmniVoice's native `generate(..., speed=~1.18)` so it fits without post-stretch artifacts
  — NOT by atempo-stretching the final audio.

## Reference voice
Currently cloning a user-supplied YouTube Short ("soft and elegant speaker"): the clean 6.2s
clip is at `work/refvoice/ref.wav` (extracted + loudnorm'd), wired into
`engines/omnivoice/config.json` (`ref_audio` + `ref_text`). It's calm by design → plain output;
a livelier reference is the lever for more energy (see Emotion).

## Engines (all honor the same contract: `synth.py <segments.json> <out_dir>`)
- `engines/kokoro/`     — preset voices, py3.11 venv, `en_core_web_sm` pre-installed (gotcha).
- `engines/qwen3-tts/`  — `qwen-tts` pkg, CustomVoice presets; needs SoX; GPU-class.
- `engines/omnivoice/`  — **chosen**; `omnivoice` pkg; clone-only; has a Gradio UI
  (`omnivoice-demo --port 7860`) for auditioning. Headless adapter = `synth.py`.
- `engines/indextts2/`  — full repo clone + `uv sync`; ~9.5 GB models; GPU-class.

All set MPS-off-by-fallback / device auto. HF auth: token stored globally
(`~/.cache/huggingface/token`) — downloads are fast.

## NEXT STEPS
1. ✅ Engine chosen: OmniVoice. ✅ Pipeline built (chunk → synth → trim+anchor → mux).
2. ✅ Real reference voice wired in. ✅ Root-caused + fixed "tsh" and pacing (chunk+trim).
3. ⏳ User reviewing the voiceover (`~/Desktop/voiceover_v2_chunked_trimmed.mp3`):
   is "tsh" gone? pacing even? Possibly try a livelier reference for energy.
4. ⬜ Close the length gap at mux: regenerate with `generate(speed=~1.18)` so 188.9s → ~158s
   natively, then mux to final video.
5. ⬜ Transcript-fix step (editor edits `segments.json`/`chunks.json` text before synth).
6. ⬜ Deployment decision (below) + simple editor UI.

### How to run the current pipeline (Mac)
```bash
cd tts-flow
export PYTORCH_ENABLE_MPS_FALLBACK=1
engines/omnivoice/venv/bin/python pipeline/chunk_segments.py work/segments.json work/chunks.json 22
engines/omnivoice/venv/bin/python engines/omnivoice/synth.py work/chunks.json work/omni_chunks
# voiceover only (review):
engines/omnivoice/venv/bin/python pipeline/assemble.py work/chunks.json work/omni_chunks out.mp3
# or muxed video: ...assemble.py work/chunks.json work/omni_chunks out.mp4 work/SHORT.mp4
```

## Target deployment
Hostinger VPS (2 vCPU, 7.8 GB RAM, no GPU, no swap) + simple web UI for a non-techy editor:
upload video → review/fix auto-transcript in a textbox → generate → download synced video.
Async one-job-at-a-time queue. Add swap before heavy jobs.
