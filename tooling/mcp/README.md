# MCPs for Claude Code

> **Status (2026):** Mostly legacy. The Gmail / Sheets / YouTube / Hostinger work moved to plain CLIs in `../cli`, which cost tokens only when they run. `google-drive`, `cloudflare`, and `davinci-resolve`(-advanced) are wired into the active `.mcp.json`. This folder stays in place for two reasons: the CLIs in `../cli` borrow their Google OAuth from `mcp/google-shared`, and the VPS `gmail-digest` cron runs `gmail-mcp-server/server.py` directly (see `../../VPS-CRONS.md`). Don't move it without updating those.

A bundle of MCP (Model Context Protocol) servers that Claude Code can call as tools while you work in this repo. Examples: read/write Google Sheets, query a Cloudflare D1 database, search YouTube, send a Gmail draft.

These are **optional** for interactive use. The CLIs in `../cli` and the VPS cron scripts work without them. MCPs only matter when you're driving Claude Code interactively and want it to do things for you instead of running a CLI yourself.

This is the single source of truth for the MCP code. (It used to be mirrored into the TY repo; that copy was removed — TY's Python scripts authenticate with their own service-account `credentials.json` and never needed it.)

## Why MCPs (when CLIs already exist)?

The pro of MCPs over CLIs isn't "they replace them" — it's that they make the questions that aren't worth a dedicated command suddenly answerable in seconds. That's the real value-add. Most actual workflows run on CLIs/scripts by design; MCPs add an interactive layer on top.

---

## One-time setup

### 1. Install Python deps

Each MCP server has its own `requirements.txt`. Easiest:

```bash
cd /path/to/personal-stuff/tooling/mcp
for d in */; do
  pip3 install --user -r "$d/requirements.txt" 2>/dev/null || true
done
```

The packages are small — `mcp`, `requests`, `google-api-python-client`, etc.

### 2. Google MCPs — OAuth consent (one-time per Google account)

The Gmail / Sheets / Drive / Tasks / YouTube MCPs all share `google-shared/`. You'll need:

1. An OAuth Desktop client `credentials.json` from Google Cloud Console.
   Put it at `google-shared/credentials.json` (gitignored, won't leak).
2. For each Google account you want to use, run the consent flow once:

```bash
cd google-shared
python3 setup_auth.py your_email@gmail.com
```

That'll pop a browser, you accept the scopes, and it saves a token at `google-shared/tokens/your_email@gmail.com.json` (gitignored).

After that, every tool call takes an `account: "your_email@gmail.com"` arg so it knows which account to act as.

### 3. Cloudflare MCP — env vars

Reads from the project `.env`. You need:

```
CF_API_TOKEN=...           # token with D1 + KV read/write
CF_ACCOUNT_ID=...
CF_D1_DATABASE_ID=...
CF_KV_NAMESPACE_ID=...
```

### 4. Hostinger MCP — env vars

This folder has its own `.env` file (gitignored). See the per-folder README or just skip it if you don't use those services.

### 5. Register with Claude Code

Create `.mcp.json` (gitignored) with the path to each MCP server you want. Copy `.mcp.json.template` and replace `<PATH_TO_REPO>` with your absolute path to the repository root, then trim it down to the servers you actually use (the active setup is just `google-drive` + `cloudflare`):

```bash
sed "s|<PATH_TO_REPO>|$(cd ../.. && pwd)|g" .mcp.json.template > ../../.mcp.json
```

Restart Claude Code. The MCPs should show up in the `/mcp` list.

---

## Optional MCPs (skip if you don't need them)

Each entry in `.mcp.json` is independent — delete the ones you don't use. The active default is `google-drive` + `cloudflare` + `davinci-resolve`(-advanced).

- `google-drive-mcp-server/` — Google Drive. Active default.
- `cloudflare-mcp-server/` — Cloudflare D1/KV/DNS. Active default.
- `davinci-resolve-mcp/` — Control DaVinci Resolve (edit points, timelines, color, render) from [samuelgursky/davinci-resolve-mcp](https://github.com/samuelgursky/davinci-resolve-mcp), vendored as plain source (own `.git` stripped on clone, like the other server folders). Two servers registered: `davinci-resolve` (Python, compound 34-tool surface, `src/server.py` via its own `venv/`) and `davinci-resolve-advanced` (Node, granular 341-tool surface, `bin/davinci-resolve-advanced-mcp.mjs`). **The Python server requires DaVinci Resolve *Studio*** (the free edition has no external-scripting API — and this Mac runs the FREE 21.0.2, verified 2026-07-21, so `davinci-resolve` tools will NOT connect here until a Studio upgrade) with **Preferences → General → External scripting using → Local**, and Resolve running before tool calls will connect. **`davinci-resolve-advanced` needs no Resolve at all** — it authors/edits `.drp`/`.drt`/`.drx` files offline (vendored `resolve-advanced/` lib) and is the engine behind the GFX-19 DRT-native export path (POC 2026-07-20/21: structure/transitions import ✓, media-pool + Text+ blobs are the open problems — see `docs/specs/2026-07-21-native-editor-export-design.md`). `RESOLVE_SCRIPT_API`/`RESOLVE_SCRIPT_LIB`/`PYTHONPATH` in `.mcp.json` are pre-filled with the standard macOS paths — update them if Resolve is ever installed somewhere nonstandard. To refresh: `cd davinci-resolve-mcp && git pull` won't work (no `.git`) — re-clone over it, or run `python3 install.py --update-now` from a real clone and copy `src/` back in.
- `gmail-mcp-server/` — Gmail. Legacy for interactive use, but still run directly by the VPS `gmail-digest` cron (see `../../VPS-CRONS.md`) — don't delete.
- `google-sheets-mcp-server/` — Google Sheets. Legacy; superseded by `../cli/sheets`.
- `google-task-mcp-server/` — Google Tasks. Legacy.
- `youtube-mcp-server/` — YouTube data. Legacy; superseded by `../cli/youtube`.
- `hostinger/` — Hostinger VPS/hosting API. Legacy; superseded by `../cli/hostinger`.
- `google-shared/` — not a standalone MCP; shared Google OAuth client/token cache used by the Google servers above and by `../cli`.
