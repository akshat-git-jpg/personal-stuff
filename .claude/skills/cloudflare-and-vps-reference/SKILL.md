---
name: cloudflare-and-vps-reference
description: Use when working with Cloudflare Workers, wrangler, D1, R2, KV, custom domains, DNS, or the Hostinger VPS in personal-stuff — adding a binding, creating a database, wiring a domain, SSHing the VPS, or reasoning about which of the three deployment surfaces (Worker, VPS Docker, VPS cron) something runs on. Also use when the VPS seems unreachable or a Worker route mysteriously vanishes.
---

# Cloudflare + VPS reference (as used HERE)

## Overview

Everything public runs in one of three places: **Cloudflare Workers** (public edge), **Hostinger VPS Docker containers** (always-on box behind Traefik), or **VPS crons** (Pattern B). GitHub is the bridge — the VPS pulls, the Mac pushes. Canonical inventory: `INFRA.md` (drift repaired 2026-07-12; it lags launches, so verify with **personal-stuff-hosting-inventory**'s `scripts/verify-inventory.sh` before load-bearing use — on DRIFT trust `apps/*/wrangler.*` + `VPS-CRONS.md` over it).

## Cloudflare account facts (2026-07-12)

- Account: `akshatpatidar17@gmail.com`, id `ac525d9a38c81a18eb327571d3f76e7e`. Zones: `agrolloo.com`, `bridebestie.com`. No Pages projects — everything is Workers.
- Live MCP server `cloudflare` (from `tooling/mcp/cloudflare-mcp-server/`) gives D1 query / KV / DNS tools. Python pipelines use REST via `pipelines/common/cloudflare.py` (`D1Client`/`KVClient`; requires `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID`, `CF_KV_NAMESPACE_ID` in `pipelines/.env`).

## The three Worker shapes in this repo

| Shape | Pattern | Examples |
|---|---|---|
| SPA Worker | Vite + React + Hono, `ASSETS` binding with `not_found_handling: "single-page-application"`, `nodejs_compat` flag, `npm run deploy` = build + `wrangler deploy` | analytics-app, founders-tracker, gym-app, kushal-docs, lists-app, tutorial-tracker-app |
| Plain Worker | Hono or raw fetch handler, no build step | kushal-tools (renders its own HTML so the PIN gate precedes any content), redirector, timeblock (static frontend via `ASSETS`, no build), infra/vps-watchdog |
| Assets-only Worker | No main script, `assets.directory` only | pinterest-landing-pages/{keto-kitchen, bridebestie} |

## Custom domains and routes

- Default: `custom_domain = true` in wrangler config → **deploy auto-creates DNS + SSL** (proxied `AAAA 100::`). No manual DNS step.
- Exception 1: **redirector** uses a zone route (`go.agrolloo.com/*` + `zone_name = "agrolloo.com"`), not a custom domain.
- Exception 2 (TRAP): **gym-app and kushal-docs deploy from a build artifact that loses routes.** Their source `wrangler.jsonc` files DO carry the routes (and kushal-docs' R2 binding), but the Cloudflare Vite plugin regenerates `dist/<name>/wrangler.json` on every build and strips them there; each app's `scripts/patch-routes.mjs` re-injects into that built file during `npm run deploy`. **A bare `wrangler deploy` after a build silently drops the custom domain.** Always `npm run deploy`.
- `agrolloo.com` apex + `www` → Hostinger shared hosting (`191.101.230.133`), NOT the VPS, NOT a Worker.

## D1 / KV / R2 (state of 2026-07-12)

- **D1 (5):** `clicks-db` (owned + migrated by redirector; written by redirector + tutorial-tracker; read-only in analytics-app; columns are additive — readers tolerate new ones), `tracker-db` (tutorial-tracker's normalized store), `lists-db`, `founders-db`, `yt-rankings` (analytics-app read+write).
- **KV (4):** `CLICKS_KV` (shared: redirector + tutorial-tracker), `SESSIONS` (tutorial-tracker logins), `WATCHDOG_KV` (vps-watchdog), `BLOCKS_KV` (timeblock — one JSON blob per day).
- **R2 (1):** bucket `kushal-docs` — real personal documents, **unencrypted**; never delete/overwrite/log contents.
- Schema pushes: apps keep `schema.sql` + npm scripts like `db:local` / `db:remote` (`wrangler d1 execute <db> --local|--remote --file=schema.sql`). Migrations live with the owning app (`apps/redirector/migrations/`). **`db:remote` mutates production — for any non-additive migration on the load-bearing DBs (`clicks-db`, `tracker-db`), export the data first.**

## Secrets on Workers

`wrangler secret put <NAME>` per app for prod; mirror in gitignored `.dev.vars` for local (most apps ship `.dev.vars.example`). Ubiquitous pair: `APP_PASSWORD`/`APP_PIN` + `SESSION_SECRET` (stateless HMAC cookie gates — **rotating SESSION_SECRET logs everyone out**). Full map: **personal-stuff-config-and-secrets**.

## Hostinger VPS

- `srv1377177.hstgr.cloud` / `72.61.241.170` (IPv6 `2a02:4780:12:4d02::1`). Ubuntu 24.04, timezone **UTC**, KVM 2 (2 vCPU / 8 GB), **no swap by choice**. SSH key-only: `ssh -i ~/.ssh/hostinger_vps root@72.61.241.170`. Firewall: inbound 22/80/443 only.
- **If IPv4 to the origin is blocked, the VPS is reachable over IPv6** — try `ssh root@2a02:4780:12:4d02::1` before declaring it down.
- Docker (6 containers; INFRA.md's "5" predates render2): `traefik` (the public edge, owns 80/443 + Let's Encrypt), `n8n` (:5678 internal), `personal-dashboard` (:8787 internal → my-dashboard.agrolloo.com), `hyperframes-render` (→ render2.agrolloo.com), `minio` (**loopback-only** :9000/:9001 — reach via SSH tunnel), `ntfy` (**public :8888, plain HTTP by design** — the topic name is the secret). Live truth: `ssh root@72.61.241.170 'docker ps'`.
- `infra/vps-watchdog/` (Worker, cron `*/2 * * * *`, no HTTP route) pings the dashboard and reboots the VPS via Hostinger API when down — remember it exists before hand-diagnosing "the VPS rebooted itself".
- Traefik renews TLS via **Cloudflare DNS-01** (`CF_DNS_API_TOKEN` in `/docker/n8n/.env`, resolver name `mytlschallenge` kept) — set up 2026-06-13 because TLS-ALPN breaks behind the Cloudflare proxy. Do not revert to `tlschallenge`.
- Placement rule for new services: web apps/sites → Cloudflare Workers; always-on stateful things (n8n, crons, scrapers, renderers, claude-rc) → VPS. Don't downgrade the VPS plan while those live there.
- Key paths: `/srv/projects/personal-stuff` (code clone, read-only deploy key — pushes from VPS are rejected by design), `/srv/crons` (vps-crons clone, read-write), `/docker/*` (compose projects), `/root/.claude` (personal Pro Claude auth).

## Pattern B crons — the one-paragraph model

Project code lives in `personal-stuff`; orchestration (run.sh, .env, crontab.txt) lives in the separate `vps-crons` repo. Every cron's `run.sh` starts with `git pull` of personal-stuff, so **code changes need only `git push` on the Mac**. SSH is needed in exactly 5 situations (new cron, schedule change, new pip dep, secret rotation, cron removal) — schedule/dep changes are one command: `ssh root@72.61.241.170 '/srv/crons/vps-apply.sh'`. VPS is UTC: **IST − 5:30 = UTC** (06:00 IST = `30 0 * * *`). Full runbook: `VPS-CRONS.md` — read it before any cron work; do not re-derive from this summary.

## When NOT to use this skill

- Executing a deploy end-to-end → **personal-stuff-deploy-and-operate**
- Hunting a secret/env var → **personal-stuff-config-and-secrets**
- A URL is down → **personal-stuff-debugging-playbook** then **personal-stuff-hosting-inventory**
- Managing the VPS via API (DNS, reboots, snapshots) → existing `hostinger` skill (`pp-hostinger` CLI)

## Provenance and maintenance

Re-verified 2026-07-12 against all `apps/*/wrangler.*` (incl. `apps/pinterest-landing-pages/*/`), `infra/vps-watchdog/wrangler.jsonc`, live SSH (`docker ps`: 6 containers; `crontab -l`: 7 active crons matching `VPS-CRONS.md`), and `VPS-CRONS.md`. Added timeblock (`BLOCKS_KV`) — was missing from the KV list and Worker-shape examples here. Cloudflare MCP `d1_list_databases`/`kv_list_namespaces` errored server-side (`NameError: _DEFAULT_ENV_PATH`) on 2026-07-12 — D1/KV counts rest on wrangler configs + the d1-backup cron ("all 5 D1 databases"). Re-verify:
- Worker/domain list: `grep -rn "custom_domain\|zone_name\|pattern" apps/*/wrangler.* apps/pinterest-landing-pages/*/wrangler.* infra/vps-watchdog/wrangler.jsonc`
- INFRA.md-vs-reality drift: `.claude/skills/personal-stuff-hosting-inventory/scripts/verify-inventory.sh` (the drift table lives in **personal-stuff-hosting-inventory**)
- D1/KV live state: cloudflare MCP `d1_list_databases` / `kv_list_namespaces` (fix the MCP server first if it still NameErrors)
- VPS containers: `ssh root@72.61.241.170 'docker ps --format "{{.Names}}"'`
- Crontab: `ssh root@72.61.241.170 'crontab -l'` (must match `/srv/crons/crontab.txt`)
