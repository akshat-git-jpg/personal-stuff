# MCPs for Claude Code

**MCP is the last resort here.** A CLI plus a front-door skill is the default tool shape,
because an MCP server costs tokens every turn just by being listed, while a CLI costs tokens
only when it runs (see `../cli/README.md`, "How Claude finds a CLI").

## What is in this folder

| Folder | Status | Why it stays |
|---|---|---|
| `cloudflare-mcp-server/` | wired | D1 / KV / DNS for Workers. No CLI replaces it yet |
| `davinci-resolve-mcp/` | wired (two servers) | Talks to a running Resolve app, and authors `.drp`/`.drt` files offline |
| `kb-editor/` | wired | Starts the kb-editor app's own MCP shim, so the yt-video-edit session drives the editor; the app is MCP-driven by design (`README.md` there) |
| `google-task-mcp-server/` | not wired by default | The `apps/telegram-my-planner` "process my tasks" workflow drives it; no Tasks CLI exists. Add it to `.mcp.json` for that session |
| `gmail-mcp-server/` | not wired | The VPS `gmail-digest` cron runs `server.py` directly (`../../VPS-CRONS.md`). Do not delete |
| `google-shared/` | not an MCP | One Google OAuth client + per-account tokens, used by every Google CLI in `../cli` |
| `hostinger/` | not an MCP | Token home for `pp-hostinger` and the escrow backup |

Deleted 2026-10-16, replaced by CLIs: `google-drive` (`pp-drive`), `indian-railways`
(`pp-trains`), `google-sheets` (`pp-sheets`), `youtube` (`pp-youtube`), `hostinger` server (`pp-hostinger`). Their code is in git history before that date.

## Setup

1. **Python deps:** `pip3 install --user -r cloudflare-mcp-server/requirements.txt`.
   DaVinci Resolve has its own `davinci-resolve-mcp/venv/`.
2. **Google logins (for the CLIs):** put the OAuth Desktop client at
   `google-shared/credentials.json` (gitignored), then once per account:
   `python3 google-shared/setup_auth.py you@gmail.com`. Tokens land in `google-shared/tokens/`.
3. **Cloudflare env** in `pipelines/.env`: `CF_API_TOKEN`, `CF_ACCOUNT_ID`,
   `CF_D1_DATABASE_ID`, `CF_KV_NAMESPACE_ID`.
4. **Register:** run `./scripts/regen-mcp-json.sh` from the repo root. It writes the
   gitignored `.mcp.json` with this machine's absolute paths. Run it from the main checkout,
   never from a worktree, or the paths point at a folder that will be deleted. Restart
   Claude Code; the servers show in `/mcp`.

## DaVinci Resolve notes

From [samuelgursky/davinci-resolve-mcp](https://github.com/samuelgursky/davinci-resolve-mcp),
vendored as plain source (no `.git`). `davinci-resolve` (Python, 34 tools) needs Resolve
**Studio** running with Preferences → General → External scripting → Local; this Mac runs the
free edition (checked 2026-07-21), so it will not connect until a Studio upgrade.
`davinci-resolve-advanced` (Node, 341 tools) needs no Resolve: it edits `.drp`/`.drt`/`.drx`
files offline and backs the DRT-native export path
(`../../docs/specs/2026-07-21-native-editor-export-design.md`). To update, re-clone over the
folder and copy `src/` back in.
