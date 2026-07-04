# Kokoro engine adapter

Local, free TTS (hexgrad/Kokoro-82M). Fast on CPU → best fit for the CPU-only VPS.
Implements the tts-flow engine contract.

## Setup
```bash
brew install espeak-ng        # macOS  (VPS/Debian: apt install espeak-ng)
./setup.sh                    # builds venv/, installs kokoro + soundfile + en_core_web_sm
```
Gotcha baked into setup.sh: Kokoro's English G2P (misaki) needs the spaCy model
`en_core_web_sm`. If it isn't pre-installed it tries to fetch it at runtime and fails
inside a uv venv ("No virtual environment found") → silent empty audio. setup.sh installs it.

## Run (the contract)
```bash
venv/bin/python synth.py <segments.json> <out_dir>
# reads [{"id","text"}...], writes <out_dir>/<id>.wav per segment, model loaded once
```

## Config (config.json)
- `lang_code`: 'a' American / 'b' British English
- `voice`: af_heart (default), af_bella, af_nicole, af_sarah, af_sky (female); am_* (male)
- `speed`: 0.8–1.2
- `sample_rate`: 24000 (Kokoro's native rate)

## Performance
26 segments / ~2.9 min audio synthesized in ~40s wall on Apple Silicon CPU
(multi-threaded, faster than realtime). First run downloads the 82M model from HF.
