# heygen — the avatar asset hub

Single home for everything avatar: character reference assets, the id registry, render
manifests, and the generation flows. Consuming pipelines (tutorial-pipeline-1,
final-workflow, …) resolve a character **slug** here and read/write media paths — they never
own avatar assets themselves. Created 2026-07-12 (consolidated from `video/voice/heygen/`,
`youtube/open-source/avatar/`, and the registry/manifest formerly inside `tooling/cli/heygen-web/`).

## Layout

- `registry.json` — slug → HeyGen `avatar_id`/`template_id`, source-image path, notes. THE
  single source of truth for character ids; read by `tooling/cli/heygen-web` (override path
  with `HEYGEN_AVATARS`) and `youtube/tutorial-pipeline-1/shared/avatar_mapping.py`.
- `RENDERS.md` — tracked manifest of every avatar video generated. The heygen-web CLI
  auto-appends a row on submit (`HEYGEN_RENDERS_LOG` overrides the path).
- `characters/<slug>/` — tracked reference assets per character: `source.jpeg`, approved
  pose variants, approved base-loop clips. Small + irreplaceable ⇒ tracked (media policy).
- `fal-lipsync/` — the HeyGen-replacement flow (Kling base loop + fal LatentSync lip-sync,
  de-risk test passed 2026-07-11, ~$0.30–0.40/min vs HeyGen Avatar IV's $1/min, holds the
  side-view pose HeyGen can't). Scripts + handoff README + the side-avatar pose images.
- `experiments/` — one folder per one-off experiment (submit payloads, findings). Media from
  experiments goes to kb-scratch, not here.

## Where render media lives (never in the repo)

`~/kb-scratch/video/heygen/<consuming-pipeline>/` — `_test/` for renders tied to no pipeline
(the pre-hub heygen-web renders and fal test clips live in `_test/`; the old
`~/kb-scratch/heygen-web-renders` path is now a symlink to `_test/`). Every render gets a
`RENDERS.md` row pointing at its file.
Renders live in `~/kb-scratch/video/heygen/`. (The media-board gallery was retired 2026-08-25.)

## How to generate

- **HeyGen (today's path):** `tooling/cli/heygen-web` — read its CLAUDE.md first (auth via
  captured cURLs, anti-ban rules). Default is **Avatar III (unlimited on the
  subscription)**; **Avatar IV is supported** via `--iv` / `--engine heygen4` and is used
  for approved final cuts. Avatar IV is not free — every second draws from the
  monthly `/1200` generative-credit pool, so per batch: check `limits` before submit and
  verify the meter with `usage --save` / `usage --diff` (an Avatar IV submit MUST print
  ⚠️NOT-free). Template renders for girl-1/specs-man (the only two template ids left
  after the 2026-08-02 cull); photo-avatar renders for the `avatar_id` characters.
- **fal-lipsync (validated replacement, not yet productized):** see `fal-lipsync/README.md` —
  next step is the owner's verdict on the base clip, then a thin `tooling/cli/` avatar CLI
  via the orchestrate → secretary flow.
- **Batch avatar clips for one video from selected script ranges:**
  `tooling/cli/pp-heygen-batch <video-key>`. Reads
  `videos/<key>/heygen-selections.json` (produced by the yt-script desk's
  avatar mode, plans 266/267), slices the section wavs, dispatches to
  heygen-web per selection, and uploads mp4s to Drive. Refuses if the sum of
  Avatar IV seconds requested exceeds the `/1200` monthly pool remaining.
