# yt-style-copy — independent video-style-dna pipeline

**Date:** 2026-07-05
**Status:** Approved design; implementation plan next.

## Goal

The `yt-style` skill currently clones a competitor channel's *script* (voice, hooks,
structure, phrasing) from transcripts only. Add a fully independent second pipeline that
clones a channel's *visual editing style* — cut pacing, B-roll usage, on-screen
text/captions, motion graphics/animation, thumbnail style, framing — from downloaded video.
The two pipelines must be usable separately: some channels only warrant a script pack,
some only a video pack, some both. Rename the skill itself from `yt-style` to
`yt-style-copy` in the same pass.

## Current state (before this change)

`tooling/claude-skills/yt-style/SKILL.md` verbs, already renamed once this session from
their original names (`ingest`→`fetch-transcripts`, `distill`→`build-style-dna`,
`topics`→`suggest-topics`, `titles`→`suggest-titles`, `script`→`write-script`):

- `fetch-transcripts <channel-url>` → runs `pipelines/youtube/competitor-styles/ingest.py`
  (catalog + transcripts via yt-dlp + `pp-yt-transcript`, no media download).
- `build-style-dna <slug>` → distills all transcripts into `style-dna.md` + `rubric.md` +
  `exemplars/`.
- `suggest-topics <slug>`, `suggest-titles <slug> "<topic>"`, `write-script <slug> "<topic>"`
  → generation verbs, read only `style-dna.md`/`rubric.md`/`exemplars/`/`videos.json`.

This spec: (a) renames `build-style-dna` → `build-script-style-dna` and its artifact
`style-dna.md` → `script-style-dna.md` for symmetry with the new video side, (b) adds
`fetch-video` and `build-video-style-dna`, (c) renames the skill folder/name to
`yt-style-copy`.

## Independence & shared catalog

Script and video pipelines share only the channel catalog (`channel.json`, `videos.json`).
Whichever command runs first (`fetch-transcripts` or `fetch-video`) creates the catalog via
the existing `yt-dlp --flat-playlist` + `select()` logic, refactored out of `ingest.py` into
a small shared `catalog.py` imported by both `ingest.py` and the new `fetch_video.py`. The
other command reuses the catalog if present instead of re-fetching it.

Neither `build-script-style-dna` nor `build-video-style-dna` checks for the other
pipeline's artifacts. A channel folder can validly have transcripts only, video data only,
or both. `suggest-topics`/`suggest-titles`/`write-script` stay tied to
`script-style-dna.md` only — they are simply unavailable for a video-only pack, and that's
fine; no cross-pollination between the two DNA types.

## Two-tier economy for video analysis

Full LLM-vision analysis of every frame of every video would burn tokens without bound and
doesn't scale. Split into:

- **Tier 1 (free, no LLM):** `ffmpeg`/`ffprobe` scene-cut detection on every fetched video →
  cuts-per-minute, shot-length distribution. Computed for the whole catalog, cheaply.
- **Tier 2 (LLM vision, costs tokens):** only on a capped, representative subset of videos
  (top outlier + typical + one per distinct visual format — same selection philosophy as
  the script pipeline's exemplar picks, extended to flag anomalous cuts/min as an outlier
  signal too) and a capped, deduped frame set per video. This is where B-roll, captions,
  motion graphics, and framing get described.

This gives full-channel quantitative coverage for free and bounded, deep qualitative detail
on a representative sample — no analysis lost, token spend controlled.

## `fetch-video <channel-url> [--limit 30]`

Mechanical, no LLM (mirrors `fetch-transcripts`). New script
`pipelines/youtube/competitor-styles/fetch_video.py`. For every catalog-selected video not
already in `video-metrics.json`:

1. Download at 720p via `yt-dlp` (legible for on-screen text/motion graphics; far lighter
   than 1080p+; resolution doesn't matter for thumbnail sharpness, which isn't a goal here).
2. Run scene-cut detection → append cuts-per-minute + shot-length distribution to
   `video-metrics.json` (permanent, covers every fetched video).
3. Extract a deduped frame set (every scene-cut + one frame per ~2s, to catch animated
   sequences and motion graphics that unfold without a hard cut; near-duplicate frames
   dropped before they ever reach Claude) into a gitignored scratch cache
   `channels/<slug>/.video-cache/<video_id>/`.
4. Delete the raw video file immediately — peak disk usage is one video at a time, not the
   whole catalog. Re-running later picks up new uploads only, same as `fetch-transcripts`.

## `build-video-style-dna <slug>`

The expensive LLM pass (mirrors `build-script-style-dna`). Requires `video-metrics.json`
to be non-empty.

1. Use view counts + cut-metrics to pick the representative subset of videos (Tier 2).
2. Read that subset's cached frames from `.video-cache/`, batch them into vision analysis,
   append raw observations to a scratch `video-distill-notes.md` (deleted once synthesis is
   done, mirrors `distill-notes.md`).
3. Synthesize `video-style-dna.md` with these sections, every claim backed by a video id +
   timestamp (same evidentiary rigor as `script-style-dna.md`):
   - **Identity snapshot** — visual format(s), overall visual energy, dominant color/
     aesthetic.
   - **Cut pacing** — backed by the full-catalog `video-metrics.json` numbers, not just the
     vision sample; how pacing varies by video length/format.
   - **B-roll patterns** — frequency, typical sources, examples.
   - **On-screen text & captions** — burned-in caption/lower-third/callout style, timing
     relative to speech.
   - **Motion graphics & animation** — kinetic typography, transitions, animated overlays.
   - **Thumbnail style** — composition/color/text patterns.
   - **Framing & composition** — camera angle/framing habits.
   - **Do-not list** — visual patterns this channel never uses.
4. Copy ~15-20 evidence frames into `frames/exemplars/` (small, deliberate exception to the
   pack's "text only" convention — lets a claim be visually spot-checked later). Delete the
   rest of `.video-cache/`.

No `video-rubric.md`: nothing consumes it. `write-script` stays script-only (confirmed) —
video-style-dna is a standalone artifact for now; a future storyboard-type command would be
the first real consumer, and a rubric can be added then if it needs QC scoring.

## File layout

```
channels/<slug>/
├── channel.json / videos.json      # shared catalog
├── transcripts/                    # script pipeline only
├── script-style-dna.md             # renamed from style-dna.md
├── rubric.md                       # unchanged — script-side only, name stays unambiguous
├── exemplars/                      # script pipeline only
├── video-metrics.json              # video pipeline only — every fetched video
├── video-style-dna.md              # video pipeline only
├── frames/exemplars/               # video pipeline only — small evidence set
├── .video-cache/                   # gitignored scratch, ephemeral
└── output/
    ├── topics.md
    └── scripts/<slug>/
```

## Skill rename → `yt-style-copy`

- `git mv tooling/claude-skills/yt-style tooling/claude-skills/yt-style-copy`.
- `SKILL.md`: frontmatter `name: yt-style-copy`; description/triggers updated to list all
  seven verbs (`fetch-transcripts`, `build-script-style-dna`, `suggest-topics`,
  `suggest-titles`, `write-script`, `fetch-video`, `build-video-style-dna`).
- Update whichever of `manifest/work.txt` / `manifest/personal.txt` list `yt-style`, rerun
  `scripts/relink.sh`, restart the session (skill discovery is cached).
- Fix the one cross-reference in `pipelines/youtube/competitor-styles/CLAUDE.md` (folder
  path + `/yt-style build-style-dna` mention).
- If any channel pack already has the old `style-dna.md` filename, rename it to
  `script-style-dna.md` during implementation (check `channels/` for existing packs first).

## Error handling

Reuse `fetch-transcripts`'s existing patterns in the new `fetch_video.py`: bail out early
if the first 5 videos all fail to download (residential-IP hint — same rule the pipeline
already applies to transcript fetches), skip individual failures with a logged reason, fail
fast at startup if `ffmpeg`/`yt-dlp` isn't installed.

## Non-goals

- No audio/sound-design analysis (music, SFX, pacing of speech) — visual editing style only.
- No change to `write-script`'s output format or inputs.
- No `video-rubric.md` or QC scoring until a real consumer needs it.
- No cloud/paid video-analysis APIs — same zero-API-keys, subscription-only-LLM constraint
  as the script pipeline.
