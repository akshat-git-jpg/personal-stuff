# 105 · voice-autoqc  ·  [RUN]

Cut the listening burden of step 110 from "the whole video" to "only the flagged chunks".
Deterministic checks, no LLM.

- **In:** `../080-synthesize-voice-run/output/<base>.work/clips/*.wav` + `chunks.json`
- **Out:** `output/<base>.voice-qc.json` (per chunk: pass/flag + reason) and a printed summary
- **How:** `python3 run.py --base <base>`. Three checks per chunk: (1) re-transcribe with the
  same ASR and compare against the chunk's script text, flag when word error rate exceeds the
  threshold; (2) loudness/clipping outliers vs the video's median; (3) duration sanity vs a
  words-per-second band. Thresholds live at the top of `run.py`.
- **Next:** step 110, where you listen only to flagged chunks instead of everything
