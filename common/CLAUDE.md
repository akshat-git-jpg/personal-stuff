# common — shared Python helpers

Importable as `from common.<x> import ...` from any script under the repo root.
Importing the package (`from common import ...`) loads `.env` from the repo root via `env.py`'s side-effect.

## Layout

```
common/
├── __init__.py            # imports env (side-effect: loads myproj/.env)
├── env.py                 # MYPROJ_ROOT resolver, get_credentials_path()
├── sheets.py              # gspread client + YouTube/Sheet ID extractors
├── gemini.py              # Gemini client wrapper (generate_text, generate_json)
├── llm.py                 # tool detection + YT description prompts (uses common/prompts/tracker/)
├── affiliate.py           # Affiliate Programs sheet reader + tool-name normalization
├── cloudflare.py          # D1Client + KVClient REST wrappers (used by sync scripts, not the Worker)
└── prompts/               # all Gemini prompts for the whole repo live here, grouped by use case
    ├── tracker/                          # used by common.llm
    │   ├── detect-tools.md
    │   └── generate-description.md
    ├── keyword-research/                 # used by youtube/keyword-research/{extract,aggregate}.py
    │   ├── extract.md
    │   └── synthesize.md
    └── yt-research/                      # used by youtube/yt-research/steps/*.ts + Phase 2 Claude
        ├── validation.md
        ├── transcript-extraction.md
        ├── pricing-extraction.md
        ├── profile-building.md
        ├── comparative-insights.md
        └── kb-synthesis.md
```

## Inputs

- Root `.env` (auto-loaded). Required keys depend on the helper used:
  - sheets.py / affiliate.py: `CREDENTIALS_FILE` + sheet URLs
  - gemini.py / llm.py: `GEMINI_API_KEY`
  - cloudflare.py: `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID`, `CF_KV_NAMESPACE_ID`
- Root `credentials.json` (Google service account, gitignored)

## Used by

- `youtube/yt-analysis/` — every script
- `youtube/keyword-research/` — every script

## Adding a new helper

Drop a `.py` into this folder. Import via `from common.<name> import ...`. Don't add cross-helper deps that create cycles (e.g., `affiliate.py` imports `sheets.py` which imports `env.py` — keep this DAG).
