# myproj — project guide

A single git repo holding everything related to my YouTube channel: niche research, script generation, tracker syncs, competitor research, and the affiliate-link tracker. Each top-level folder is one use case and has its own `CLAUDE.md` describing it.

## Folder map

| Folder | Purpose | Stack |
|---|---|---|
| [`common/`](common/CLAUDE.md) | Shared Python helpers (sheets, gemini, llm, affiliate, cloudflare). Imported by every Python script. | Python |
| [`yt-analysis/`](yt-analysis/CLAUDE.md) | YT tracker sheet sync + LLM-driven affiliate-link workflow | Python |
| [`keyword-research/`](keyword-research/CLAUDE.md) | Scan competitor channels for affiliate opportunities | Python |
| [`yt-research/`](yt-research/CLAUDE.md) | Niche → knowledge-base pipeline (Phase 1, Gemini) | TypeScript |
| [`yt-script/`](yt-script/CLAUDE.md) | Knowledge-base → final video script (Phase 2) | Markdown workflow |
| [`workers/redirector/`](workers/redirector/CLAUDE.md) | Cloudflare Worker for `go.agrolloo.com/*` short links | TypeScript (CF Worker) |
| [`docs/`](docs/CLAUDE.md) | Repo-wide docs and workflows | Markdown |
| [`my-yt/`](my-yt/CLAUDE.md) | Personal channel notes (free-form) | Markdown |
| [`to-do/`](to-do/CLAUDE.md) | Running TODO list | Markdown |
| [`n8n-website/`](n8n-website/CLAUDE.md) | Static "coming soon" landing page | HTML |

## Getting started

One-time setup:

```bash
# 1. Python environment
cd /Users/kbtg/codebase/myproj
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Secrets (already present locally — don't commit)
#    - .env  (copy from .env.example, fill in keys)
#    - credentials.json  (Google service account)

# 3. Share each Google Sheet with the service-account email (client_email in credentials.json) as Editor

# 4. Node subprojects (only for the ones you'll touch)
cd yt-research && npm install
cd ../workers/redirector && npm install
```

Run a Python script (always from the repo root with venv active):

```bash
source venv/bin/activate
python3 yt-analysis/yt_analysis.py            # interactive orchestrator
python3 keyword-research/run.py               # competitor research
```

Run the Phase 1 niche pipeline (TS):

```bash
cd yt-research
npx ts-node run.ts --niche <slug>
```

## Project structure rules

- **Single git repo.** All subfolders are part of it — never `git init` inside one.
- **Shared config lives at root only:**
  - `.env` — all API keys, sheet URLs, Cloudflare creds (see `.env.example` for the full list)
  - `credentials.json` — Google service account (gitignored)
  - `.gitignore` — single source of truth
  - `.npmrc` — single source of truth (forces public registry)
  - `requirements.txt` + `venv/` — shared Python environment
- **Python scripts** import `common.*` (e.g. `from common.sheets import ...`). The `common/` package side-effect-loads `.env` from the repo root on import — you don't have to load it yourself.
- **Node subprojects** (`yt-research/`, `workers/redirector/`) keep their own `package.json` + `node_modules/` because npm expects them there. They do NOT keep their own `.npmrc` or `.gitignore`.
- **No per-folder `.env`, `credentials.json`, `venv/`, or `requirements.txt`.** Ever.

## Workflows

@docs/research-and-script-workflow.md
