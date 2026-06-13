# cli

Small command-line tools Claude Code calls during a session. These are the active surface for Google, YouTube, and Hostinger work — they replaced most of the MCP servers in `../mcp` because a CLI costs tokens only when it runs, while an MCP server costs tokens on every turn just by being listed.

Each tool lives in its own folder with the executable and (mostly) a README.

- `gmail/` — read and send Gmail.
- `sheets/` — read and write Google Sheets. Shares Google auth with the others via `../mcp/google-shared`.
- `youtube/` — YouTube data and transcripts (`pp-yt-transcript` fetches transcripts free; run it from a residential IP, datacenter IPs are blocked).
- `hostinger/` — Hostinger VPS and hosting API.
- `ntfy/` — send push notifications through the self-hosted ntfy server.
- `rapidapi/` — RapidAPI calls.
- `yt-claude/` — userscript + localhost relay that opens a Claude session per YouTube thumbnail.
- `ccusage-dashboard/` — Claude Code usage dashboard.

## Auth

The Google tools (`gmail`, `sheets`, `youtube`) authenticate through `../mcp/google-shared`: one OAuth client, per-account tokens. That shared dependency is why `mcp/` stays in place even though most of its servers are retired — see `../mcp/README.md`.
