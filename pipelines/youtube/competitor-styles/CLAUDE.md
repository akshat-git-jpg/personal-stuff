# competitor-styles — clone a competitor channel's script and/or video style

One self-contained **style pack** per competitor channel, with two independent
sides. Script side: ingest transcripts once (zero API keys, via yt-dlp),
distill once into a Script Style DNA profile, then generate topics/titles/
scripts cheaply forever. Video side: fetch cut-pacing metrics + cached frames
once, distill once into a Video Style DNA profile. A channel can have one side,
the other, or both — neither checks for the other's artifacts. The generation
workflow is the `yt-style-copy` skill (`tooling/claude-skills/yt-style-copy/`);
this folder is its data.

## Layout

    channels/<slug>/
    ├── channel.json        # shared catalog identity; "transcripts"/"video" sub-keys per pipeline
    ├── videos.json         # shared full catalog: id, title, views, duration, url
    ├── transcripts/        # script pipeline only — one cleaned .md per video
    ├── script-style-dna.md # script pipeline only — written by /yt-style-copy build-script-style-dna
    ├── rubric.md           # script pipeline only — style-fidelity checklist
    ├── exemplars/          # script pipeline only — 2-3 full transcripts as few-shot references
    ├── video-metrics.json  # video pipeline only — per-video cut/shot-length stats (every fetched video)
    ├── video-style-dna.md  # video pipeline only — written by /yt-style-copy build-video-style-dna
    ├── frames/exemplars/   # video pipeline only — small evidence-frame set kept after distillation
    ├── .video-cache/       # video pipeline only — gitignored scratch, emptied by build-video-style-dna
    └── output/
        ├── topics.md       # dated batches of topic + title suggestions
        └── scripts/<slug>/ # outline.md + script.md per generated video

## Commands

    # Transcripts (or re-run later to pick up new uploads — already-fetched ids are skipped)
    python3 ingest.py https://www.youtube.com/@<channel> --limit 30

    # Video (or re-run later to pick up new uploads — already-measured ids are skipped)
    python3 fetch_video.py https://www.youtube.com/@<channel> --limit 30

Stdlib-only; needs the system `yt-dlp` binary (catalog + metadata, and video
download for `fetch_video.py`) plus `ffmpeg`/`ffprobe` for cut-detection and
frame extraction. `ingest.py` also needs the repo's
`tooling/cli/youtube/pp-yt-transcript` CLI (transcript text, cached). No venv,
no API keys. `ingest.py` never downloads media; `fetch_video.py` downloads
each video at 720p but deletes it immediately after measuring it — nothing
raw is kept. Run from the Mac — YouTube blocks transcript fetches from
datacenter IPs (see the pp-yt-transcript README).

## Conventions

- Everything kept in a style pack is committed (small text + a handful of
  evidence images; raw video and the working frame cache never land here —
  see `.video-cache/` above, gitignored).
- Transcripts are regenerable — if one looks garbled, delete it and re-run ingest.
- New competitor (script style) = one `ingest.py` run + one
  `/yt-style-copy build-script-style-dna <slug>` session.
- New competitor (video style) = one `fetch_video.py` run + one
  `/yt-style-copy build-video-style-dna <slug>` session — independent of the
  script pipeline.
- Scale note: if a pack someday holds 100+ transcripts and topic research no
  longer fits in context, add a local embedding index THEN (decided 2026-07-05:
  no RAG/vector DB before that point; never for style itself).
