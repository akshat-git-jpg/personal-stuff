# myproj — project guide

## Project structure rules

- **Single git repo:** `myproj/` is one git repository. All subfolders (`yt-analysis/`, `yt-research/`, `yt-script/`, etc.) are part of it — they are NOT separate repos.
- **Shared config lives at root only:**
  - `.env` — API keys (`YT_API_KEY`, `GEMINI_API_KEY`), service account (`CREDENTIALS_FILE`), and sheet URLs from the YT Main index (`YT_MAIN_SHEET_URL`, `YT_TRACKER_SHEET_URL`, `WORKFLOW_DEADLINES_SHEET_URL`, `KEYWORD_RESEARCH_SHEET_URL`, `AFFILIATE_PROGRAMS_SHEET_URL`, `ANALYSIS_INCOME_SHEET_URL`, `GOOGLE_SHEET_URL` *(= Yt Rank Analysis on keywords)*, `RANDOM_NOTES_SHEET_URL`, `PROBLEMS_AUTOMATIONS_SHEET_URL`, `MISC_CHANNELS_SHEET_URL`)
  - `credentials.json` — Google service account, gitignored
  - `.gitignore` — single source of truth for ignore rules
  - `requirements.txt` + `venv/` — shared Python environment
  - `common/` — shared Python helpers (`common.sheets`, `common.gemini`, `common.env`); imported by every Python script via a `sys.path` prelude
- **Python folders:** `yt-analysis/` and `keyword-research/` (both import from `common/`).
- **Subfolders contain code, not config.** Do NOT create per-folder `.env`, `credentials.json`, `.gitignore`, `venv/`, or `requirements.txt`. Scripts in subfolders read the root config via paths like `os.path.join(SCRIPT_DIR, "..", ".env")` and `os.path.join(SCRIPT_DIR, "..", "credentials.json")`.
- **Exception — language-native tooling that must live next to source.** `yt-research/` is a Node project, so it keeps its own `package.json` + `node_modules/` because npm expects them there. This is the only allowed exception.

## Running Python scripts

```bash
cd /Users/kbtg/codebase/myproj && source venv/bin/activate && python3 yt-analysis/<script>.py
```

The `yt-analysis/` scripts (`sync_analysis.py`, `sync_views.py`, `sync_rankings.py`) and the `keyword-research/` scripts (`extract.py`, `aggregate.py`, `run.py`) automatically load `.env` and `credentials.json` from the root via the `common/` package.

## Workflows

@docs/research-and-script-workflow.md
