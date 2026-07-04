#!/usr/bin/env python3
"""Chatterbox (Resemble AI) engine adapter — tts-flow contract, with emotion control.

    synth.py <segments.json> <out_dir>
  reads [{"id","text"}], writes <out_dir>/<id>.wav. Loads model once.
  config.json: ref_audio (voice clone), exaggeration (emotion 0.3-1.0), cfg_weight (0.2-0.6).
  More emotion: raise exaggeration (~0.7+), lower cfg_weight (~0.3).
"""
import os
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
import sys, json, time, pathlib
import numpy as np
import soundfile as sf
import torch

here = pathlib.Path(__file__).parent
root = here.parent.parent

def pick_device(pref):
    if pref and pref != "auto":
        return pref
    if torch.cuda.is_available(): return "cuda"
    if torch.backends.mps.is_available(): return "mps"
    return "cpu"

def resolve(p):
    p = pathlib.Path(p)
    return str(p if p.is_absolute() else (root / p))

def main():
    if len(sys.argv) != 3:
        print(__doc__); sys.exit(1)
    segments_path, out_dir = sys.argv[1], pathlib.Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    cfg = json.loads((here / "config.json").read_text())
    segments = json.loads(pathlib.Path(segments_path).read_text())

    device = pick_device(cfg.get("device", "auto"))
    print(f"loading ChatterboxTTS on {device}...", flush=True)
    from chatterbox.tts import ChatterboxTTS
    model = ChatterboxTTS.from_pretrained(device=device)
    sr = model.sr

    ref = resolve(cfg["ref_audio"]) if cfg.get("ref_audio") else None
    exa = float(cfg.get("exaggeration", 0.5))
    cfgw = float(cfg.get("cfg_weight", 0.5))
    gkw = dict(exaggeration=exa, cfg_weight=cfgw)
    if ref:
        gkw["audio_prompt_path"] = ref

    for seg in segments:
        sid, text = seg["id"], seg["text"].strip()
        if not text:
            continue
        t = time.time()
        wav = model.generate(text, **gkw)
        a = wav.squeeze(0).detach().cpu().numpy().astype(np.float32)
        sf.write(str(out_dir / f"{sid}.wav"), a, sr)
        print(f"  {sid}: {len(a)/sr:.1f}s audio in {time.time()-t:.1f}s  «{text[:42]}…»", flush=True)

    print("DONE", flush=True)

if __name__ == "__main__":
    main()
