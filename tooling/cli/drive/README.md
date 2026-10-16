# drive

`pp-drive` — agent-native CLI for Google Drive (no MCP). Talks to the Drive API directly, reusing the `mcp/google-shared/` OAuth token cache shared by the other Google CLIs. Built for the tutorial-pipeline handoff: find-or-create folders and mirror a local folder tree into Drive.

All subcommands take `--account EMAIL`.

| Command | What it does |
|---|---|
| `accounts` | List available token accounts |
| `find-folder NAME [--parent ID]` | Print folder id under parent (empty if none) |
| `ensure-folder NAME [--parent ID]` | Find-or-create, print id |
| `upload FILE --parent ID [--name N] [--overwrite]` | Upload a file, print id + link |
| `mirror LOCALDIR [--parent ID] [--overwrite]` | Recreate the local tree in Drive (dirs→folders, files→uploads) |
| `stat ID` | Print tab-separated id, name, mimeType |
| `list-folder ID` | Print tab-separated id, name, mimeType for children |
| `download ID --out PATH` | Download a file (Docs/Sheets/Slides are exported as PDF/CSV/PDF), print saved <path> |
| `search QUERY [--max N] [--raw]` | Name-contains search, newest first; `--raw` takes a Drive query (`mimeType='application/pdf'`) |
| `move ID --to FOLDER_ID` | Move into another folder |
| `rename ID NEW_NAME` | Rename |
| `share ID --email X [--role R] [--no-notify]` / `share ID --anyone` | Give a person, or anyone with the link, access (reader, commenter, writer) |
| `trash ID` | Move to Drive trash (recoverable for 30 days). No permanent delete on purpose |

Every ID argument also accepts a pasted Drive URL. Claude reaches this CLI through the `drive` skill; the `google-drive` MCP it replaced was retired 2026-10-16.

Idempotent: folders are found-or-created; files are skipped if a same-named file already exists in that folder (`--overwrite` to replace). `root` or omitted `--parent` means My Drive root.

