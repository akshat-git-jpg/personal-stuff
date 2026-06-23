#!/usr/bin/env python3
"""Convert an audio file male->female with the E-Girl RVC model.
Produces several pitch variants so we can pick the natural one.
First run auto-downloads base models (hubert, rmvpe)."""
import os
# Must be set BEFORE torch/numba/faiss import: they each bundle an OpenMP runtime
# and collide -> segfault on Apple Silicon. Single-thread + tolerate duplicate.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")

import sys, time, pathlib
# Force CPU: hide MPS so rvc-python doesn't auto-select Metal (a HuBERT conv op
# isn't supported on MPS). Also mirrors the CPU-only VPS exactly.
import torch
torch.backends.mps.is_available = lambda: False
torch.backends.mps.is_built = lambda: False
from rvc_python.infer import RVCInference

here = pathlib.Path(__file__).parent
model = str(here / "models" / "egirl" / "egirl.pth")
index = str(here / "models" / "egirl" / "added_IVF2182_Flat_nprobe_1_egirl.index")
inp   = str(here / "work" / "short_for_rvc.wav")

pitches = [int(x) for x in (sys.argv[1:] or [7, 12])]

print("loading model...")
rvc = RVCInference(device="cpu:0")
rvc.load_model(model, version="v2", index_path=index)

for p in pitches:
    out = str(here / "work" / f"egirl_pitch{p:+d}.wav")
    rvc.set_params(f0method="rmvpe", f0up_key=p, index_rate=0.66,
                   protect=0.33, filter_radius=3, rms_mix_rate=0.25)
    print(f"[pitch {p:+d}] inferring -> {out}")
    t = time.time()
    rvc.infer_file(inp, out)
    print(f"[pitch {p:+d}] done in {time.time()-t:.0f}s")

print("ALL DONE")
