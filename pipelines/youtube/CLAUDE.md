# youtube — core YouTube logic

Wrapper for everything that directly produces or operates on YouTube channel content. Each subfolder is one use case and has its own `CLAUDE.md`.

## Subfolders

| Folder | Purpose | Stack |
|---|---|---|
| [`yt-analysis/`](yt-analysis/CLAUDE.md) | YT tracker sheet sync + LLM-driven affiliate-link workflow | Python |
| [`keyword-research/`](keyword-research/CLAUDE.md) | Scan competitor channels for affiliate opportunities | Python |
| [`yt-research/`](yt-research/CLAUDE.md) | Niche → knowledge-base pipeline (Phase 1, Gemini) | TypeScript |
| [`yt-script/`](yt-script/CLAUDE.md) | Knowledge-base → final video script (Phase 2) | Markdown workflow |
| [`my-yt/`](my-yt/CLAUDE.md) | Personal channel notes (free-form) | Markdown |
| [`competitor-styles/`](competitor-styles/CLAUDE.md) | Competitor style packs — transcript/video ingestion + Style DNA for the yt-style-copy skill | Python + Claude skill |
| [`dossiers/`](dossiers/CLAUDE.md) | Persistent per-software research library — one dossier per tool, accumulated from every fetched video transcript | Python + Claude skill |
| [`tutorial-pipeline-1/`](tutorial-pipeline-1/PIPELINE.md) | Drive-in → HeyGen spokesperson clips from an existing avatar → Drive-out. Standalone | Python + Claude steps |
| [`tutorial-pipeline-2/`](tutorial-pipeline-2/PIPELINE.md) | Tutorial recording prep steps (renamed from kushal-tutorial-pipeline-v2, 2026-07-07) | Python + Claude steps |
| [`explainer-videos-pipeline-1/`](explainer-videos-pipeline-1/PIPELINE.md) | Topic + competitor styles → fully-generated explainer video draft. No screen recording, no avatar | Python + Claude steps |
| [`open-source/`](open-source/README.md) | Self-hosted alternatives exploration (avatar/HeyGen-replacement work moved to `../video/heygen/fal-lipsync/` 2026-07-12) | Research/handoff docs |
| [`final-workflow/`](final-workflow/final-workflow-notes.md) | Multi-channel production workflow + per-video cost model (notes) | Markdown |

## What's NOT here (intentional)

- `common/` (repo root) — shared Python helpers. Stays at root because it auto-loads `.env` from `../` (its package location).
- `workers/redirector/` (repo root) — CF Worker is deployable infrastructure, conceptually separate from channel-content code.
- `tracker-app/` — the Kanban UI moved to the **personal-stuff** repo at `apps/tutorial-tracker-app/` (grouped with the other agrolloo.com PWAs). It still reads this sheet and mints `go.agrolloo.com` links; only the UI relocated.
- `docs/`, `n8n-website/`, `to-do/` (repo root) — non-YT-logic.

## Pipeline relationships

- **Niche → script:** `yt-research/` (Phase 1, TS) → `yt-script/` (Phase 2, markdown). See [`docs/research-and-script-workflow.md`](../docs/research-and-script-workflow.md) for the master flow.
- **Affiliate tracking:** the `tracker-app/` UI (now in the **personal-stuff** repo at `apps/tutorial-tracker-app/`) — or legacy `yt-analysis/process_yt_tracker.py` — writes short URLs to KV/D1; `workers/redirector/` (root) serves the redirects; `yt-analysis/sync_clicks.py` syncs dedup'd counts back to the sheet. The live click dashboard (`yt-analytics.agrolloo.com`) reads the same D1 read-only and also lives in personal-stuff at `apps/analytics-app/`.
- **Competitor research:** `keyword-research/` is standalone — feeds the human's decision on which tools to make videos about.

## Python imports

Scripts under `youtube/yt-analysis/` and `youtube/keyword-research/` walk up 2 levels to put the repo root on `sys.path`, so `from common.x import y` works. The prelude is:

```python
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
```

If you add a new Python sub-project here, copy that exact prelude.
