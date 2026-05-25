# MCPs for Claude Code

A bundle of MCP (Model Context Protocol) servers that Claude Code can call as tools while you work in this repo. Examples: read/write Google Sheets, query a Cloudflare D1 database, search YouTube, send a Gmail draft.

These are **optional**. The TY scripts (`youtube/`, `common/`, `workers/`) all work without them. MCPs only matter when you're driving Claude Code interactively and want it to do things for you instead of running scripts yourself.

If you've never used Claude Code, you can ignore this folder entirely.

## Why MCPs (when scripts already exist)?

The pro of MCPs over scripts isn't "they replace scripts" — it's that they make the questions that aren't worth writing a script for suddenly answerable in seconds. That's the real value-add.

TY's actual workflows still run on scripts (not MCPs) by design; MCPs add an interactive Claude Code layer on top — useful for one-off questions, cross-tool chains, and reasoning tasks, but not a replacement for the batch scripts.

---

## One-time setup

### 1. Install Python deps

Each MCP server has its own `requirements.txt`. Easiest:

```bash
cd /path/to/TY/mcp
for d in */; do
  pip3 install --user -r "$d/requirements.txt" 2>/dev/null || true
done
```

The packages are small — `mcp`, `requests`, `google-api-python-client`, etc.

### 2. Google MCPs — OAuth consent (one-time per Google account)

The Gmail / Sheets / Drive / Calendar / Docs / Tasks / YouTube MCPs all share `google-shared/`. You'll need:

1. An OAuth Desktop client `credentials.json` from Google Cloud Console.
   Put it at `mcp/google-shared/credentials.json` (gitignored, won't leak).
2. For each Google account you want to use, run the consent flow once:

```bash
cd mcp/google-shared
python3 setup_auth.py your_email@gmail.com
```

That'll pop a browser, you accept the scopes, and it saves a token at `mcp/google-shared/tokens/your_email@gmail.com.json` (gitignored).

After that, every tool call takes an `account: "your_email@gmail.com"` arg so it knows which account to act as.

### 3. Cloudflare MCP — env vars

Reads from `TY/.env`. You need:

```
CF_API_TOKEN=...           # token with D1 + KV read/write
CF_ACCOUNT_ID=...
CF_D1_DATABASE_ID=...
CF_KV_NAMESPACE_ID=...
```

These should already be in TY's `.env` if the rest of TY is set up.

### 4. Hostinger / ElevenLabs MCPs — env vars

Each of those folders has its own `.env` file (gitignored). See the per-folder README or just skip them if you don't use those services.

### 5. Register with Claude Code

Create `TY/.mcp.json` (gitignored) with the path to each MCP server. Copy `mcp/.mcp.json.template` and replace `<PATH_TO_TY>` with your absolute path:

```bash
sed "s|<PATH_TO_TY>|$(pwd)|g" mcp/.mcp.json.template > .mcp.json
```

Restart Claude Code. The MCPs should show up in the `/mcp` list.

---

## Optional MCPs (skip if you don't need them)

If you don't want all 11 servers registered, just delete entries from your `.mcp.json` for ones you don't use. Each entry is independent.

## Maintenance

Code lives in both this repo (`TY/mcp/`) and `personal stuff/mcp/` on the maintainer's machine. To keep them in sync after edits:

```bash
./mcp/sync-mcps.sh             # personal stuff → TY
./mcp/sync-mcps.sh --reverse   # TY → personal stuff
./mcp/sync-mcps.sh --dry-run   # preview
```

Tokens, credentials, and `.env` files are excluded from sync (machine-specific).
