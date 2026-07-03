# video-voice

Voiceover pipeline for tutorial videos — turning a male-voiced screen recording into a clean female voiceover, plus avatar work. Each sub-folder is its own flow with a `CLAUDE.md`.

- `tts-flow/` — the production system: messy male recording → clean, accent-neutral female voiceover kept in sync with the video.
- `RVC-flow/` — male→female voice conversion using a local, free RVC v2 model (macOS / Apple Silicon).
- `heygen/` — HeyGen avatar experiments.

> Stub scaffolded by `/audit-repo-route` — flesh out as needed.
