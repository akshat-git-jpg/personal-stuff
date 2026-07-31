# 110 · build video · [RUN]

Deterministic final-video assembly. Master timeline = the voiceover; the
VO-aligned screen recording is the base track; avatar-full clips and fullframe
graphics replace it at their exact spans; transparent overlays composite on
top; vo.mp3 is the only audio. Whip transitions at screen↔avatar boundaries (default). The editor handoff
bundle (renders/ + manifest.md + avatar clips + avatar-manifest.md) is
unchanged — final.mp4 is an additional output.

In: videos/<slug>/{screen.mp4, vo.mp3, resolved.json, renders/, avatar-jobs.json (clips downloaded)}
Out: ~/kb-scratch/video/visuals-flow-2/<slug>/final.mp4 + videos/<slug>/assembly.md

    bash steps/110-build-video-run/run.sh <slug> [--screen <path>] [--screen-offset <sec>] [--out <path>] [--draft] [--encoder x264|videotoolbox] [--keep-temp] [--force] [--transitions whip|none] [--jobs N] [--no-cache] [--bare]

## Caching

Segment encodes are cached to `assembly-cache/` by a content hash covering all inputs, sizes, modifications, and ffmpeg arguments. A warm run only re-encodes changed segments. To bust the cache, delete the folder or use `--no-cache`. Old cache files are pruned automatically after 14 days.
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

## Captions

Captions are burned onto all screen segments by default, formatted as a single line of white text with a dark edge at the bottom-center. They are driven by the word-level timestamps in the transcript and automatically excluded from avatar and graphic segments. Pass `--captions off` to disable them.

## Refresh beats

Inside long avatar spans, the pipeline automatically inserts a "refresh beat" every ~20s: a color flash cut to a slightly punched-in version of the same shot. Beats snap to the nearest inter-word silence gap to never blink mid-word. Pass `--beats off` to disable.

## Ken Burns drift

Screen segments ≥4s get a slow Ken Burns drift (alternating zoom in/out, max 5%) applied underneath captions. Pass `--drift off` to disable.

## Placeholder-avatar drafts (owner ask 2026-07-31)

A `--draft` assemble no longer waits for HeyGen: any avatar-full span whose
clip has not been downloaded renders the template's reference still (from
`video/heygen/registry.json`), dimmed and labelled "AVATAR PLACEHOLDER", with
hard cuts at its boundaries. The version registers `placeholder: true` and the
board's version picker shows "· placeholder avatar". Review starts
immediately; re-run the cut after `avatar-download` completes and the real
clips swap in automatically (the file's presence changes the segment cache
key). The full-resolution FINAL assemble still refuses missing clips.
