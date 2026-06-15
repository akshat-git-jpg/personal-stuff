# YT Tracker Processing Workflow

> **Superseded (2026-06-15):** Tracker processing now runs in the tracker-app UI
> (Admin → New Video → "Generate links & description"), not this script. The
> canonical logic lives in `youtube/tracker-app/src/worker/linkgen.ts`. This doc
> and `process_yt_tracker.py` are kept for historical reference. See
> `docs/superpowers/specs/2026-06-15-tracker-link-generation-design.md`.

Run `process_yt_tracker.py` to convert "To Process" rows in the YT tracker into "To Review" rows with short links, actual links, and a generated description.

---

## Trigger

When the user says any of:

- "process yt tracker"
- "process the tracker"
- "process new videos"
- "make short links and description"
- "run the tracker workflow"

…fire this workflow. Don't wait for an exact phrase — match the intent.

---

## What this does (under the hood)

`youtube/yt-analysis/process_yt_tracker.py`:

1. Reads the YT tracker (`YT_TRACKER_SHEET_URL`, Master tab) for rows with `topic_status="To Process"`.
2. For each row:
   - Calls Gemini via `common.llm.detect_tools()` to identify all tools mentioned (affiliate + non-affiliate, with homepage URLs).
   - Generates a video description via `common.llm.generate_description()`.
   - Creates a unique 4-char video code (BASE62) and per-tool short slugs.
   - Writes short URLs into KV (`CLICKS_KV` namespace) with target = the affiliate URL or the homepage URL for non-affiliate tools.
   - Writes the video metadata into D1 (`videos`, `links` tables) for click reporting.
   - Updates the tracker row: fills `video_description`, `actual_links`, `short_links`, sets status to `"To Review"`.
3. Re-runnable. Errors on any single row print to stderr and skip that row without changing its status.

---

## Steps (Claude follows these)

1. **Run the script** as a subprocess from the repo root with venv active:

   ```bash
   source venv/bin/activate && python3 youtube/yt-analysis/process_yt_tracker.py
   ```

2. **Capture stdout and stderr.** The script prints a per-row summary as it goes and a final summary line.

3. **Report back to the user:**
   - Total rows scanned (rows with status "To Process").
   - Rows successfully transitioned to "To Review".
   - Rows that errored (with the per-row error messages from stderr).
   - If any row errored, suggest the most likely fix (missing affiliate row, Gemini quota, KV/D1 auth).

4. **Do NOT** retry failed rows automatically. Surface the errors and let the user decide.

---

## Preconditions (Claude should verify these only if the script errors at startup)

If the script fails before processing any row, check:

- `.env` has `GEMINI_API_KEY`, `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID`, `CF_KV_NAMESPACE_ID`, `LINK_DOMAIN`, `YT_TRACKER_SHEET_URL`, `AFFILIATE_PROGRAMS_SHEET_URL`.
- `credentials.json` exists at the repo root and the service account is shared on both sheets.
- The Master tab has at least one row with `topic_status="To Process"`.

---

## Related

- Script: `youtube/yt-analysis/process_yt_tracker.py`
- Helpers: `common/llm.py`, `common/affiliate.py`, `common/cloudflare.py`, `common/sheets.py`
- Worker that serves the short links: `workers/redirector/`
- Click reporting (separate workflow): `docs/yt-analysis-workflow.md` → "affiliate clicks"
