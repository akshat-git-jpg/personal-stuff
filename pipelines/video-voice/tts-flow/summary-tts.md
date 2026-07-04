# TTS engine summary — what we tested on the Mac

Quick reference. "Try link" = audition it in the browser (no install) before committing a GPU.
Full details + benchmarks in CLAUDE.md.

| Engine | Quality | Emotion control | Speed on Mac (MPS) | Verdict | Try online |
|--------|---------|-----------------|--------------------|---------|-----------|
| **OmniVoice** | good voice cloning, human | ❌ none (instruct = voice attributes only) | ~1.4× realtime ✅ | ✅ **chosen** — only one fast enough on laptop | https://zhu-han.github.io/omnivoice/ (samples) |
| **Chatterbox** (Resemble) | human + expressive | ✅ yes (`exaggeration`) — "Subscribe!" sounds energetic | ~10–17× realtime ❌ | GPU-only | https://huggingface.co/spaces/ResembleAI/Chatterbox |
| **IndexTTS2** | likely great, correct durations | ✅ yes (emo_vector / emo_text) | RTF ~32× ❌ | GPU-only | https://huggingface.co/spaces/IndexTeam/IndexTTS-2-Demo |
| **Kokoro** | robotic (small synthetic model) | ❌ none | <1× realtime (fast) | ❌ quality | https://huggingface.co/spaces/hexgrad/Kokoro-TTS |
| **Qwen3-TTS** | good (1.7B); 0.6B garbled/Chinese | limited | ~20–30× realtime ❌ | ❌ needs GPU | https://huggingface.co/spaces/Qwen/Qwen3-TTS-Demo |
| **Fish Audio S2 Pro** | very high, expressive (OpenAudio S1 family) | ✅ yes (emotion/tone markers) | not run locally — GPU-class | audition online; GPU/cloud if chosen | https://fish.audio/ (playground, free tier) |

## The law we proved 4×
On this Mac (no GPU) you get **fast OR emotional, never both**.
- OmniVoice = fast + human but flat (no emotion).
- Every expressive engine (Chatterbox, IndexTTS2, Qwen) is GPU-class → too slow on laptop.

## So the decision
1. Audition the expressive engines on the **try links** above (free, in browser) → pick the voice you like.
2. To get fast + emotional in production: run the winner on a **GPU** (Modal, build once).
   The pipeline already supports engine swap via `--engine`.
