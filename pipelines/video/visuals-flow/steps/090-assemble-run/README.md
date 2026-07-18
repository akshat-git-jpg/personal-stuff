# 090-assemble-run [RUN]

Deterministic final-video assembly. Master timeline = the voiceover; the
VO-aligned screen recording is the base track; avatar-full clips and fullframe
graphics replace it at their exact spans; transparent overlays composite on
top; vo.mp3 is the only audio. Hard cuts, no transitions. The editor handoff
bundle (renders/ + manifest.md + avatar clips + avatar-manifest.md) is
unchanged — final.mp4 is an additional output.

In: videos/<slug>/{screen.mp4, vo.mp3, resolved.json, renders/, avatar-jobs.json (clips downloaded)}
Out: ~/kb-scratch/video/visuals-flow/<slug>/final.mp4 + videos/<slug>/assembly.md

    bash steps/090-assemble-run/run.sh <slug> [--screen <path>] [--screen-offset <sec>] [--out <path>] [--keep-temp] [--force]

Gates: cues approved + fresh, shots approved with every avatar-full job
downloaded (skipped when shots.json absent), all renders present. screen.mp4
is owner-provided and never committed.
