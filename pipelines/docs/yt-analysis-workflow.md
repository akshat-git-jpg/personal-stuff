# YT Analysis Workflow

Run views, affiliate-click refresh, and/or rank analysis. Metadata sync is implicit — it always runs before Views or Affiliate clicks to make sure all uploaded tracker rows are present in the Analysis sheet.

---

## Trigger

When the user says any of:

- "run analysis"
- "yt analysis"
- "analysis sync"
- "sync views" / "fetch views" / "update views"
- "sync clicks" / "affiliate clicks" / "refresh clicks"
- "yt ranking" / "rank analysis" / "check rankings"

…fire this workflow. If the user names a specific sub-sync, pre-select that one in step 1.

---

## Steps (Claude follows these)

### Step 1 — Ask which sub-syncs to run

Use `AskUserQuestion` with **multi-select**. Pre-select any sub-sync the user already named in their trigger phrase.

Options:

- **Views** — fills the `views` column in the Analysis sheet using the YouTube Data API.
- **Affiliate clicks** — fills the `affiliate_link_clicks` column from Cloudflare D1 click data (rich per-link format).
- **Rank analysis** — appends a new dated `ranking_<YYYY-MM-DD>` column to the rankings sheet for rows with `status="To Check now"`.

**Do NOT** offer "Metadata sync" as an option — it runs automatically as a prerequisite for Views and Affiliate clicks (see step 2).

If the user picks zero, abort and tell them no syncs were selected.

### Step 2 — Auto-run metadata sync if needed

If the user selected **Views** or **Affiliate clicks** (or both):

```bash
source venv/bin/activate && python3 youtube/yt-analysis/sync_metadata.py
```

This copies tracker Master rows where `yt_upload_status="uploaded"` into the Analysis sheet's "Per video cost,views and clicks" tab. Required because Views and Affiliate clicks both write into rows that must already exist there.

Run it **once** even if both Views and Affiliate clicks are selected.

If only **Rank analysis** is selected, skip this step — rank analysis writes to a different sheet and doesn't depend on the Analysis sheet's row coverage.

If `sync_metadata.py` exits non-zero, **stop the chain** — surface the error and don't run the rest.

### Step 3 — Run the selected sub-syncs in order

Run them sequentially (not in parallel — they may write to overlapping sheets). For each, run from the repo root with venv active:

| Selection | Command |
|---|---|
| Views | `python3 youtube/yt-analysis/sync_views.py` |
| Affiliate clicks | `python3 youtube/yt-analysis/sync_clicks.py` |
| Rank analysis | `python3 youtube/yt-analysis/sync_rankings.py` |

For each:

- Capture stdout and stderr.
- If a script exits non-zero, surface the error and **stop the chain** — don't run the remaining selections without confirmation.
- If it exits zero, capture the summary lines (each script prints its own at the end).

### Step 4 — Report back

Print a single consolidated summary covering metadata sync (if it ran) and every selected sub-sync:

```
✓ Metadata sync — <summary line>      (if it ran)
✓ Views — <summary line>
✗ Affiliate clicks — <error>
- Rank analysis — skipped (chain stopped above)
```

---

## Preconditions

If a script errors at startup, check:

- `.env` has the required keys for the relevant sub-sync:
  - Metadata (always for Views/Clicks): `YT_TRACKER_SHEET_URL`, `ANALYSIS_INCOME_SHEET_URL`, `CREDENTIALS_FILE`
  - Views: `YT_API_KEY`, `ANALYSIS_INCOME_SHEET_URL`
  - Affiliate clicks: `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID`, `ANALYSIS_INCOME_SHEET_URL`
  - Rank analysis: `YT_API_KEY`, `GOOGLE_SHEET_URL`
- `credentials.json` exists and the service account is shared on the relevant sheets.

---

## Notes

- Metadata sync, views, and affiliate clicks are all **re-runnable** and idempotent on the existing-rows side. Metadata sync may *append* new rows for newly-uploaded videos.
- `sync_rankings` adds a new dated column each run; old columns are preserved for trend tracking.
- The standalone interactive orchestrator `youtube/yt-analysis/yt_analysis.py` exposes metadata sync as a separate option; that's an older interface preserved for direct CLI use, but this Claude workflow makes metadata sync implicit.

---

## Related

- Scripts: `youtube/yt-analysis/sync_metadata.py` (implicit), `sync_views.py`, `sync_clicks.py`, `sync_rankings.py`
- The interactive standalone orchestrator: `youtube/yt-analysis/yt_analysis.py`
- Click data is produced by `workers/redirector/` (CF Worker) and read here via `common/cloudflare.py`.
- Tracker processing (separate workflow that creates the rows analysis sees): `docs/yt-tracker-workflow.md`
