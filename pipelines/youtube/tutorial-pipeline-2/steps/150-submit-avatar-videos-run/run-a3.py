#!/usr/bin/env python3
"""
Step 150 (A3) — submit the corner Avatar III talking-head renders.  [RUN]

  python3 run-a3.py [<base>]                 # submit one render per corner part (no polling)

Input:  ../090-plan-corner-render-parts-run/output/corner-parts/*.wav  (≤7-min parts, kept separate)
Records each job in output/<base>.heygen-manifest.json. Downloading finished videos is step 160.
Config + anti-ban pacing + usage checks: ../../shared/heygen_config.py (FLOWS['a3']).
"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import _orchestrate  # noqa: E402

if __name__ == "__main__":
    _orchestrate.main("a3")
