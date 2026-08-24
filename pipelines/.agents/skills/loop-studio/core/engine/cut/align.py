#!/usr/bin/env python3
"""Forced alignment via torchaudio MMS_FA (wav2vec2) — Descript-grade word boundaries.
Aligns a known word sequence to audio, returns sample-accurate start/end per word.
Usage: python3 align.py WAV WORDS_JSON OUT_JSON [offset_seconds]"""
import json, re, sys, torch, torchaudio
from torchaudio.pipelines import MMS_FA as bundle

wav_path = sys.argv[1]
words_json = sys.argv[2]
out_json = sys.argv[3]
OFFSET = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0

def norm(w): return re.sub(r"[^a-z]", "", w.lower())

src = json.load(open(words_json))
orig, normed = [], []
for x in src:
    n = norm(x["word"])
    if n:
        orig.append(x["word"].strip()); normed.append(n)

import wave, numpy as np
_w = wave.open(wav_path, "rb"); sr = _w.getframerate()
_sig = np.frombuffer(_w.readframes(_w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
waveform = torch.from_numpy(_sig).unsqueeze(0)
if sr != bundle.sample_rate:
    waveform = torchaudio.functional.resample(waveform, sr, bundle.sample_rate); sr = bundle.sample_rate

model = bundle.get_model()
tokenizer = bundle.get_tokenizer()
aligner = bundle.get_aligner()
with torch.inference_mode():
    emission, _ = model(waveform)
    spans = aligner(emission[0], tokenizer(normed))

ratio = waveform.size(1) / emission.size(1) / sr
out = []
for w, sp in zip(orig, spans):
    out.append({"word": w,
                "start": round(sp[0].start * ratio + OFFSET, 3),
                "end":   round(sp[-1].end * ratio + OFFSET, 3),
                "score": round(sum(s.score for s in sp)/len(sp), 3)})
json.dump(out, open(out_json, "w"), indent=0)
print(f"aligned {len(out)} words -> {out_json}")
