# Google Sheets MCP Server

Gives Claude full read/write/structure/format control over Google Sheets.

## Tools (14)

**Read** — `get_spreadsheet_info`, `read_range`
**Write** — `write_range`, `append_rows`, `clear_range`
**Structure** — `create_spreadsheet`, `add_tab`, `rename_tab`, `delete_tab`, `insert_dimension`, `delete_dimension`
**Data & format** — `sort_range`, `find_replace`, `format_cells`

Spreadsheets are addressed by **ID or pasted URL**; tabs by **name**. `read_range` returns a header line plus the values as a JSON 2D array, which round-trips into `write_range`.

## Setup

Auth uses **OAuth user credentials** (`credentials.json` + `token.json`). It acts as
the signed-in user, so it can touch every spreadsheet that user can access — no
per-sheet sharing.

> Why not the gcloud default client / a service account? Google now **blocks** the
> Sheets scope on gcloud's default client, and a service account in a consumer
> project has no Drive (can't create sheets, needs per-sheet sharing). An own OAuth
> Desktop client is the only path to full all-sheets access.

1. **Create an OAuth Desktop client** (one-time, Console UI — no API exists for this):
   Console → APIs & Services → Credentials → **Create credentials → OAuth client ID →
   Desktop app** → Download JSON → save it here as `credentials.json`.
   The consent screen must list your Google account as a **test user**.

2. **Install deps**
   ```bash
   /Library/Frameworks/Python.framework/Versions/3.11/bin/python3 -m pip install -r requirements.txt
   ```

3. **One-time consent**
   ```bash
   /Library/Frameworks/Python.framework/Versions/3.11/bin/python3 setup_auth.py
   ```
   A browser opens; approve once. `token.json` is written and **auto-refreshes from
   then on** — no further logins.

4. **Register** — the server is registered in `~/.claude-personal/.claude.json` as `google-sheets` (stdio). Restart the personal Claude session to load it.

## Notes

- Scope: `https://www.googleapis.com/auth/spreadsheets` (full read/write).
- `value_input` defaults to `USER_ENTERED` (parses formulas/dates/numbers like the UI); pass `RAW` to store literally.
- For `sort_range`, exclude the header row from the range (e.g. `Sheet1!A2:D20`).
- Destructive tools (`delete_tab`, `delete_dimension`, `clear_range`) rely on Claude's normal per-tool permission prompt.
