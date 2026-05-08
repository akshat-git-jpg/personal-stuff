# myproj — project guide

## Project structure rules

- **Single git repo:** `myproj/` is one git repository. All subfolders (`yt-analysis/`, `yt-research/`, `yt-script/`, etc.) are part of it — they are NOT separate repos.
- **Shared config lives at root only:**
  - `.env` — all API keys (`YT_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_SHEET_URL`, `YT_MAIN_SHEET_URL`, `CREDENTIALS_FILE`)
  - `credentials.json` — Google service account, gitignored
  - `.gitignore` — single source of truth for ignore rules
  - `requirements.txt` + `venv/` — shared Python environment (the only Python folder is `yt-analysis/`)
- **Subfolders contain code, not config.** Do NOT create per-folder `.env`, `credentials.json`, `.gitignore`, `venv/`, or `requirements.txt`. Scripts in subfolders read the root config via paths like `os.path.join(SCRIPT_DIR, "..", ".env")` and `os.path.join(SCRIPT_DIR, "..", "credentials.json")`.
- **Exception — language-native tooling that must live next to source.** `yt-research/` is a Node project, so it keeps its own `package.json` + `node_modules/` because npm expects them there. This is the only allowed exception.

## Running Python scripts

```bash
cd /Users/kbtg/codebase/myproj && source venv/bin/activate && python3 yt-analysis/<script>.py
```

The `yt-analysis/` scripts (`sync_analysis.py`, `sync_views.py`, `sync_rankings.py`, plus `_common.py` helpers) automatically load `.env` and `credentials.json` from the root.

## Workflows

@research-and-script-workflow.md
