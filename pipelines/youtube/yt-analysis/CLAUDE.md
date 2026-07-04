# yt-analysis — YouTube tracker sync + affiliate workflow

Python scripts that sync data between the YT tracker sheet, the YouTube Data API, the Cloudflare D1 click DB, and the Gemini-driven affiliate-link workflow.

## Run

From the repo root with venv active:

```bash
source venv/bin/activate
python3 youtube/yt-analysis/yt_analysis.py            # interactive orchestrator
python3 youtube/yt-analysis/process_yt_tracker.py     # tracker LLM workflow
python3 youtube/yt-analysis/sync_rankings.py          # rank analysis (separate)
```

## Layout

```
youtube/yt-analysis/
├── yt_analysis.py           # interactive orchestrator — prompts you to pick metadata/views/clicks
├── process_yt_tracker.py    # tracker rows with topic_status="To Process" → detect tools (Gemini),
│                            # register short URLs in D1+KV, write video_description/actual_links/
│                            # short_links back to the sheet, set status="To Review"
├── sync_metadata.py         # Master tab → "Per video cost,views and clicks" (uploaded videos)
├── sync_views.py            # YT API → views column
├── sync_clicks.py           # D1 → affiliate_link_clicks column (rich format)
├── sync_rankings.py         # rank analysis (intentionally NOT in yt_analysis.py)
└── tests/                   # pytest
```

## Inputs / outputs

- Reads from sheets via `common.sheets`: YT tracker (`YT_TRACKER_SHEET_URL`), Analysis sheet (`ANALYSIS_INCOME_SHEET_URL`), Affiliate Programs (`AFFILIATE_PROGRAMS_SHEET_URL`)
- Reads from YouTube Data API for views (`YT_API_KEY`)
- Reads from Cloudflare D1 / KV for click counts (`common.cloudflare`)
- Writes back to the same sheets, never deletes rows

All scripts are re-runnable; failed rows are skipped with stderr messages, not crashed on.

## Tests

```bash
source venv/bin/activate
pytest youtube/yt-analysis/tests
```

## Related

- `common/` — every helper imported here
- `workers/redirector/` — the CF Worker that produces the click rows that `sync_clicks.py` reads
