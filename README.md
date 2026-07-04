# personal-stuff

Single repo for personal projects, the tooling that lets Claude Code drive them, and the infra they run on. Most of it deploys to Cloudflare or a Hostinger VPS; the VPS pulls this repo on every cron tick, so paths here are load-bearing.

If you're orienting from scratch, read `INFRA.md` (what runs where) and `VPS-CRONS.md` (how the crons are wired) after this file.

## The map

The top level is grouped into buckets. Each bucket and most projects have their own README.

### `tooling/` — what lets Claude Code drive everything
- `claude-skills/` — Custom Claude Code skills. The single source; `scripts/relink.sh` symlinks them into both the work and personal accounts.
- `cli/` — Small command-line tools Claude calls instead of MCP servers: `gmail`, `sheets`, `youtube`, `hostinger`, `ntfy`, `rapidapi`, plus `yt-claude` and a ccusage dashboard. The active surface for Google/YouTube/Hostinger work.
- `mcp/` — MCP servers. Mostly legacy — only `drive` and `cloudflare` are still used. Shares Google OAuth with `cli/` through `mcp/google-shared` (kept a sibling of `cli/` so that relative path resolves). See `tooling/mcp/README.md`.

### `apps/` — personal apps
- `kushal-tools/` — KushalTools hub at `kushal-tools.agrolloo.com`. A card launcher linking every live agrolloo.com site; behind a shared-password gate. A single Hono Worker that renders the hub + login pages itself (no assets binding, no build step) so the PIN protects the page.
- `gym-app/` — Mobile gym PWA, live at `kushal-gym.agrolloo.com`. Vite + React + Hono on a Cloudflare Worker, backed by a Google Sheet.
- `kushal-docs/` — Personal document-vault PWA at `kushal-docs.agrolloo.com`. Upload/name/tag/filter PDFs + images. Vite + React + Hono on a Cloudflare Worker, files in R2, Google sign-in locked to one email.
- `analytics-app/` — YT Analytics dashboard at `yt-analytics.agrolloo.com`. Per-video, per-link click counts for the `go.agrolloo.com` shortener. Vite + React + Hono on a Cloudflare Worker, reading the shortener's `clicks-db` D1 read-only, password-gated. The shortener itself lives in `apps/redirector/`.
- `tracker-app/` — YT tutorials Kanban at `tutorials-tracker.agrolloo.com`. Role-aware 5-stage pipeline over the YT tracker sheet; also mints `go.agrolloo.com` short links (writes the shortener's `CLICKS_KV` + `clicks-db` D1). Vite + React + Hono on a Cloudflare Worker, Google OAuth, sessions in KV. The redirector that serves the links lives in `apps/redirector/`, while `sync_clicks.py` lives in `pipelines/youtube/yt-analysis/`.
- `redirector/` — URL redirector and shortener for `go.agrolloo.com`. Cloudflare Worker, click tracking via KV + D1 (`clicks-db`).
- `pinterest-landing-pages/` — Static landing page funnels (keto kitchen, bridebestie) for Pinterest marketing. Cloudflare Workers.
- `personal-dashboard/` — Mobile dashboard PWA at `my-dashboard.agrolloo.com`, running as a Docker container on the VPS.
- `telegram-my-planner/` — Daily routine, to-do list, and exercise routine. Feeds the morning Telegram digest cron on the VPS.
- `telegram-email-assistant/` — Per-account Gmail digest preferences and `digest.sh` (runs on a VPS cron, sends to Telegram).
- `founders-tracker/` — Shared action-item tracker for Khushi & Kushal at `founders.agrolloo.com`. Two owner tabs, drag-ordered tasks, hazard cards, an on-time scoreboard, and auto-recurring tasks. Vite + React + Hono on a Cloudflare Worker, backed by D1 (`founders-db`), shared-PIN gate; a daily Cron Trigger materializes recurring tasks.
- `hyperframes-render/` — Paste-and-render web tool for Hyperframes video cards at `render2.agrolloo.com` (password-gated). Express + headless Chrome renders pasted HTML to MP4; the Templates tab reads cards live from `pipelines/video/card-library/`.
- `lists-app/` — Plain-text lists grouped by category (e.g. "YouTube channel ideas", "Skills to learn"), single-user PIN-gated, at `lists.agrolloo.com`.
- `spending-tracker/` — Daily spend tracker that auto-categorizes card/UPI transactions. Design notes only — not built yet.

### `infra/`
- `docker/` — Compose files for the VPS containers (currently `ntfy`).
- `vps-watchdog/` — Cloudflare Worker on a 2-minute cron that pings the dashboard and reboots the VPS via the Hostinger API if it's down.
- `secrets/` — Local-only credentials. Gitignored, never committed.

### `learning/`
- `DSA/` — Data structures and algorithms practice: notes plus solutions, one folder per topic.

### Top level
- `scripts/` — Repo-wide orchestration (`relink.sh`, `regen-mcp-json.sh`) plus an index of everything outside the repo that depends on its layout. See `scripts/README.md`.
- `docs/` — Research notes and design specs.
- `.claude/` — Repo-level Claude settings (`settings.json`, `settings.local.json`).
- `INFRA.md` — Canonical inventory of Cloudflare + VPS + DNS.
- `VPS-CRONS.md` — Full cron architecture (Pattern B).

## Related

- Business and money-making projects live under `pipelines/` (nested in this repo since the TY merge). The subtree covers YouTube pipelines, video production, Pinterest business (pin data + landing pages), and income analysis. Its guide is at [`pipelines/CLAUDE.md`](pipelines/CLAUDE.md). The Pinterest *skills* still live here in `tooling/claude-skills/`.

## Conventions

- `README.md` in a folder explains what it is, for a human. `CLAUDE.md` (where present) tells Claude how to operate in that folder.
- Folder names are kebab-case.
- `.mcp.json` is gitignored — it holds machine-absolute paths and is regenerated per machine by `scripts/regen-mcp-json.sh`.
- If you move or rename a folder, check `scripts/README.md` first — several things outside the repo hardcode these paths.
