# tooling/

Backend tooling that Claude Code uses — not user-facing apps.

| Folder | What it is |
|---|---|
| `cli/` | Small CLI tools Claude calls instead of MCPs (gmail, sheets, youtube, hostinger, ntfy, rapidapi, yt-claude, ccusage-dashboard). Cheaper than MCPs — cost scales with usage, not catalog size. |
| `mcp/` | MCP servers. Mostly legacy now — only `drive` and `cloudflare` are still active; gmail/sheets/youtube/hostinger moved to `cli/`. See `mcp/README.md`. |
| `claude-skills/` | Custom Claude Code skills. Single source for both work + personal accounts, symlinked in via `../scripts/relink.sh`. Membership controlled by `claude-skills/manifest/{work,personal}.txt`. |

Note: `cli/` borrows Google auth from `mcp/google-shared/`, so the two are coupled — don't delete `mcp/` assuming it's all dead.
