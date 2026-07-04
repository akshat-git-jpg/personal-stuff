# 060 · measure-durations · [RUN · free]

**Job:** Measure each trimmed clip — this is the timing spine every scene length is cut from.

**In:** `videos/<slug>/audio/beatNN.trim.wav`
**Out:** `videos/<slug>/durations.json` — `[{n,dur}]`

**Run:** `node steps/060-measure-durations-run/run.mjs --video <slug>`
**Then:** proceed to 070.

**Cost:** **None** (ffprobe).
