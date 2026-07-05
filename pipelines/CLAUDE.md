# pipelines — Python Workspace operating guide

This workspace holds the content and automation pipelines sharing a single Python runtime and the `common/` package (e.g. YouTube research, scripting, recording prep, Pinterest pin generation, RVC voice conversion, bank statement parser, and income analysis).

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

## Folder map

| Folder | Purpose | Stack |
|---|---|---|
| [`youtube/`](youtube/CLAUDE.md) | Wrapper for the core YT logic (5 sub-projects below) | mixed |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/yt-analysis/`](youtube/yt-analysis/CLAUDE.md) | YT tracker sheet sync + LLM-driven affiliate-link workflow | Python |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/keyword-research/`](youtube/keyword-research/CLAUDE.md) | Scan competitor channels for affiliate opportunities | Python |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/yt-research/`](youtube/yt-research/CLAUDE.md) | Niche → knowledge-base pipeline (Phase 1, Gemini) | TypeScript |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/yt-script/`](youtube/yt-script/CLAUDE.md) | Knowledge-base → final video script (Phase 2) | Markdown workflow |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/my-yt/`](youtube/my-yt/CLAUDE.md) | Personal channel notes (free-form) | Markdown |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/kushal-tutorial-pipeline-v2/`](youtube/kushal-tutorial-pipeline-v2/PIPELINE.md) | Tutorial recording prep steps | Python + Claude steps |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/competitor-styles/`](youtube/competitor-styles/CLAUDE.md) | Competitor style packs (ingest + Style DNA for yt-style-copy skill) | Python + Claude skill |
| [`pinterest/`](pinterest/PLAN.md) | Pinterest pin data and generators (Keto, Wedding brands) | Python |
| [`income-analysis/`](income-analysis/README.md) | Gumroad/Skool income snapshot retrieval CLIs | Python |
| [`common/`](common/CLAUDE.md) | Shared Python helpers (sheets, gemini, llm, affiliate, cloudflare). Imported by every Python script. | Python |
| [`video/`](#) | Video production and rendering assets | mixed |
| &nbsp;&nbsp;&nbsp;&nbsp;[`video/voice/`](video/voice/README.md) | Voiceover pipeline (RVC pitch conversion, TTS engine, heygen) | Python + Node |
| &nbsp;&nbsp;&nbsp;&nbsp;[`video/motion-graphics/`](video/motion-graphics/README.md) | Motion-graphics assets and Devsplainers-style build kit | HTML/CSS/GSAP |
| &nbsp;&nbsp;&nbsp;&nbsp;[`video/card-library/`](video/card-library/README.md) | Visual templates for Video Studio | HTML/CSS/JS |
| [`tools/`](#) | Monetizable and utility tools | mixed |
| &nbsp;&nbsp;&nbsp;&nbsp;[`tools/bank-statement-parser/`](tools/bank-statement-parser/README.md) | Bank statements parsing & reconciliation engine | Python |
| &nbsp;&nbsp;&nbsp;&nbsp;[`tools/big-comparison-util/`](tools/big-comparison-util/README.md) | Grouping and ranking comparisons utility | Markdown |
| [`notes/`](#) | Small business notes and ideas | Markdown |
| &nbsp;&nbsp;&nbsp;&nbsp;[`notes/channel-ideas/`](notes/channel-ideas/README.md) | Channel niche brainstorming notes | Markdown |
| &nbsp;&nbsp;&nbsp;&nbsp;[`notes/upwork-hiring/`](notes/upwork-hiring/CLAUDE.md) | Hiring-post markdown generator | Claude workflow |
| &nbsp;&nbsp;&nbsp;&nbsp;[`notes/to-do/`](notes/to-do/todolist.md) | Running task lists | Markdown |
| [`archive/`](#) | Superseded work kept for reference | mixed |
| &nbsp;&nbsp;&nbsp;&nbsp;[`archive/hyperframes-vs-remotion/`](archive/hyperframes-vs-remotion/CLAUDE.md) | Superseded Hyperframes vs Remotion rendering tests | HTML/CSS/JS |
