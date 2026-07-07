# 3/050 · make-timestamped-transcript  ·  [RUN]  (final voiceover step)

Re-transcribes the final trimmed voiceover with word+segment timestamps.
This output is the TIMING SPINE for stage 4 (motion graphics render to fit
these timestamps, not the other way around).

- **In:** `../020-trim-silence-run/output/<base>.voice.trim.wav`
- **Out:** `output/<base>.srt`, `output/<base>.timestamps.txt`, `output/<base>.timestamps.json`
- **Run:** `python3 run.py [<voice.trim.wav>]`
- **Next:** `../../4-motion-graphics/010-plan-visuals-opus` reads `<base>.timestamps.json`
