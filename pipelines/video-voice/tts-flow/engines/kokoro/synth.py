#!/usr/bin/env python3
"""Kokoro TTS engine adapter — implements the tts-flow engine contract.

Contract:
    synth.py <segments.json> <out_dir>
  - reads segments.json: [{"id": "...", "text": "..."}, ...]
  - writes <out_dir>/<id>.wav for each segment
  - loads the model ONCE; reads voice/speed/lang from config.json (next to this file)
"""
import sys, json, pathlib
import numpy as np
import soundfile as sf

here = pathlib.Path(__file__).parent

def load_config():
    cfg = json.loads((here / "config.json").read_text())
    return cfg

def to_numpy(audio):
    if hasattr(audio, "detach"):
        audio = audio.detach().cpu().numpy()
    return np.asarray(audio, dtype=np.float32)

def main():
    if len(sys.argv) != 3:
        print(__doc__); sys.exit(1)
    segments_path, out_dir = sys.argv[1], pathlib.Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    cfg = load_config()
    segments = json.loads(pathlib.Path(segments_path).read_text())

    from kokoro import KPipeline
    pipeline = KPipeline(lang_code=cfg["lang_code"])
    sr = cfg["sample_rate"]

    for seg in segments:
        sid, text = seg["id"], seg["text"].strip()
        if not text:
            continue
        chunks = []
        for _gs, _ps, audio in pipeline(text, voice=cfg["voice"], speed=cfg["speed"]):
            chunks.append(to_numpy(audio))
        if not chunks:
            print(f"  WARN: no audio for segment {sid}", flush=True)
            continue
        wav = np.concatenate(chunks) if len(chunks) > 1 else chunks[0]
        sf.write(str(out_dir / f"{sid}.wav"), wav, sr)
        print(f"  {sid}: {len(wav)/sr:.1f}s  «{text[:48]}…»", flush=True)

    print("DONE", flush=True)

if __name__ == "__main__":
    main()
