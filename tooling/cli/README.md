# cli

Small command-line tools Claude Code calls during a session. These are the active surface for Google, YouTube, and Hostinger work — they replaced most of the MCP servers in `../mcp` because a CLI costs tokens only when it runs, while an MCP server costs tokens on every turn just by being listed.

Each tool lives in its own folder with the executable and (mostly) a README.

- `gmail/` — read and send Gmail.
- `sheets/` — read and write Google Sheets. Shares Google auth with the others via `../mcp/google-shared`.
- `youtube/` — YouTube data and transcripts (`pp-yt-transcript` fetches transcripts free; run it from a residential IP, datacenter IPs are blocked).
- `hostinger/` — Hostinger VPS and hosting API.
- `ntfy/` — send push notifications through the self-hosted ntfy server.
- `rapidapi/` — RapidAPI calls.
- `flights/` — `pp-flights`, flight search with live prices via Skyscanner's public web API. No key, no browser, no login.
- `yt-claude/` — userscript + localhost relay that opens a Claude session per YouTube thumbnail.
- `ccusage-dashboard/` — Claude Code usage dashboard.
- `cf-email/` — sets up Cloudflare Email Routing (catch-all → hub inbox) for a niche domain in one command.
- `drive/` — `pp-drive`, agent-native Google Drive CLI; shares Google auth with the others via `../mcp/google-shared`.
- `heygen-web/` — drives HeyGen's web-session API for unlimited free Avatar III videos (the metered developer API/MCP can't do this).
- `local-apps-dashboard/` — local control panel (`:4321`) for dev servers that don't run on the VPS or Cloudflare.
- `flow-queue/` — `pp-flow-queue`, a relay (`:4399`) that hands image-generation prompts to the ZAPI FLOW browser extension for Google Flow. Any pipeline with a "approve the look before building it" gate pushes to it; the extension polls and fills its own queue with no click.

Printing Press generated a second set of CLIs (`paypal-txns`, `impact`, `gumroad`, `skool`, `pinterest`). Those are Go, they build out of `~/printing-press/library/`, and they are not in this folder. So far only `paypal-txns` has its source backed up into the repo, at `../press-clis/`.

## Auth

The Google tools (`gmail`, `sheets`, `youtube`) authenticate through `../mcp/google-shared`: one OAuth client, per-account tokens. That shared dependency is why `mcp/` stays in place even though most of its servers are retired — see `../mcp/README.md`.
