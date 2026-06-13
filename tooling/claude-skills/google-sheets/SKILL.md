---
name: google-sheets
description: Read and write Google Sheets via the pp-sheets CLI (no MCP needed). Use whenever a task involves reading a spreadsheet, updating cells, appending rows, creating a sheet/tab, sorting, find-replace, or formatting in Google Sheets. Triggers on "read the sheet", "update the spreadsheet", "append to the sheet", "add a row to the google sheet", "create a spreadsheet", "what's in the sheet".
---

# Google Sheets via pp-sheets

All Google Sheets work goes through the `pp-sheets` CLI — do NOT look for a sheets MCP server (it was removed to save context).

```
CLI: "/Users/kbtg/codebase/personal stuff/tooling/cli/sheets/pp-sheets"
```

Every command requires `--account <full-email>` (which Google account's token to use). List available accounts with `pp-sheets accounts`. SPREADSHEET accepts a raw ID or a full pasted URL.

## Commands

```bash
pp-sheets info SPREADSHEET --account EMAIL                  # title + tabs/dimensions
pp-sheets read SPREADSHEET 'Tab!A1:D20' --account EMAIL     # bare tab name = whole tab
pp-sheets write SPREADSHEET 'Tab!A1' --values '[["a",1]]' --account EMAIL
pp-sheets append SPREADSHEET Tab --values '[["row1col1","row1col2"]]' --account EMAIL
pp-sheets clear SPREADSHEET 'Tab!A2:D20' --account EMAIL
pp-sheets create "Title" --account EMAIL
pp-sheets add-tab SPREADSHEET "Title" --account EMAIL
pp-sheets rename-tab SPREADSHEET OLD NEW --account EMAIL
pp-sheets delete-tab SPREADSHEET "Title" --account EMAIL
pp-sheets insert SPREADSHEET Tab ROWS 5 2 --account EMAIL       # 2 blank rows at 0-based index 5
pp-sheets delete-dim SPREADSHEET Tab COLUMNS 3 1 --account EMAIL
pp-sheets sort SPREADSHEET 'Tab!A2:D20' B --desc --account EMAIL  # exclude header row
pp-sheets find-replace SPREADSHEET FIND REPLACE [--tab T] [--match-case] [--entire-cell] --account EMAIL
pp-sheets format SPREADSHEET 'Tab!A1:D1' --bold --bg '#FFF2CC' --fg '#000000' --number-format '0.00' --account EMAIL
```

## Notes

- `--values` is a JSON 2D array (row-major); use `@file.json` to read from a file for big payloads.
- `write`/`append` default to USER_ENTERED (formulas/dates parse like the UI); pass `--value-input RAW` to store literally.
- Auth is shared with `mcp/google-shared/tokens/` — if a token is expired/revoked the error says `invalid_grant`; fix by re-running `python3 mcp/google-shared/setup_auth.py` for that account (interactive browser consent).
- Read big tabs in slices (`'Tab!A1:F50'`), not the whole tab, to keep output small.
