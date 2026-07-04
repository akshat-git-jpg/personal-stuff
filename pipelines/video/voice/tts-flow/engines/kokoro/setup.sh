#!/usr/bin/env bash
# Set up the Kokoro engine in its own isolated venv.
# System dep: espeak-ng  (macOS: brew install espeak-ng | Debian/VPS: apt install espeak-ng)
set -euo pipefail
cd "$(dirname "$0")"

command -v espeak-ng >/dev/null || echo "WARNING: espeak-ng not found — install it (brew/apt) for OOV words."

uv venv --python 3.11 venv
uv pip install --python venv/bin/python kokoro soundfile
# Kokoro's English G2P (misaki) needs the spaCy model; pre-install so it isn't
# fetched at runtime (which fails inside a uv venv). Match the spaCy major.minor.
uv pip install --python venv/bin/python \
  "https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"
echo "Kokoro engine ready. Test: venv/bin/python synth.py <segments.json> <out_dir>"
