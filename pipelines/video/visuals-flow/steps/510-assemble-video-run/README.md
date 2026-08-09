# 510 · build the video · [RUN]

Deterministic final-video assembly. Master timeline = the voiceover; the
VO-aligned screen recording is the base track; avatar-full clips and fullframe
graphics replace it at their exact spans; transparent overlays composite on
top; vo.mp3 is the only audio. Whip transitions at screen↔avatar boundaries (default). The editor handoff
bundle (renders/ + manifest.md + avatar clips + avatar-manifest.md) is
unchanged — final.mp4 is an additional output.

In: videos/<slug>/{screen.mp4, vo.mp3, resolved.json, renders/, avatar-jobs.json (clips downloaded)}
Out: ~/kb-scratch/video/visuals-flow/<slug>/final.mp4 + videos/<slug>/assembly.md

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

## Timeline integrity (why the cut cannot drift out of sync)

The cut is built as ~100 independently encoded pieces that are concatenated,
then muxed against the voiceover. If the pieces do not add up to exactly the
length of the audio, the picture slides against the voice, a little more with
every piece, and the end of the video is the worst affected.

That happened on consistent-ai-influencer (2026-08-07). Pieces were encoded
with `-t <float seconds>`; ffmpeg turns that into `floor(dur * fps)` frames, so
each piece quietly dropped its sub-frame remainder. Across 104 pieces the
remainders came to 1.562s of missing video against a 1230.229s master, and the
avatar read about 1.5s out of lip-sync by the last clip. The 25fps HeyGen
clips were the obvious suspect and were nearly innocent: they accounted for
0.24s. The rest came from ordinary graphic and screen segments.

Three things now have to fail together for that to recur.

1. **The remainder is carried, not dropped.** `framesUntil()` in `lib/assemble.mjs`
   gives a piece the difference between the frame its end lands on and the frame
   the previous piece ended on, anchored to the segment plan's absolute times.
   Rounding is re-absorbed at every boundary, so it can never accumulate. Pieces
   encode with `-frames:v N` rather than `-t`, so the frame count is stated
   outright instead of inferred from a float.
2. **A pre-encode invariant, exact.** Before anything is encoded, the pieces'
   total frames must equal `round(total * fps)` exactly. It costs nothing and
   fails in about two seconds instead of after a full encode. This is what
   catches a segment plan that does not fill the timeline, or a new effect
   module that appends a piece without walking the frame clock.
3. **An A/V length gate after the mux.** The video stream is compared against
   the audio stream, tolerance three frames (enough for the AAC encoder's tail
   padding, far under the ~50ms where a viewer notices). The previous check read
   `format=duration`, which is the container's length and therefore the longest
   stream in it, so a short video stream under full-length audio passed it every
   time. That is the specific reason the bug shipped unseen.

One thing guard 2 deliberately does not catch: a single piece coming out a frame
short. `framesUntil` re-anchors on the next boundary, so the following piece
takes that frame back. That is the carry working, and a local wobble of one
frame is both sub-perceptual and incapable of accumulating.

**If you are adding a segment kind, effect module or transition:** append to
`concatLines` and walk `framePos` in the same breath. Guard 2 will stop you if
you forget, before you spend two minutes encoding.

**Testing this needs off-grid fixtures.** `floor(dur * fps)` is exact when the
boundary already sits on the frame grid, so a fixture built at whole seconds
cannot tell a carried remainder from a dropped one. Every integration fixture
here used round numbers, which is why the suite stayed green through the whole
life of the defect. The fixture named "OFF-GRID spans" in `lib/assemble.test.mjs`
exists for this: its spans are 1.07 to 4.43, 6.91 to 9.29 and 11.53 to 15.17 in
an 18.37s timeline, and it asserts an exact packet count. Reintroducing the old
truncation fails it. Keep new timing fixtures un-round.

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
