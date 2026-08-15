# ccusage-dashboard

Local dashboard (`dashboard.mjs`) for `ccusage` — visualizes Claude Code token
usage and cost across the work + personal accounts.

<!-- stub: flesh out with how to run it (node dashboard.mjs) + what it reads. -->

## Workspace scan

The `workspace.mjs` module provides a comprehensive scan of the local Claude environment. It reads configuration and telemetry from the `work` and `personal` accounts, returning data organized into four layers:
- **Apps**: Local dashboard apps, CLIs, and MCP servers (repo- and user-scoped).
- **Routines**: Scheduled crons, parsed from `../vps-crons` (which is optional; if missing, returns an empty array with warnings).
- **Memory**: Static markdown context docs, indices, and the dynamic `MEMORY.md`.
- **Skills**: All available skills along with their usage counters and disabled status.
