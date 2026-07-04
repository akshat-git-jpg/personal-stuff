# 090 · write-scenes-manifest · [RUN · free]

**Job:** Zip the storyboard’s scene list with measured durations into the machine manifest the scaffolder reads.

**In:** `videos/<slug>/storyboard.md` (```scenes block) + `videos/<slug>/durations.json`
**Out:** `videos/<slug>/scenes.json` — `[{n,slug,dur}]`

**Run:** `node steps/090-write-scenes-manifest-run/run.mjs --video <slug>`
**Then:** proceed to 100.

**Cost:** **None** (deterministic parse — was Opus authoring, now free).
