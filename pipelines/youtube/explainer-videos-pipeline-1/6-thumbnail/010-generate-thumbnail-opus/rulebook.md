# Rulebook — 6/010 generate-thumbnail

Run in a Claude Code session on model Opus.

1. Take `--slug <channel>` from the operator.
2. Check `pipelines/youtube/competitor-styles/channels/<slug>/video-style-dna.md`
   exists. If not, STOP and tell the operator: "No video-style-dna.md for
   '<slug>'. Run yt-style-copy build-video-style-dna <slug> first, then
   re-run this step." Do not proceed.
3. Read `video-style-dna.md`'s **"Thumbnail style"** section (composition,
   color, text patterns) and its `frames/exemplars/` directory (representative
   frame images already saved from that channel's own videos) for visual reference.
4. If no Hyperframes project exists yet in this step's folder, scaffold one:
   `npx hyperframes init hf-project --non-interactive --example` inside
   `010-generate-thumbnail-opus/`. Reuse the same `hf-project/` across runs.
5. Author a SHORT composition (a few seconds is enough — you only need one
   good frame) at 1280×720 canvas, matching the Thumbnail-style section's
   composition/color/text patterns, using this video's topic/title text and
   the pipeline's own brand voice — do not copy the competitor's specific
   claims or text verbatim, only the STYLE (composition, color grading, text
   treatment), per the same style-vs-facts guardrail `yt-style-copy` itself
   enforces for scripts.
6. Static gates: `npx hyperframes lint` and `npx hyperframes validate` — both
   must pass clean.
7. Snapshot the frame you want (there is no generic "render one frame" mode —
   `snapshot` is the mechanism): `npx hyperframes snapshot --at 1.0` (adjust
   the timestamp to whichever moment in your short composition looks best).
   Output lands at `snapshots/frame-01-at-1.0s.png`.
8. Eyeball the snapshot. If the canvas isn't already 1280×720, convert:
   `ffmpeg -y -i snapshots/frame-01-at-1.0s.png -vf scale=1280:720 ../output/<base>.thumbnail.jpg`
   (if it's already 1280×720, a plain format conversion is enough — same command works either way).
9. Verify: `[ -s ../output/<base>.thumbnail.jpg ]` and confirm its dimensions
   with `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 ../output/<base>.thumbnail.jpg`
   — expect `1280,720`.
10. Report to the operator: the slug used, the composition idea, and the
    final image path.
