#!/usr/bin/env python3
"""Orchestrate the TTS-flow pipeline: (segments) -> engine synth -> anchor+mux -> final video.

Usage:
    run.py --video <in.mp4> --segments <segments.json> --engine <name> [--out <out.mp4>]

Each engine runs in its OWN venv (incompatible deps), so we shell out across the contract:
    <engine venv python> <engine synth script> <segments.json> <wav_dir>
Then assemble.py (anchor + mux) runs in a venv that has numpy+soundfile.

Upstream (not yet wired here): video -> faster-whisper -> transcript.json -> make_segments.py
-> segments.json -> [editor fixes the text]. For now pass an existing --segments.
"""
import sys, os, argparse, subprocess, pathlib

ROOT = pathlib.Path(__file__).parent.parent  # tts-flow/

# engine -> (venv python, synth script) relative to ROOT
ENGINES = {
    "omnivoice": ("engines/omnivoice/venv/bin/python", "engines/omnivoice/synth.py"),
    "kokoro":    ("engines/kokoro/venv/bin/python",    "engines/kokoro/synth.py"),
    "qwen3-tts": ("engines/qwen3-tts/venv/bin/python", "engines/qwen3-tts/synth.py"),
    "indextts2": ("engines/indextts2/.venv/bin/python", "engines/indextts2/synth_adapter.py"),
}
# a venv that has numpy+soundfile to run assemble.py
ASSEMBLE_PY = "engines/omnivoice/venv/bin/python"

def sh(cmd, **kw):
    print("  $", " ".join(str(c) for c in cmd), flush=True)
    subprocess.run([str(c) for c in cmd], check=True, **kw)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--segments", required=True)
    ap.add_argument("--engine", required=True, choices=list(ENGINES))
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    video = pathlib.Path(a.video).resolve()
    segments = pathlib.Path(a.segments).resolve()
    out = pathlib.Path(a.out).resolve() if a.out else video.with_name(video.stem + f".{a.engine}.mp4")
    wav_dir = ROOT / "work" / f"_run_{a.engine}_{video.stem}"

    env = dict(os.environ, PYTORCH_ENABLE_MPS_FALLBACK="1")
    venv_py, synth = ENGINES[a.engine]

    print(f"[1/2] synth ({a.engine}) -> {wav_dir}")
    sh([ROOT / venv_py, ROOT / synth, segments, wav_dir], env=env)

    print(f"[2/2] anchor + mux -> {out}")
    sh([ROOT / ASSEMBLE_PY, ROOT / "pipeline" / "assemble.py",
        segments, wav_dir, video, out])

    print(f"\nDONE -> {out}")

if __name__ == "__main__":
    main()
