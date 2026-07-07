# 3/030 · voice-autoqc  ·  [RUN]

Cuts the listening burden of step 040 from "the whole video" to "only the
flagged chunks". Deterministic checks, no LLM.

- **In:** `../010-synthesize-voice-run/output/<base>.work/clips/*.wav` + `chunks.json`
- **Out:** `output/<base>.voice-qc.json` (per chunk: pass/flag + reason)
- **How:** `python3 run.py --base <base>`. Checks: WER vs script text, loudness/clipping
  outliers, duration vs words-per-second band.
- **Next:** step 040, where you listen only to flagged chunks
