# 090-assemble-run [RUN]

Deterministic final-video assembly. Master timeline = the voiceover; the
VO-aligned screen recording is the base track; avatar-full clips and fullframe
graphics replace it at their exact spans; transparent overlays composite on
top; vo.mp3 is the only audio. Whip transitions at screen↔avatar boundaries (default). The editor handoff
bundle (renders/ + manifest.md + avatar clips + avatar-manifest.md) is
unchanged — final.mp4 is an additional output.

In: videos/<slug>/{screen.mp4, vo.mp3, resolved.json, renders/, avatar-jobs.json (clips downloaded)}
Out: ~/kb-scratch/video/visuals-flow/<slug>/final.mp4 + videos/<slug>/assembly.md

    bash steps/090-assemble-run/run.sh <slug> [--screen <path>] [--screen-offset <sec>] [--out <path>] [--draft] [--encoder x264|videotoolbox] [--keep-temp] [--force] [--transitions whip|none]

Gates: cues approved + fresh, shots approved with every avatar-full job
downloaded (skipped when shots.json absent), all renders present. screen.mp4
is owner-provided and never committed.

Speed: overlays are composited inside the segment encodes and the final pass
is a stream-copy remux — one encode per frame. The encoder auto-selects
h264_videotoolbox (Apple hardware) when available, libx264 otherwise;
`--encoder` overrides. `--draft` renders a 1280x720 preview to
`final-draft.mp4` (never clobbers `final.mp4`).

## Transitions

Whip-pan transitions (fast slide + motion blur) happen at screen↔avatar and avatar↔screen boundaries by default. Pass `--transitions none` for hard cuts everywhere.
A boundary falls back to a hard cut if:
- A neighbor segment is shorter than 1.0s.
- An overlay straddles the transition window (±0.2s from the boundary).
- The boundary is at `t=0` or `t=total`.
