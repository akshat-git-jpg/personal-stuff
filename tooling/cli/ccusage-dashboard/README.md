# ccusage-dashboard

Local dashboard (`dashboard.mjs`) for `ccusage` — visualizes Claude Code token
usage and cost across the work + personal accounts.

## Run it

```bash
node dashboard.mjs          # then open the printed URL (default http://localhost:4319)
PORT=4399 node dashboard.mjs
```

Zero dependencies — Node built-ins only. `Ctrl-C` to stop.

## Requires ccusage >= 20.0.20

The dashboard shells out to `ccusage`, and loads daily + session data in **one**
call via `--sections` (this halves the online pricing lookups). That flag only
exists from **20.0.20**.

On an older `ccusage` the flag is rejected, every scope errors, and the cards read
**$0** — which looks like "no usage" rather than "wrong version". Two guards make
that unmissable: startup prints the detected version and shouts if it is below the
minimum, and each account card shows `ccusage too old (needs >= …)` instead of
ccusage's raw `Unknown option` text.

```bash
npm i -g ccusage@latest
```

Point at a specific binary with `CCUSAGE_BIN=/path/to/ccusage` if it is somewhere
unusual. With no `ccusage` installed anywhere known, the dashboard falls back to
`npx -y ccusage`, which fetches a current version — so a machine with *nothing*
installed works, while a machine with an *old* global install is the case that
breaks.

## What it reads

Account config dirs, discovered at startup — never hardcoded:

| On disk | Shown as |
|---|---|
| `~/.claude-work` and/or `~/.claude-personal` | `Work`, `Personal`, plus `Total` when both exist |
| neither present → `$CLAUDE_CONFIG_DIR` or `~/.claude` | a single `Personal` card |

So a two-login machine shows three cards and a single-login machine shows one.
Note the fallback is only consulted when **no** `.claude-work`/`.claude-personal`
exists; on a dual-account machine a stray `~/.claude` is deliberately ignored.

Live plan limits (the 5-hour and weekly windows `/usage` shows) come from the
Claude Code OAuth token — the macOS Keychain, or `<configDir>/.credentials.json`
on Windows and Linux. Read-only by design: an expired token surfaces a message
rather than being refreshed, since refreshing from outside Claude Code would
rotate the refresh token and desync Claude Code's own copy.

## Workspace scan

The `workspace.mjs` module provides a comprehensive scan of the local Claude environment. It reads configuration and telemetry from the `work` and `personal` accounts, returning data organized into four layers:
- **Apps**: Local dashboard apps, CLIs, and MCP servers (repo- and user-scoped).
- **Routines**: Scheduled crons, parsed from `../vps-crons` (which is optional; if missing, returns an empty array with warnings).
- **Memory**: Static markdown context docs, indices, and the dynamic `MEMORY.md`.
- **Skills**: All available skills along with their usage counters and disabled status.

## Workspace tab

The dashboard features two tabs: **Usage** (cost and token tracking) and **Workspace**.
The Workspace tab visualizes the four layers of the Claude environment in sortable tables:
- **Apps & connections**: Local apps, CLIs, and MCP servers with their status and usage.
- **Routines**: Scheduled cron jobs from the vps-crons repository.
- **Memory**: Static and dynamic context files with their sizes and modified dates.
- **Skills**: All available skills, their source, and usage counters.

A "Show dead only" toggle allows quick filtering to identify unused or disabled resources (for cleanup). The active tab is preserved in the URL (`?tab=usage` or `?tab=workspace`), which allows linking directly to a specific view.
