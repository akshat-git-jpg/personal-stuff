# 165 · review-draft-cut  ·  [HUMAN]

Watch the draft cut once. This gate replaces the editor's timeline work with a QC pass.

- **In:** `../162-auto-assemble-run/output/<base>.draft-cut.mp4` + the flagged-segment list
  step 162 printed
- **Out:** approval, or a fix list
- **How:** watch at 1.5x with the flag list next to you. Three verdicts per issue:
  1. A flagged segment looks wrong: adjust that segment's in/out or speed in the assembly
     plan JSON by hand and rerun step 162 (it is deterministic and fast).
  2. A voice chunk sounds bad even after 110: send that chunk back through the 080 redo loop.
  3. A graphic misses its intent: redo that one cue in step 135.
  Escalate to a freelance editor only when a video needs real editorial surgery; the package
  from step 170 still contains everything they would need.
- **Next:** step 170 packages/uploads the approved cut
