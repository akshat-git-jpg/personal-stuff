# TY — project guide

A single git repo for my money-making / business projects: YouTube (niche research, script generation, tracker syncs, competitor research, affiliate tracker), the Pinterest PDF business, and monetizable tools (e.g. bank-statement-parser, headed for a paid RapidAPI product). Each top-level folder is one use case and has its own `CLAUDE.md`/README describing it.

## How to operate here (read first)

1. **Route by the question, not by browsing.** Match the user's ask to the "Find it fast" table below, go straight to that location, and read its `CLAUDE.md`/README before doing anything. Don't grep the whole repo to orient.
2. **Before working in any sub-folder, open that sub-folder's `CLAUDE.md` (or README) first** — the root map only links them; it does not contain their detail. Those files are NOT auto-loaded.
3. **When a non-obvious decision is made** (a tool/approach chosen, a convention set, a "we do it this way because…"), append a dated line to [`decisions.md`](decisions.md). Check there before asking the user to re-explain something.

## Find it fast (route by intent)

| If the ask is about… | Go to |
|---|---|
| A past decision / why something is done a certain way | [`decisions.md`](decisions.md) |
| YT tracker sheet sync, affiliate-link workflow | [`youtube/yt-analysis/CLAUDE.md`](youtube/yt-analysis/CLAUDE.md) |
| Scanning competitor channels for affiliate opportunities | [`youtube/keyword-research/CLAUDE.md`](youtube/keyword-research/CLAUDE.md) |
| Niche → knowledge-base research (Phase 1) | [`youtube/yt-research/CLAUDE.md`](youtube/yt-research/CLAUDE.md) |
| Knowledge-base → final video script (Phase 2) | [`youtube/yt-script/CLAUDE.md`](youtube/yt-script/CLAUDE.md) |
| My own channel notes | [`youtube/my-yt/CLAUDE.md`](youtube/my-yt/CLAUDE.md) |
| Channel ideas / niche brainstorming notes | [`channel ideas/`](<channel ideas/>) |
| Tutorial screen-recording → editor-ready package (script, voiceover, avatar clips) | [`youtube/kushal-tutorial-pipeline-v2/`](youtube/kushal-tutorial-pipeline-v2/PIPELINE.md) |
| Pinterest pin data / a niche (keto, wedding) | `pinterest/<niche>/`, plan at [`pinterest/PLAN.md`](pinterest/PLAN.md) |
| Pinterest funnel landing pages / Workers | `pinterest/landing-pages/` |
| Short links (`go.agrolloo.com/*`) | [`workers/redirector/CLAUDE.md`](workers/redirector/CLAUDE.md) |
| HTML→video cards / Video Studio | [`yt-visuals-hyperframe/`](yt-visuals-hyperframe/README.md) |
| Devsplainers-style motion-graphics video kit / pipeline | [`ai-video-production/Devsplainers/hyperframes/SPEC.md`](ai-video-production/Devsplainers/hyperframes/SPEC.md) |
| Bank-statement parsing / the RapidAPI product | [`bank-statement-parser/`](bank-statement-parser/README.md) |
| Shared Python helpers (sheets, gemini, llm, affiliate, cloudflare) | [`common/CLAUDE.md`](common/CLAUDE.md) |
| Income / business-strategy research | [`docs/research/`](docs/research/) |
| Tracking actual income across platforms (CLIs + snapshots) | [`income-analysis/`](income-analysis/README.md) |
| A repo workflow (research→script, tracker, yt-analysis, upwork) | [`docs/`](docs/CLAUDE.md) |
| Running TODO list | [`to-do/todolist.md`](to-do/todolist.md) |
| Secrets / API keys / sheet URLs | root `.env`, `credentials.json` (see `.env.example`) |

## Folder map

| Folder | Purpose | Stack |
|---|---|---|
| [`youtube/`](youtube/CLAUDE.md) | Wrapper for the core YT logic (6 sub-projects below) | mixed |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/yt-analysis/`](youtube/yt-analysis/CLAUDE.md) | YT tracker sheet sync + LLM-driven affiliate-link workflow | Python |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/keyword-research/`](youtube/keyword-research/CLAUDE.md) | Scan competitor channels for affiliate opportunities | Python |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/yt-research/`](youtube/yt-research/CLAUDE.md) | Niche → knowledge-base pipeline (Phase 1, Gemini) | TypeScript |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/yt-script/`](youtube/yt-script/CLAUDE.md) | Knowledge-base → final video script (Phase 2) | Markdown workflow |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/my-yt/`](youtube/my-yt/CLAUDE.md) | Personal channel notes (free-form) | Markdown |
| &nbsp;&nbsp;&nbsp;&nbsp;[`youtube/kushal-tutorial-pipeline-v2/`](youtube/kushal-tutorial-pipeline-v2/PIPELINE.md) | Tutorial screen-recording → editor-ready package (clean script, brand-voice voiceover, HeyGen avatar clips, visual plan); numbered `steps/` | Python + Claude steps |
| [`common/`](common/CLAUDE.md) | Shared Python helpers (sheets, gemini, llm, affiliate, cloudflare). Imported by every Python script under `youtube/`. | Python |
| [`workers/redirector/`](workers/redirector/CLAUDE.md) | Cloudflare Worker for `go.agrolloo.com/*` short links | TypeScript (CF Worker) |
| [`docs/`](docs/CLAUDE.md) | Repo-wide docs and workflows | Markdown |
| [`upwork-hiring/`](upwork-hiring/CLAUDE.md) | Turn jumbled hiring thoughts into a ready-to-paste Upwork job post | Claude workflow |
| [`to-do/`](to-do/CLAUDE.md) | Running TODO list | Markdown |
| [`pinterest/`](pinterest/PLAN.md) | Per-niche Pinterest PDF business (keto, wedding) + landing pages | Python + HTML |
| [`yt-visuals-hyperframe/`](yt-visuals-hyperframe/README.md) | **Live** HTML→video card tool (Video Studio); the card templates render2.agrolloo.com pulls from | Node |
| [`hyperframes-vs-remotion/`](hyperframes-vs-remotion/CLAUDE.md) | Prior experiment (Hyperframes vs Remotion) — superseded by `yt-visuals-hyperframe/` | Node |
| [`ai-video-production/`](ai-video-production/README.md) | Motion-graphics video work: the Devsplainers style breakdown + reference frames, plus the Devsplainers-clone build kit (`Devsplainers/hyperframes/`, see its `SPEC.md`) | Markdown + HTML/CSS/GSAP |
| [`video-voice/`](video-voice/README.md) | Voiceover pipeline — RVC male→female voice conversion, TTS voiceover flow, and HeyGen avatars | Python + Node |
| [`bank-statement-parser/`](bank-statement-parser/README.md) | Parses + reconciles bank statements — building toward a paid RapidAPI product | Python |
| [`docs/research/`](docs/research/) | Business/income-strategy research (RapidAPI ideas, passive marketplaces) | Markdown |
| [`income-analysis/`](income-analysis/README.md) | Tracks actual income across platforms — per-source CLIs/MCPs + `snapshots/` of pulled numbers | Markdown + tooling |
| [`big-comparison-util/`](big-comparison-util/README.md) | Standalone grouping-and-ranking method for comparing many tools at once (point Claude at `categorization-rule.md`) | Markdown |
| [`channel ideas/`](<channel ideas/>) | Free-form channel / niche brainstorming notes (one folder per idea) | Markdown |

## Getting started

One-time setup:

```bash
# 1. Python environment
cd /Users/kbtg/codebase/TY
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Secrets (already present locally — don't commit)
#    - .env  (copy from .env.example, fill in keys)
#    - credentials.json  (Google service account)

# 3. Share each Google Sheet with the service-account email (client_email in credentials.json) as Editor

# 4. Node subprojects (only for the ones you'll touch)
cd youtube/yt-research && npm install
cd ../../workers/redirector && npm install
```

Run a Python script (always from the repo root with venv active):

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

## Project structure rules

- **Single git repo.** All subfolders are part of it — never `git init` inside one.
- **Shared config lives at root only:**
  - `.env` — all API keys, sheet URLs, Cloudflare creds (see `.env.example` for the full list)
  - `credentials.json` — Google service account (gitignored)
  - `.gitignore` — single source of truth
  - `.npmrc` — single source of truth (forces public registry)
  - `requirements.txt` + `venv/` — shared Python environment
- **Python scripts** import `common.*` (e.g. `from common.sheets import ...`). The `common/` package side-effect-loads `.env` from the repo root on import — you don't have to load it yourself.
- **Node subprojects** (`youtube/yt-research/`, `workers/redirector/`) keep their own `package.json` + `node_modules/` because npm expects them there. They do NOT keep their own `.npmrc` or `.gitignore`.
- **No per-folder `.env`, `credentials.json`, `venv/`, or `requirements.txt`.** Ever.

## Workflows (open when relevant — not auto-loaded)

- [research → script workflow](docs/research-and-script-workflow.md)
- [yt-tracker workflow](docs/yt-tracker-workflow.md)
- [yt-analysis workflow](docs/yt-analysis-workflow.md)
- [upwork hiring-post generator](upwork-hiring/CLAUDE.md)
