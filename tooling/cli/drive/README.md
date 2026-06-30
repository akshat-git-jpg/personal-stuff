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

Idempotent: folders are found-or-created; files are skipped if a same-named file already exists in that folder (`--overwrite` to replace). `root` or omitted `--parent` means My Drive root.

> Stub scaffolded by `/audit-repo-route` — flesh out as needed.
