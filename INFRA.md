# Infrastructure Inventory

Canonical map of what runs where. Audited 2026-06-13; Cloudflare Workers + agrolloo.com DNS re-verified 2026-06-16 (added kushal-docs, yt-analytics, render2). The single infra reference (the old `my-planner/hostinger-vps-srv1377177.md` was stale and has been removed).

Three places: **Cloudflare** (public edge), **Hostinger VPS** (always-on box), **GitHub** (source of truth; VPS pulls on every cron tick).

---

## Cloudflare

Account: `akshatpatidar17@gmail.com` (`ac525d9a38c81a18eb327571d3f76e7e`). Both zones on this one account.

### Zones
- `agrolloo.com` — main personal domain (apps + landing pages).
- `bridebestie.com` — wedding-niche brand domain.

### Workers (8 deployed, no Pages projects)
- **redirector** — `go.agrolloo.com/*` — URL shortener + click tracking. Bindings: `CLICKS_KV`, `clicks-db` (D1).
- **kushal-gym** — `kushal-gym.agrolloo.com` — gym PWA, Google Sheet-backed via OAuth refresh token.
- **kushal-docs** — `kushal-docs.agrolloo.com` — document-vault PWA, R2-backed (bucket `kushal-docs`), Google sign-in allow-listed to one email.
- **yt-tutorials-tracker** — `tutorials-tracker.agrolloo.com` — YouTube tutorials Kanban app; also mints go.agrolloo.com short links. Bindings: `SESSIONS` (KV), `CLICKS_KV`, `clicks-db` (D1).
- **yt-analytics** — `yt-analytics.agrolloo.com` — read-only click dashboard (per-video/per-link counts) over `clicks-db`. Shared-password gate (stateless signed cookie, no KV). Binding: `clicks-db` (D1, read-only).
- **keto-kitchen** — `keto-kitchen.agrolloo.com` — static landing page (assets-only).
- **bridebestie** — `bridebestie.com` + `www` — static landing page (assets-only).
- **vps-watchdog** — cron `*/2 * * * *`, no HTTP route — pings the dashboard; reboots VPS via Hostinger API if down. Binding: `WATCHDOG_KV`.

### KV namespaces (3)
- `WATCHDOG_KV` — vps-watchdog state.
- `CLICKS_KV` — redirector clicks.
- `SESSIONS` — tutorials-tracker logins.

### D1 databases (1)
- `clicks-db` — redirector click store. Written by redirector + yt-tutorials-tracker; read by yt-analytics (read-only) and by `yt-analysis/sync_clicks.py`.

### DNS — agrolloo.com
- `agrolloo.com` + `www` → `191.101.230.133` (Hostinger shared hosting, proxied) — NOT the VPS, NOT a Worker.
- `my-dashboard.agrolloo.com` → `72.61.241.170` (VPS, proxied) — personal-dashboard container via Traefik.
- `render2.agrolloo.com` → `72.61.241.170` (VPS, proxied) — Hyperframes → MP4 renderer behind Traefik (added after the 2026-06-13 audit).
- `go` / `keto-kitchen` / `kushal-gym` / `kushal-docs` / `tutorials-tracker` / `yt-analytics` → the 6 routed Workers above (custom domains show as proxied `AAAA 100::`).
- `ftp.agrolloo.com` → `191.101.230.133` (Hostinger hosting).
- MX + `autoconfig` / `autodiscover` / DKIM → Hostinger mail.
- `send.notifications.agrolloo.com` + `resend._domainkey` → Amazon SES / Resend (transactional email sending).

### DNS — bridebestie.com
- apex + `www` → `bridebestie` Worker.
- MX → Cloudflare Email Routing (`route1/2/3.mx.cloudflare.net`) → forwards `hello@bridebestie.com` to hub Gmail.
- SPF + DKIM (`cf2024`) for Cloudflare email.

---

## Hostinger VPS

- Host: `srv1377177.hstgr.cloud` / `72.61.241.170` (IPv6 `2a02:4780:12:4d02::1`).
- Plan: KVM 2 — 2 vCPU, 8 GB RAM, 100 GB disk. OS: Ubuntu 24.04 LTS. Timezone: **UTC**.
- Disk ~19% used. **No swap.**
- SSH: key-only (`ssh -i ~/.ssh/hostinger_vps root@72.61.241.170`). Firewall `kb-vps-default`: inbound 22/80/443 only.
- Claude auth on box: `kushalbakliwal25@gmail.com` (Pro). Weekly Hostinger backups.

### Docker containers (5, all up)
- **n8n-traefik-1** (traefik) — reverse proxy + Let's Encrypt TLS; the box's public edge. Ports `:80`, `:443`.
- **n8n-n8n-1** (n8nio/n8n) — workflow automation. Internal `:5678`.
- **personal-dashboard** (local build) — mobile dashboard PWA at `my-dashboard.agrolloo.com`. Internal `:8787`.
- **minio** (minio) — S3-style asset storage. **Loopback only** `:9000/9001`.
- **ntfy** (ntfy) — push-notification server. **Public `:8888`, no TLS.**

### Cron jobs (Pattern B; canonical `/srv/crons/crontab.txt`)
- `06:00 IST` (`30 0 * * *` UTC) → `my-planner` — Calendar + workout digest → Telegram.
- `06:00 IST` (`30 0 * * *` UTC) → `gmail-digest` — Gmail summary → Telegram.
- Every 15 min (`*/15 * * * *`) → `repo-sync` — pull personal-stuff + relink Claude skills so interactive Claude (Remote Control / mobile) stays current.
- Stock: daily Docker image prune (`8 0 * * *`), certbot renewal, sysstat.

### Key paths
- `/srv/projects/personal-stuff` — code clone (read-only deploy key).
- `/srv/crons` — cron orchestration (read-write deploy key).
- `/docker/{n8n,minio,personal-dashboard}` — compose projects.

### Services
- `claude-rc.service` — Claude Code Remote Control (personal Pro).
- `fail2ban` — active.

---

## Cleanup / confirm

- [x] Removed stale nginx vhost `n8n-website` (sites-enabled + sites-available). Backup: `/root/cleanup-backup-20260613/`. nginx still disabled.
- [x] Decommissioned Hermes entirely on 2026-06-14 — removed the `hermes` + `hermes-dashboard` containers, the `nousresearch/hermes-agent` image (~4.8GB), `/docker/hermes`, and `/root/.hermes`.
- ntfy public on `:8888` HTTP is **by design** — `docker/ntfy/README.md` threat model is "topic name = the secret" (keeps payloads off public ntfy.sh). No action.
- [x] Purged nginx entirely (`nginx`, `nginx-common`, `python3-certbot-nginx`); `/etc/nginx` removed. Traefik still owns 80/443; dashboard + n8n verified 200.
- `send.notifications.agrolloo.com` + `resend._domainkey` DNS — **kept** (no app in this repo, but may be used externally). Revisit if confirmed unused.
- Swap — **left off** by choice. Watch if n8n + MinIO spike together.
