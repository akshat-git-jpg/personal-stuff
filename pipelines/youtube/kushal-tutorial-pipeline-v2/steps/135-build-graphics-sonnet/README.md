# 135 · build-graphics  ·  [SONNET · Claude Code]

Render the visual plan's motion graphics as finished clips BEFORE assembly, so no editor
skill is needed downstream. This step runs in Claude Code (Sonnet) because it uses the
hyperframes skill stack; it is the one quality-critical build step that stays on Claude.

- **In:** `../130-plan-visuals-sonnet/output/<base>.visual-plan.md` (each cue has a timestamp,
  a duration, and an intent) + brand kit in `../../shared/`
- **Out:** `output/clips/<cue-id>.mp4` (full-frame inserts) and `output/overlays/<cue-id>.mov`
  (transparent overlays), one per visual cue, each exactly its cue's duration
- **How:** in a Claude Code session on Sonnet, follow `rulebook.md`. Graphics are authored
  with the hyperframes skills (motion-graphics for callouts/stats, faceless-explainer shot
  blueprints for concept inserts) and rendered locally. Cue duration comes from the visual
  plan, so clips drop onto the timeline without trimming.
- **Next:** step 162 composites these at their timestamps
