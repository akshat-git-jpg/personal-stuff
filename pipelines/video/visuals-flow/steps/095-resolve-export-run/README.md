# 095 — Resolve timeline export

Same gates as assembly (the exporter enforces them itself: cues approved +
rendered, shots approved with clips downloaded, screen.mp4 present).

    bash steps/095-resolve-export-run/run.sh <slug> [--baked] [--bundle] [--force]

DEFAULT is the NATIVE layered project (near-instant, no encoding):
continuous screen on the spine, avatar/graphics/overlays/FX clips each on
their own lane (every effect a copyable clip), markers for dropped
transform-effects, sidecar captions.srt.

`--baked` = the WYSIWYG pre-encoded variant (plays exactly like final.mp4; for ship checks).

Out: `~/kb-scratch/video/visuals-flow/<slug>/resolve-export/`

Import: DaVinci Resolve → File → Import → Timeline → timeline.fcpxml,
then File → Import → Subtitle → captions.srt. Effect LOOK tweaks stay
effects.json + re-export; structural edits are native drags now.
