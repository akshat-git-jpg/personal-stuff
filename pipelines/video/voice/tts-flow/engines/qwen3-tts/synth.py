#!/usr/bin/env python3
"""Qwen3-TTS engine adapter — implements the tts-flow engine contract.

Contract:
    synth.py <segments.json> <out_dir>
  - reads [{"id","text"}, ...]; writes <out_dir>/<id>.wav per segment
  - loads the model ONCE; reads mode/speaker/etc. from config.json next to this file

Modes (config.json "mode"):
  custom_voice  -> preset speaker (Serena/Vivian/... ) on a CustomVoice model
  voice_design  -> describe the voice via "instruct" (VoiceDesign model)
  voice_clone   -> clone "ref_audio"+"ref_text" (Base model)
"""
import os
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")  # let unsupported ops fall to CPU
import sys, json, pathlib
import numpy as np
import soundfile as sf
import torch

here = pathlib.Path(__file__).parent

def pick_device(pref):
    if pref and pref != "auto":
        return pref
    if torch.cuda.is_available():
        return "cuda:0"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"

def main():
    if len(sys.argv) != 3:
        print(__doc__); sys.exit(1)
    segments_path, out_dir = sys.argv[1], pathlib.Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    cfg = json.loads((here / "config.json").read_text())
    segments = json.loads(pathlib.Path(segments_path).read_text())

    device = pick_device(cfg.get("device", "auto"))
    dtype = torch.float32 if device in ("cpu", "mps") else torch.bfloat16
    print(f"loading {cfg['model_id']} on {device} ({dtype})...", flush=True)

    from qwen_tts import Qwen3TTSModel
    model = Qwen3TTSModel.from_pretrained(cfg["model_id"], device_map=device, dtype=dtype)

    mode = cfg.get("mode", "custom_voice")
    lang = cfg.get("language", "English")

    def synth_one(text):
        if mode == "custom_voice":
            wavs, sr = model.generate_custom_voice(
                text=text, speaker=cfg["speaker"], language=lang,
                instruct=cfg.get("instruct"))
        elif mode == "voice_design":
            wavs, sr = model.generate_voice_design(
                text=text, instruct=cfg["instruct"], language=lang)
        elif mode == "voice_clone":
            wavs, sr = model.generate_voice_clone(
                text=text, language=lang,
                ref_audio=cfg["ref_audio"], ref_text=cfg.get("ref_text"))
        else:
            raise ValueError(f"unknown mode {mode}")
        return np.asarray(wavs[0], dtype=np.float32), sr

    for seg in segments:
        sid, text = seg["id"], seg["text"].strip()
        if not text:
            continue
        wav, sr = synth_one(text)
        sf.write(str(out_dir / f"{sid}.wav"), wav, sr)
        print(f"  {sid}: {len(wav)/sr:.1f}s  «{text[:48]}…»", flush=True)

    print("DONE", flush=True)

if __name__ == "__main__":
    main()
