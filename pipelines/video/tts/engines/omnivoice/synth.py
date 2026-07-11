#!/usr/bin/env python3
"""OmniVoice engine adapter — implements the tts-flow engine contract (headless, no UI).

Contract:
    synth.py <segments.json> <out_dir>
  - reads [{"id","text"}, ...]; writes <out_dir>/<id>.wav per segment
  - loads the model ONCE and precomputes the voice-clone prompt ONCE (from config ref voice)
"""
import os
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
import sys, json, time, pathlib
import numpy as np
import soundfile as sf
import torch

here = pathlib.Path(__file__).parent
root = here.parent.parent  # tts-flow/

def pick_device(pref):
    if pref and pref != "auto":
        return pref
    if torch.cuda.is_available(): return "cuda:0"
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
    print(f"loading {cfg['model_id']} on {device}...", flush=True)
    from omnivoice import OmniVoice
    model = OmniVoice.from_pretrained(cfg["model_id"], device_map=device)

    # precompute the voice-clone prompt ONCE (reused for every segment)
    print("building voice-clone prompt from reference...", flush=True)
    prompt = model.create_voice_clone_prompt(
        ref_audio=resolve(cfg["ref_audio"]), ref_text=cfg.get("ref_text"))

    sr = cfg.get("sample_rate", 24000)
    lang = cfg.get("language", "English")
    instruct = cfg.get("instruct") or None   # style/emotion direction (optional)
    gkw = {}
    if instruct:
        gkw["instruct"] = instruct
    for seg in segments:
        sid, text = seg["id"], seg["text"].strip()
        if not text:
            continue
        t = time.time()
        wavs = model.generate(text=text, language=lang, voice_clone_prompt=prompt, **gkw)
        wav = np.asarray(wavs[0], dtype=np.float32)
        sf.write(str(out_dir / f"{sid}.wav"), wav, sr)
        print(f"  {sid}: {len(wav)/sr:.1f}s audio in {time.time()-t:.1f}s  «{text[:42]}…»", flush=True)

    print("DONE", flush=True)

if __name__ == "__main__":
    main()
