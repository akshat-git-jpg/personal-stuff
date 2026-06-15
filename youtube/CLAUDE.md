# youtube — core YouTube logic

Wrapper for everything that directly produces or operates on YouTube channel content. Each subfolder is one use case and has its own `CLAUDE.md`.

## Subfolders

| Folder | Purpose | Stack |
|---|---|---|
| [`yt-analysis/`](yt-analysis/CLAUDE.md) | YT tracker sheet sync + LLM-driven affiliate-link workflow | Python |
| [`tracker-app/`](tracker-app/CLAUDE.md) | Role-aware Kanban over the tracker sheet; also mints go.agrolloo.com short links | TypeScript (CF Worker + React) |
| [`analytics-app/`](analytics-app/CLAUDE.md) | YT Analytics dashboard — per-video/per-link click counts over go.agrolloo.com | TypeScript (CF Worker + React) |
| [`keyword-research/`](keyword-research/CLAUDE.md) | Scan competitor channels for affiliate opportunities | Python |
| [`yt-research/`](yt-research/CLAUDE.md) | Niche → knowledge-base pipeline (Phase 1, Gemini) | TypeScript |
| [`yt-script/`](yt-script/CLAUDE.md) | Knowledge-base → final video script (Phase 2) | Markdown workflow |
| [`my-yt/`](my-yt/CLAUDE.md) | Personal channel notes (free-form) | Markdown |

## What's NOT here (intentional)

- `common/` (repo root) — shared Python helpers. Stays at root because it auto-loads `.env` from `../` (its package location).
- `workers/redirector/` (repo root) — CF Worker is deployable infrastructure, conceptually separate from channel-content code.
- `docs/`, `n8n-website/`, `to-do/` (repo root) — non-YT-logic.

## Pipeline relationships

- **Niche → script:** `yt-research/` (Phase 1, TS) → `yt-script/` (Phase 2, markdown). See [`docs/research-and-script-workflow.md`](../docs/research-and-script-workflow.md) for the master flow.
- **Affiliate tracking:** `tracker-app/` (or legacy `yt-analysis/process_yt_tracker.py`) writes short URLs to KV/D1; `workers/redirector/` (root) serves the redirects; `yt-analysis/sync_clicks.py` syncs dedup'd counts back to the sheet, and `analytics-app/` reads the same D1 read-only to show a live click dashboard at yt-analytics.agrolloo.com.
- **Competitor research:** `keyword-research/` is standalone — feeds the human's decision on which tools to make videos about.

## Python imports

Scripts under `youtube/yt-analysis/` and `youtube/keyword-research/` walk up 2 levels to put the repo root on `sys.path`, so `from common.x import y` works. The prelude is:

```python
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
```

If you add a new Python sub-project here, copy that exact prelude.
