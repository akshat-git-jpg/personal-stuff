#!/usr/bin/env python3
"""
Step 150 (A4) — submit the full-screen HeyGen 4 avatar renders.  [RUN]

  python3 run-a4.py [<base>]                 # submit one render per per-block clip (no polling)

Input:  ../../4-voiceover/080-synthesize-voice-run/output/avatar-audio/*.wav  (one render per block, never chunked)
Records each job in output/<base>.heygen-manifest.json. Downloading finished videos is step 160.
Config + anti-ban pacing + usage checks: ../../shared/heygen_config.py (FLOWS['a4']).
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import _orchestrate  # noqa: E402

if __name__ == "__main__":
    _orchestrate.main("a4")
