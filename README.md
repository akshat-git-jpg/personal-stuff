# personal stuff

Single repo for personal projects, the tooling that lets Claude Code drive them, and the infra they run on. Most of it deploys to Cloudflare or a Hostinger VPS; the VPS pulls this repo on every cron tick, so paths here are load-bearing.

If you're orienting from scratch, read `INFRA.md` (what runs where) and `VPS-CRONS.md` (how the crons are wired) after this file.

## The map

Everything falls into five buckets.

### Claude tooling
- `claude-skills/` — Custom Claude Code skills. This is the single source; a relink script symlinks them into both the work and personal accounts.
- `cli/` — Small command-line tools Claude calls instead of MCP servers: `gmail`, `sheets`, `youtube`, `hostinger`, `ntfy`, `rapidapi`, plus `yt-claude` and a ccusage dashboard. This is the active surface for Google/YouTube/Hostinger work.
- `mcp/` — MCP servers. Mostly legacy now — only `drive` and `cloudflare` are still used. Shares Google OAuth with `cli/` through `mcp/google-shared`, which is why it stays where it is. See `mcp/README.md`.
- `.claude/` — Repo-level Claude settings (`settings.json`, `settings.local.json`).

### Personal apps
- `gym-app/` — Mobile gym PWA, live at `kushal-gym.agrolloo.com`. Vite + React + Hono on a Cloudflare Worker, backed by a Google Sheet.
- `personal-dashboard/` — Mobile dashboard PWA at `my-dashboard.agrolloo.com`, running as a Docker container on the VPS.
- `my-planner/` — Daily routine, to-do list, and exercise routine. Feeds the morning digest cron on the VPS.
- `email-assistant/` — Per-account Gmail digest preferences and `digest.sh` (runs on a VPS cron).
- `bank-statement-parser/` — Python tool that parses and reconciles bank statements.

### Money / marketing
- `landing-pages/` — Per-niche static landing pages, each an assets-only Cloudflare Worker. `keto-kitchen` and `bridebestie` are live. See `landing-pages/README.md`.

### Infra
- `docker/` — Compose files for the VPS containers (currently `ntfy`).
- `vps-watchdog/` — Cloudflare Worker on a 2-minute cron that pings the dashboard and reboots the VPS via the Hostinger API if it's down.
- `secrets/` — Local-only credentials. Gitignored, never committed.
- `INFRA.md` — Canonical inventory of Cloudflare + VPS + DNS.
- `VPS-CRONS.md` — Full cron architecture (Pattern B).

### Learning
- `DSA/` — Data structures and algorithms practice: notes plus solutions, one folder per topic.

### Notes
- `docs/` — Research notes and design specs. `docs/archive/` holds retired references (e.g. the deprecated Hermes agent).

## Conventions

- `README.md` in a folder explains what it is, for a human. `CLAUDE.md` (where present) tells Claude how to operate in that folder.
- Folder names are kebab-case.
- `.mcp.json` is gitignored — it holds machine-absolute paths and is regenerated per machine.
