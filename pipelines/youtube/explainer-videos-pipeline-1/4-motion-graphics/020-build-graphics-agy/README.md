# 4/020 · build-graphics  ·  [AGY · Antigravity CLI]

Authors and renders the Hyperframes composition per `010`'s visual plan. Runs
via the Antigravity CLI (`agy`) — this is an UNATTENDED step; it renders
without pausing for interactive Studio approval (see rulebook.md for why),
with human review happening afterward at `030`.

- **In:** `../010-plan-visuals-opus/output/<base>.visual-plan.md`
- **Out:** `output/<base>.motion.mp4` (rendered composition, duration exactly
  matching the voiceover) + `output/snapshots/` (the pre-render visual smoke test)
- **How:** follows `rulebook.md`. MUST render and inspect the actual output
  (post-render ffprobe duration check + eyeball the snapshots) before being
  considered done — an unrendered or unchecked composition is not done.
- **Next:** step 030 (human review), then `../../5-final-video-sync/010` muxes this with the voiceover.
