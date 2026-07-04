#!/usr/bin/env python3
"""Quick crash-isolation test: try one f0 method on the 20s clip."""
import os
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
import sys, time, pathlib
import torch
torch.backends.mps.is_available = lambda: False
torch.backends.mps.is_built = lambda: False
from rvc_python.infer import RVCInference

models_dir = pathlib.Path(os.environ.get("VV_RVC_MODELS_DIR", os.path.expanduser("~/kb-scratch/video-voice/RVC-flow/models")))
work_dir = pathlib.Path(os.environ.get("VV_RVC_WORK_DIR", os.path.expanduser("~/kb-scratch/video-voice/RVC-flow/work")))
model = str(models_dir / "egirl" / "egirl.pth")
index = str(models_dir / "egirl" / "added_IVF2182_Flat_nprobe_1_egirl.index")
inp   = str(work_dir / "clip20.wav")

f0method = sys.argv[1] if len(sys.argv) > 1 else "pm"
pitch    = int(sys.argv[2]) if len(sys.argv) > 2 else 12

rvc = RVCInference(device="cpu:0")
rvc.load_model(model, version="v2", index_path=index)
rvc.set_params(f0method=f0method, f0up_key=pitch, index_rate=0.66, protect=0.33)
out = str(work_dir / f"test_{f0method}_p{pitch}.wav")
print(f"[{f0method} pitch+{pitch}] inferring -> {out}", flush=True)
t = time.time()
rvc.infer_file(inp, out)
print(f"DONE in {time.time()-t:.0f}s -> {out}", flush=True)
