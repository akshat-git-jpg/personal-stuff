# personal-stuff — Claude Code guide

The full repo map, what-runs-where, and conventions live in the README, imported below.

## How to operate here (read first)

1. **Route by the question, not by browsing.** Match the ask to the "Find it fast" table below, go straight there, and read that folder's `CLAUDE.md`/README before acting. Don't grep the whole repo to orient.
2. **Before working in any sub-folder, open its `CLAUDE.md` (or README) first** — sub-folder files are NOT auto-loaded; the map only links them.
3. **When a non-obvious decision is made** (tool/approach chosen, convention set, a load-bearing "why"), append a dated line to [`decisions.md`](decisions.md). Check there before asking me to re-explain.

## Find it fast (route by intent)

| If the ask is about… | Go to |
|---|---|
| A past decision / why something is done a certain way | [`decisions.md`](decisions.md) |
| What runs where — Cloudflare + VPS + DNS inventory | [`INFRA.md`](INFRA.md) |
| Cron architecture (Pattern B) | [`VPS-CRONS.md`](VPS-CRONS.md) |
| Every live URL across this repo (incl. `ty/`) | [`my-hosted-sites.md`](my-hosted-sites.md) |
| A custom Claude skill (source of truth) | `tooling/claude-skills/` |
| CLI tools Claude calls (gmail, sheets, youtube, hostinger, ntfy, rapidapi, yt-claude) | `tooling/cli/` |
| MCP servers (only `drive`, `cloudflare` still used) | `tooling/mcp/README.md` |
| A specific app (gym, docs, analytics, tracker, dashboard, telegram planner/email) | `apps/<name>/` |
| Infra (docker compose, VPS watchdog, secrets) | `infra/` |
| DSA practice notes/solutions | `learning/DSA/` |
| Repo-wide scripts + external path dependencies | `scripts/README.md` |
| Pinterest pin data / landing pages | [`ty/pinterest/`](ty/pinterest/) (only the *skills* live here) |

@README.md

## Operating notes

- A folder's `README.md` orients a human; its `CLAUDE.md` (where present) tells Claude how to operate there.
- `INFRA.md` — canonical Cloudflare + VPS + DNS inventory.
- `VPS-CRONS.md` — cron architecture (Pattern B). It's a runbook, not auto-loaded; open it only for cron work.
- `my-hosted-sites.md` — flat index of every live URL across this repo, including `ty/`.
- Skills under `tooling/claude-skills/` are the single source, symlinked into both accounts via `scripts/relink.sh`. Never edit a symlinked copy elsewhere — edit here.
- Pinterest pin data + landing pages live under `ty/pinterest/` (nested in this repo since the TY merge); only the Pinterest *skills* live here.
