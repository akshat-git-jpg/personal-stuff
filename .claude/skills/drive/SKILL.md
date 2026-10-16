---
name: drive
description: Google Drive through the pp-drive CLI (no MCP). Search, upload, mirror a folder, download (Docs/Sheets/Slides exported), move, rename, share and trash files on a personal Google account. Triggers on "upload to drive", "find in my drive", "search drive", "share this file", "give X access", "download from drive", "move to folder", "rename in drive", "put this on drive".
---

# Google Drive via pp-drive

All Drive work goes through `pp-drive`. There is no Drive MCP any more (retired 2026-10-16).

```
CLI: tooling/cli/drive/pp-drive      (README: tooling/cli/drive/README.md)
```

Every command takes `--account <full-email>` (usually `kushalbakliwal25@gmail.com`; `pp-drive accounts` lists them). Every ID argument also takes a pasted Drive URL.

## Commands

```bash
pp-drive search 'invoice' --account E                  # name contains, newest first
pp-drive search "mimeType='application/pdf'" --raw --account E
pp-drive list-folder ID --account E
pp-drive upload FILE --parent ID [--name N] [--overwrite] --account E
pp-drive mirror LOCALDIR [--parent ID] --account E    # whole folder tree
pp-drive download ID --out PATH --account E
pp-drive ensure-folder NAME [--parent ID] --account E
pp-drive move ID --to FOLDER_ID --account E
pp-drive rename ID NEW_NAME --account E
pp-drive share ID --email X [--role reader|commenter|writer] [--no-notify] --account E
pp-drive share ID --anyone --account E                 # anyone with the link
pp-drive trash ID --account E                          # recoverable 30 days
```

## Rules

- **Ask before `share` and `trash`.** Name the file and who gets access; wait for a yes in the same turn.
- There is no permanent delete on purpose. `trash` is the only removal.
- `invalid_grant` or "No token" = re-consent: `python3 tooling/mcp/google-shared/setup_auth.py <email>`.
