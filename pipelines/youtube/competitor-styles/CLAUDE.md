# competitor-styles — clone a competitor channel's script style

One self-contained **style pack** per competitor channel. Ingest transcripts
once (zero API keys, via yt-dlp), distill once into a Style DNA profile, then
generate topics/titles/scripts cheaply forever. The generation workflow is the
`yt-style` skill (`tooling/claude-skills/yt-style/`); this folder is its data.

## Layout

    channels/<slug>/
    ├── channel.json        # channel url/name, last ingest date
    ├── videos.json         # full catalog: id, title, views, duration, url
    ├── transcripts/        # one cleaned .md per video (frontmatter + text)
    ├── style-dna.md        # distilled profile — written by /yt-style distill
    ├── rubric.md           # style-fidelity checklist — written by distill
    ├── exemplars/          # 2-3 full transcripts kept as few-shot references
    └── output/
        ├── topics.md       # dated batches of topic + title suggestions
        └── scripts/<slug>/ # outline.md + script.md per generated video

## Commands

    # Ingest (or re-run later to pick up new uploads — already-fetched ids are skipped)
    python3 ingest.py https://www.youtube.com/@<channel> --limit 30

Stdlib-only; needs the system `yt-dlp` binary (catalog + metadata) and the
repo's `tooling/cli/youtube/pp-yt-transcript` CLI (transcript text, cached).
No venv, no API keys, never downloads media. Run from the Mac — YouTube
blocks transcript fetches from datacenter IPs (see the pp-yt-transcript README).

## Conventions

- Everything in a style pack is committed (small text only; media never lands here).
- Transcripts are regenerable — if one looks garbled, delete it and re-run ingest.
- New competitor = one `ingest.py` run + one `/yt-style distill <slug>` session.
- Scale note: if a pack someday holds 100+ transcripts and topic research no
  longer fits in context, add a local embedding index THEN (decided 2026-07-05:
  no RAG/vector DB before that point; never for style itself).
