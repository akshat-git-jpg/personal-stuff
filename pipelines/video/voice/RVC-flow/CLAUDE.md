# RVC flow — male→female voice conversion (WORKING)

Convert a tutorial-maker's male-voiced recording into a female voice, locally and
for free, using an RVC v2 voice model. Built and verified on macOS (Apple Silicon).

## What this is / isn't

- **Is:** a *voice skin*. Speech-to-speech. Takes existing audio and changes only the
  **timbre** (male→female). Output length == input length exactly (e.g. 158.00s in →
  157.94s out), so when muxed back into the video it stays in sync with zero alignment work.
- **Is NOT:** a way to fix delivery. RVC faithfully reproduces the source's accent,
  pacing, mispronunciations, run-on sentences, and gibberish — just in a female voice.
  There is no transcript and no text involved.

> ⚠️ **Decision context (read before extending this):** the user's real requirement is
> CLEAN output — no pronunciation/punctuation errors, proper sentence breaks, clear pacing.
> RVC structurally CANNOT deliver that (it copies the freelancer's flaws). Those
> requirements need regenerating speech from corrected text = **TTS**. This RVC flow is
> kept as a proven fallback (accent-preserving, free), but the intended direction is the
> TTS pipeline. See `../tts-flow/CLAUDE.md`.

## Layout

```
RVC-flow/
├── convert_rvc.py     # main — converts work/short_for_rvc.wav at given pitches
├── convert_test.py    # quick 20s-clip tester (work/clip20.wav)
├── rvc-venv/          # Python 3.10 env; HuBERT+RMVPE base models live inside it
├── models/egirl/      # the voice model: egirl.pth + added_IVF2182_..._egirl.index
└── work/              # audio in/out (gitignored)
```
`.gitignore` excludes `rvc-venv/`, `models/`, `work/`, `*.log` (TY is a git repo — don't
commit the ~2 GB of binaries; only the two .py scripts are tracked).

## How to run

```bash
cd <repo-root>/ty/video/voice/RVC-flow
# convert at pitch +7 and +12 -> work/egirl_pitch+7.wav / +12.wav
rvc-venv/bin/python convert_rvc.py 7 12
# quick 20s smoke test: convert_test.py <f0method> <pitch>
rvc-venv/bin/python convert_test.py pm 12
```
First run downloads the base models (hubert/rmvpe) into the venv. Both scripts are
self-contained — the env fixes below are baked in, no shell setup needed.

### Params worth knowing (in convert_rvc.py)
- **pitch (f0up_key):** semitones up for male→female. `+7` = grounded/mature (better for
  tutorial narration), `+12` = brighter/younger (more "e-girl", can go chipmunky).
- **f0method:** `rmvpe` (best quality, used for finals) or `pm` (fast, for smoke tests).
- index_rate 0.66, protect 0.33 — sane defaults.

### Swapping the voice model
Drop a new RVC **v2** model's `.pth` + `.index` into `models/<name>/` and update the paths
in the script. **Scan every downloaded `.pth` with picklescan first** (pickle = code-exec
risk). Free models: voice-models.com, AI Hub Discord — quality varies wildly.

## Environment gotchas (these took 4 fixes to get working — do not regress)

1. **Python 3.10, NOT 3.11+** — fairseq 0.12.2 hits a dataclass `mutable default` error on 3.11.
2. **torch==2.5.1 / torchaudio==2.5.1, NOT 2.6+** — torch 2.6 flipped `torch.load` to
   `weights_only=True`, which breaks fairseq's HuBERT load.
3. **Force CPU (hide MPS)** — scripts set `torch.backends.mps.is_available=lambda:False`.
   An MPS conv op exceeds Metal's channel limit; CPU also mirrors the CPU-only VPS.
4. **OpenMP segfault fix** — `KMP_DUPLICATE_LIB_OK=TRUE` + `OMP/MKL/OPENBLAS_NUM_THREADS=1`
   set at the top of each script (torch/faiss/numba each bundle OpenMP → collide → SIGSEGV 139).

### Rebuild the env from scratch (e.g. on the VPS)
```bash
uv venv --python 3.10 rvc-venv
uv pip install --python rvc-venv/bin/python rvc-python
uv pip install --python rvc-venv/bin/python torch==2.5.1 torchaudio==2.5.1
```

## Performance / VPS notes
- ~190s to convert 2.6 min of audio, single-thread CPU (~1.2× realtime). Scales ~linearly.
- VPS target: 2 vCPU, 7.8 GB RAM, no GPU, no swap (Hostinger). Add swap before running.
  Run as an async one-at-a-time job; it won't fight the dashboard/crons if single-threaded.

## Status
- ✅ End-to-end working; produced `work/egirl_pitch+7.wav` / `+12.wav` from `work/SHORT.mp4`
  ("higgsfield vs … conclusion", 2.6 min). MP3 copies were placed on the user's Desktop.
- ⬜ Not yet muxed into video (user wanted to approve voice/pitch first).
- ⬜ Not yet deployed to VPS or given a UI.
