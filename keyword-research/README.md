# keyword-research

Two-stage pipeline that scans your competitor channels and surfaces the softwares they're being **paid** to promote (via affiliate links / sponsorships / promo codes), so you can pick which ones to make affiliate videos on next. Generic free tools (Google Docs, Telegram, etc.) are filtered out.

## Setup (one-time)

1. **Service-account access on the sheet.** The pipeline reads `KEYWORD_RESEARCH_SHEET_URL` (already in `myproj/.env`) using the service account from `myproj/credentials.json`. Open the sheet in a browser and share it with the service-account email (the `client_email` field inside `credentials.json`) as **Editor**.
2. **Sheet structure — `Channels` tab (input).** Header row required (column order doesn't matter — columns are matched by header name, case-insensitive substring):
   | Channel URL | Status | Notes |
   |---|---|---|
   | https://www.youtube.com/@thomascreates12 | To Check | (free text) |

   Set `Status` to `To Check` for channels you want analyzed in the next run; any other value (or empty) skips that row. If you remove the Status column entirely, the script falls back to processing every row.

3. **Sheet structure — `Videos` tab (output).** Auto-created on first run. Headers (8 columns):
   `Date Found` | `Channel Name` | `Video Title` | `Video URL` | `Softwares Used in the video` | `Softwares affiliated` | `Video Summary` | `Topics`

4. **Python deps** are in `myproj/requirements.txt`. From the repo root:
   ```bash
   source venv/bin/activate
   pip install -r requirements.txt
   ```

## Run

From the repo root:

```bash
# Full pipeline (extract + aggregate), 3 videos per channel
python keyword-research/run.py

# Just stage 1 (RSS + Gemini extraction → sheet + raw.json checkpoint)
python keyword-research/extract.py --limit 3

# Just stage 2 (counts + Gemini synthesis → summary.md)
python keyword-research/aggregate.py             # uses latest raw.json

# Iterate on synthesis prompt without re-paying for extraction
python keyword-research/aggregate.py --input keyword-research/output/<run>/raw.json
python keyword-research/aggregate.py --no-synthesis    # print counts only

# Dry run (no sheet writes, raw.json still saved)
python keyword-research/extract.py --dry-run

# Limit to specific channels (overrides the sheet)
python keyword-research/extract.py --channels "https://www.youtube.com/@foo,https://www.youtube.com/@bar"
```

## What each video produces

For every competitor video, Gemini extracts four signals:

- **Softwares Used in the video** — every named software/SaaS/AI product mentioned. Completeness signal, includes free tools.
- **Softwares affiliated** — STRICT subset of the above: only softwares the creator is being paid to promote. Detected via:
  - Affiliate-link signatures in description URLs: `?fpr=`, `?ref=`, `?via=`, `?aff=`, `?partner=`, `?fp_sid=`, `?utm_source=youtube_creator`, etc.
  - Explicit affiliate language ("my affiliate link", "click below to support the channel")
  - Sponsorship language ("sponsored by X", "thanks to X for sponsoring")
  - Discount / promo codes ("use code XYZ for 20% off")
- **Video Summary** — a single-sentence plain-language summary.
- **Topics** — 1–3 short topic tags (lowercase) for cross-channel clustering.

The aggregation in Stage 2 ranks by **affiliated softwares**, not by all-mentions — that's where the actual buy-signal lives.

## What you get

- **`Videos` sheet tab** — fresh snapshot each run. The header row is preserved; all data rows below are wiped and rewritten with the current run's results.
- **`keyword-research/output/<run_id>/raw.json`** — full structured output of the run (channel + per-video metadata + extractions). Stage 2 reads from this.
- **`keyword-research/output/<run_id>/summary.md`** — Gemini's narrative report:
  - Headline (single biggest signal in this run)
  - Top affiliated softwares (the leaderboard you're actually picking from)
  - Top topics
  - Channel patterns (who's clustering on what; outliers)
- **Retention:** only the latest run is kept on disk. `extract.py` wipes all older `output/<run_id>/` folders at the start of each run. If you want to keep an older summary, copy the folder out before re-running.

## How it works

```
Channels tab (URLs + Status)
    │  filter to Status == "To Check"
    ▼
extract.py
    │  resolve handle → channel_id  (YT Data API, cached in channel_cache.json)
    │  RSS feed → last N video IDs
    │  videos.list batch → full title + description
    │  Gemini 2.5 Flash → {softwares, affiliated_softwares, summary, topics} per video
    ▼
Videos tab (8 cols, wiped + rewritten) + output/<run_id>/raw.json
    │
    ▼
aggregate.py
    │  count distinct channels + videos per affiliated_software / topic
    │  Gemini 2.5 Pro → markdown synthesis
    ▼
output/<run_id>/summary.md
```

## Files

```
keyword-research/
├── README.md
├── extract.py            # Stage 1
├── aggregate.py          # Stage 2
├── run.py                # convenience wrapper (extract → aggregate)
├── youtube.py            # RSS + handle resolution + videos.list helpers
├── prompts/
│   ├── extract.md        # per-video extraction prompt (incl. affiliate detection)
│   └── synthesize.md     # cross-channel synthesis prompt
├── channel_cache.json    # gitignored — handle → channel_id cache
└── output/               # gitignored — one folder, replaced each run
    └── <run_id>/
        ├── raw.json
        └── summary.md
```

## Costs / quota

Per run with N channels × 3 videos:
- 1 YT Data API `channels.list` call per **new** channel (cached after that)
- 1 YT Data API `videos.list` call per channel (batches up to 50 IDs)
- N×3 Gemini 2.5 Flash calls (per-video extraction)
- 1 Gemini 2.5 Pro call (synthesis)

Default YT quota = 10,000 units/day; one full run uses ~2N units. Gemini Flash is cheap (~$0.001/call); Pro for synthesis is ~$0.05–0.10/run.
