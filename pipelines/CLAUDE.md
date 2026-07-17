# pipelines — Python Workspace operating guide

This workspace holds the content and automation pipelines sharing a single Python runtime and the `common/` package (e.g. YouTube research, scripting, recording prep, Pinterest pin generation, TTS voiceover + avatar asset hubs, bank statement parser, and income analysis).

## Getting started

One-time setup:

```bash
# 1. Python environment
cd <repo-root>/pipelines
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Secrets (already present locally — don't commit)
#    - .env  (copy from .env.example, fill in keys)
#    - credentials.json  (Google service account)

# 3. Share each Google Sheet with the service-account email (client_email in credentials.json) as Editor

# 4. Node subprojects (only for the ones you'll touch)
cd youtube/yt-research && npm install
```

Run a Python script (always from the workspace root or repo root with venv active):

```bash
source venv/bin/activate
python3 youtube/yt-analysis/yt_analysis.py        # interactive orchestrator
python3 youtube/keyword-research/run.py           # competitor research
```

Run the Phase 1 niche pipeline (TS):

```bash
cd youtube/yt-research
npx ts-node run.ts --niche <slug>
```

## Workspace structure rules

- **Single Python runtime.** Shared `requirements.txt` + `venv/` at the root of `pipelines/`.
- **Shared config lives at workspace root:**
  - `.env` — API keys, sheet URLs, Cloudflare creds (see `.env.example` for the full list)
  - `credentials.json` — Google service account (gitignored)
  - `.gitignore` — local rules
  - `.npmrc` — forces public registry
- **Python scripts** import `common.*` (e.g. `from common.sheets import ...`). The `common/` package side-effect-loads `.env` from the workspace root on import — you don't have to load it yourself.
- **Node subprojects** (`youtube/yt-research/`) keep their own `package.json` + `node_modules/` because npm expects them there.
- **No per-folder `.env`, `credentials.json`, `venv/`, or `requirements.txt`.** Ever.
- **Generated media never lives in the repo — it flows through the asset hubs.** Voiceovers and avatar renders go to `~/kb-scratch/video/{tts,heygen}/<your-pipeline>/` (`_test/` if tied to no pipeline) plus a manifest row in the hub (`video/tts/OUTPUTS.md` / `video/heygen/RENDERS.md`). Reference assets (ref voices, character images/ids) are owned by the hubs — resolve a slug from `video/heygen/registry.json` / `video/tts/REFERENCES.md`, never copy assets into your pipeline folder. Browse it all with the `media-board` skill. (decisions.md 2026-07-12)

## Folder map

| Folder | Purpose | Stack |
|---|---|---|
| [`youtube/`](youtube/CLAUDE.md) | Wrapper for the core YT logic (sub-projects below) | mixed |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/yt-analysis/`](youtube/yt-analysis/CLAUDE.md) | YT tracker sheet sync + LLM-driven affiliate-link workflow | Python |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/keyword-research/`](youtube/keyword-research/CLAUDE.md) | Scan competitor channels for affiliate opportunities | Python |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/yt-research/`](youtube/yt-research/CLAUDE.md) | Niche → knowledge-base pipeline (Phase 1, Gemini) | TypeScript |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/yt-script/`](youtube/yt-script/CLAUDE.md) | Knowledge-base → final video script (Phase 2) | Markdown workflow |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/my-yt/`](youtube/my-yt/CLAUDE.md) | Personal channel notes (free-form) | Markdown |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/tutorial-pipeline-1/`](youtube/tutorial-pipeline-1/PIPELINE.md) | Drive-in → HeyGen spokesperson clips from an existing avatar → Drive-out. Standalone | Python + Claude steps |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/tutorial-pipeline-2/`](youtube/tutorial-pipeline-2/PIPELINE.md) | Tutorial recording prep steps (renamed from kushal-tutorial-pipeline-v2, 2026-07-07) | Python + Claude steps |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/explainer-videos-pipeline-1/`](youtube/explainer-videos-pipeline-1/PIPELINE.md) | Topic + competitor styles → fully-generated explainer video draft. No screen recording, no avatar | Python + Claude steps |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/competitor-styles/`](youtube/competitor-styles/CLAUDE.md) | Competitor style packs (script + video Style DNA for yt-style-copy skill; includes the Devsplainers motion-graphics reverse-engineering + hyperframes build kit, moved here 2026-07-07) | Python + Claude skill |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/dossiers/`](youtube/dossiers/CLAUDE.md) | Persistent per-software research library — one dossier per tool, accumulated from every fetched video transcript | Python + Claude skill |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/open-source/`](youtube/open-source/README.md) | Self-hosted alternatives exploration (the avatar/HeyGen-replacement work moved to `video/heygen/fal-lipsync/` 2026-07-12) | Research/handoff docs |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/final-workflow/`](youtube/final-workflow/final-workflow-notes.md) | Multi-channel production workflow + per-video cost model (notes) | Markdown |
| [`pinterest/`](pinterest/PLAN.md) | Pinterest pin data and generators (Keto, Wedding brands) | Python |
| [`fb-ads/`](fb-ads/fb-ads-notes.md) | Facebook ads playbook notes (page warm-up, ABO→CBO budget ladder) | Markdown |
| [`income-analysis/`](income-analysis/README.md) | Gumroad/Skool income snapshot retrieval CLIs | Python |
| [`common/`](common/CLAUDE.md) | Shared Python helpers (sheets, gemini, llm, affiliate, cloudflare). Imported by every Python script. | Python |
| [`video/`](#) | Video production and rendering assets | mixed |
| &nbsp;&nbsp;&nbsp;&nbsp;[`video/tts/`](video/tts/CLAUDE.md) | TTS asset hub — reference voices, engines (IndexTTS-2 on Modal), voiceover manifest; consumed by the youtube pipelines | Python |
| &nbsp;&nbsp;&nbsp;&nbsp;[`video/heygen/`](video/heygen/CLAUDE.md) | Avatar asset hub — character registry + reference images, render manifest, HeyGen + fal-lipsync flows | Python + JSON |
| &nbsp;&nbsp;&nbsp;&nbsp;[`video/card-library/`](video/card-library/README.md) | Visual templates for Video Studio | HTML/CSS/JS |
| &nbsp;&nbsp;&nbsp;&nbsp;[`video/graphics-flow/`](video/graphics-flow/PIPELINE.md) | Beat-synced motion-graphics pipeline — VO mp3 → cues → storyboard review → rendered clips + manifest (uses card-library cards) | Node + Claude steps |
| [`tools/`](#) | Monetizable and utility tools | mixed |
| &nbsp;&nbsp;&nbsp;&nbsp;[`tools/bank-statement-parser/`](tools/bank-statement-parser/README.md) | Bank statements parsing & reconciliation engine | Python |
| &nbsp;&nbsp;&nbsp;&nbsp;[`tools/big-comparison-util/`](tools/big-comparison-util/README.md) | Grouping and ranking comparisons utility | Markdown |
| [`notes/`](#) | Small business notes and ideas | Markdown |
| &nbsp;&nbsp;&nbsp;&nbsp;[`notes/channel-ideas/`](notes/channel-ideas/README.md) | Channel niche brainstorming notes | Markdown |
| &nbsp;&nbsp;&nbsp;&nbsp;[`notes/upwork-hiring/`](notes/upwork-hiring/CLAUDE.md) | Hiring-post markdown generator | Claude workflow |
| &nbsp;&nbsp;&nbsp;&nbsp;[`notes/to-do/`](notes/to-do/todolist.md) | Running task lists | Markdown |
| [`archive/`](#) | Superseded work kept for reference | mixed |
| &nbsp;&nbsp;&nbsp;&nbsp;[`archive/hyperframes-vs-remotion/`](archive/hyperframes-vs-remotion/CLAUDE.md) | Superseded Hyperframes vs Remotion rendering tests | HTML/CSS/JS |
| &nbsp;&nbsp;&nbsp;&nbsp;[`archive/rvc-flow/`](archive/rvc-flow/CLAUDE.md) | Superseded RVC male→female voice conversion (replaced by `video/tts/`'s IndexTTS-2) | Python |
