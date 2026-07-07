# Rulebook — 4/020 build-graphics

Runs via the Antigravity CLI. This step is UNATTENDED — no one is at Studio
to click approve, so it substitutes `hyperframes snapshot` for the
interactive `preview` pause that hyperframes-cli's own docs describe for
attended authoring sessions (see `hyperframes-cli` SKILL.md's own "Minimum
Completion Gate" for non-interactive contexts — this is the prescribed
agent-mode path, not a bypass of it). Human review happens AFTER render, at
step `030`, matching how `tutorial-pipeline-2`'s `135-build-graphics-sonnet`
already renders before its own human review at `140`.

1. If no Hyperframes project exists yet in this step's folder, scaffold one:
   `npx hyperframes init hf-project --non-interactive --example` inside
   `020-build-graphics-agy/`. Reuse the same `hf-project/` across runs — only
   the composition HTML content changes per video.
2. Read `../010-plan-visuals-opus/output/<base>.visual-plan.md`. Author the
   composition's HTML per the `hyperframes-core` skill's composition
   contract, one scene/sub-composition per cue, using the runtime/animation
   adapter that best fits each cue's intent (see `hyperframes-animation` for
   blueprints — GSAP is the default runtime). Set the project's total
   duration to the plan's target duration exactly (from the plan's last cue's
   `end` timestamp).
3. Static gates: `npx hyperframes lint` and `npx hyperframes validate` — both
   must pass clean before continuing.
4. Visual smoke test (the unattended substitute for `preview`):
   `npx hyperframes snapshot --frames 9` (or `--at <cue-timestamps>` if you
   want one frame per cue instead of an even sample). Inspect every frame in
   `snapshots/` against the visual plan's stated intent per cue — this is the
   actual "look at it" requirement; do not skip it or treat a clean `lint`/
   `validate` as sufficient on its own.
5. Render: `npx hyperframes render --quality high --output ../output/<base>.motion.mp4`.
6. Post-render verification (required, not optional):
   ```bash
   [ -s ../output/<base>.motion.mp4 ] || echo "render produced no output"
   ffprobe -i ../output/<base>.motion.mp4 -show_format -v error
   ```
   Compare the reported duration against the plan's target duration (from
   `010`'s output). If they differ by more than 0.5 seconds, the composition's
   timeline length is wrong — fix the composition's duration setting and
   re-render; do not proceed with a mismatched render (stage 5's mux step
   will hard-fail on it anyway, so catching it here saves a round-trip).
7. Copy the smoke-test snapshots into `output/snapshots/` (keep them — they're
   the evidence the human reviewer at `030` and any later verifier looks at).
8. Report: cue count rendered, final duration vs target, snapshot count, and
   run `npx hyperframes feedback --rating <1-5> --comment "..."` once per the
   hyperframes-cli skill's own convention.
