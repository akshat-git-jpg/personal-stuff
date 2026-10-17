# tooling/

Backend tooling that Claude Code uses — not user-facing apps.

| Folder | What it is |
|---|---|
| `cli/` | Small CLI tools Claude calls instead of MCPs (gmail, sheets, youtube, hostinger, rapidapi, yt-claude, ccusage-dashboard, cf-email, drive, heygen-web, local-apps-dashboard). Cheaper than MCPs — cost scales with usage, not catalog size. |
| `mcp/` | MCP servers. Mostly legacy now — only `drive` and `cloudflare` are still active; gmail/sheets/youtube/hostinger moved to `cli/`. See `mcp/README.md`. |
| `butler/`, `boss/`, `maintainer/` | Folder agents: a Claude session started in the folder, whose `CLAUDE.md` is its script. Started by zsh functions in `~/.zshrc` (`butler`, `boss-work`, `chief`); setup in each README. |
| `harnesses.json` | The folder-agent list with each start command. A new folder agent gets a row here, or my-repo flags it. |
| `mods/` | Claude Code mods (plugins with a JS hooks module). |
| `press-clis/` | Printing Press Go CLIs and where their source is backed up. |

Skills live in `.claude/skills/`, not here (the old `claude-skills/` store is gone).

Note: `cli/` borrows Google auth from `mcp/google-shared/`, so the two are coupled — don't delete `mcp/` assuming it's all dead.
