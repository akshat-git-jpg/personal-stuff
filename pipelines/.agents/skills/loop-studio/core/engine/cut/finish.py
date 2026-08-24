#!/usr/bin/env python3
"""THE finishing pipeline for a talking-head cut — run after you've authored keepers.json.
Chains the three non-negotiable finishing passes so a cut is never shipped without them:

  1. wave_snap  — snap every keeper's LEADING edge to the true waveform onset (kills ASR-drift
                  dead air the render's 1.3s edge-snap can't reach). Rewrites keepers.json.
  2. level_cut  — render (both-edge waveform refine) + per-take static-gain leveling + loudnorm -14.
  3. tighten    — compress silences >0.3s to ~0.13s, never isolate a <1s section, always trim
                  leading/trailing dead air.

Usage: finish.py RAW keepers.json OUT.mp4
Then ALWAYS: cut.py verify OUT.mp4  + a waveform gap check (see METHOD.md 'Verify on the render')."""
import sys, os, subprocess, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); PY = sys.executable
raw, kf, out = sys.argv[1], sys.argv[2], sys.argv[3]
tmp = tempfile.mktemp(suffix=".mp4")
print("1/3 wave_snap (leading edge -> waveform onset)...")
subprocess.run([PY, f"{HERE}/wave_snap.py", raw, kf], check=True)
print("2/3 level_cut (render + per-take level + loudnorm)...")
subprocess.run([PY, f"{HERE}/level_cut.py", raw, kf, tmp], check=True)
print("3/3 tighten (dead-air + min-section)...")
subprocess.run([PY, f"{HERE}/tighten.py", tmp, out, "0.13", "-30dB", "0.28", "0.7"], check=True)
try: os.remove(tmp)
except OSError: pass
print(f"finished -> {out}   (now run: cut.py verify {out})")
