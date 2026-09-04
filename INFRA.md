# Infrastructure Inventory

Canonical map of what runs where. Audited 2026-06-13; Cloudflare Workers + agrolloo.com DNS re-verified 2026-06-16 (added kushal-docs, yt-analytics, render2, kushal-tools). Drift repaired 2026-07-12 against `apps/*/wrangler.*`, `VPS-CRONS.md`, and a live VPS check (added founders-tracker, timeblock, 3 D1 databases, `BLOCKS_KV`, 4 crons, hyperframes-render container). The single infra reference (the old `my-planner/hostinger-vps-srv1377177.md` was stale and has been removed).

Three places: **Cloudflare** (public edge), **Hostinger VPS** (always-on box), **GitHub** (source of truth; VPS pulls on every cron tick).

---

## Cloudflare

Account: `akshatpatidar17@gmail.com` (`ac525d9a38c81a18eb327571d3f76e7e`). Both zones on this one account.

### Zones
- `agrolloo.com` — main personal domain (apps + landing pages).
- `bridebestie.com` — wedding-niche brand domain.

### Domain renewals — check before each date

| Domain | Registrar | Expires | Decision |
|---|---|---|---|
| `agrolloo.com` | Hostinger | **2026-11-10** | **RENEW.** Load-bearing: every live app and the `go.agrolloo.com` money path sit on it. Losing it takes down all of it and breaks every affiliate short link already published in YouTube descriptions. **Auto-renew state is UNKNOWN from here** — see the caveat below. |
| `bridebestie.com` | Cloudflare | **2027-06-02** | **Let it lapse** (owner, 2026-08-30) — the wedding/Pinterest bet is abandoned and the year was paid up front. `auto_renew` is already **false** (verified 2026-08-30 via the Registrar API), so no action is needed; it expires on its own. |

Every subdomain (`go.`, `kushal-tools.`, …) is free; only these two registrations cost money.
Re-read live state rather than trusting this table, and update it when a renewal happens:

```bash
whois <domain> | grep -i "Registry Expiry"        # expiry, any registrar
# Cloudflare Registrar auto-renew (needs the GLOBAL key; the scoped CF_API_TOKEN 403s here):
curl -s "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/registrar/domains/<domain>"   -H "X-Auth-Email: $CF_API_EMAIL" -H "X-Auth-Key: $CF_GLOBAL_API_KEY"
```

**`agrolloo.com` is NOT visible to the Hostinger API token in `tooling/mcp/hostinger/.env`.**
`GET /api/domains/v1/portfolio/agrolloo.com` returns *"Domain is not registered at Hostinger"*
and the portfolio lists only an unused free-domain slot — yet `whois` says the registrar is
HOSTINGER operations, UAB (IANA 1636). The domain therefore sits in a **different Hostinger
login** from the one this token belongs to; that account holds only the VPS. Its auto-renew and
its card can only be checked by signing in to the right account at `hpanel.hostinger.com`.

**Retiring the second account was investigated and PARKED** (2026-08-30) — the full
findings, per-account inventory, email options with prices, and the safe migration
sequence live in [`plans/260-close-hostinger-web-account.md`](plans/260-close-hostinger-web-account.md).
Read that before re-opening the topic. Two recurring deadlines if it is ever resumed:
the hosting renews **10-27** and the domain **10-14**, every year.

The token's own account (VPS only), read 2026-08-30: subscription **KVM 2**, ₹16,788/year,
`is_auto_renewed: true`, next billing **2027-01-31**; default Visa card on file, not expired
(good to 2032-09-30).

### Workers (14 deployed, no Pages projects)
- **redirector** — `go.agrolloo.com/*` — URL shortener + click tracking. Bindings: `CLICKS_KV`, `clicks-db` (D1).
- **kushal-tools** — `kushal-tools.agrolloo.com` — KushalTools hub: card launcher linking every live agrolloo.com site. Shared-password gate (stateless signed cookie, no KV). Secrets: `APP_PASSWORD`, `SESSION_SECRET`. No bindings.
- **kushal-gym** — `kushal-gym.agrolloo.com` — gym PWA, Google Sheet-backed via OAuth refresh token.
- **kushal-docs** — `kushal-docs.agrolloo.com` — document-vault PWA, R2-backed (bucket `kushal-docs`), Google sign-in allow-listed to one email.
- **yt-tutorials-tracker** — `tutorials-tracker.agrolloo.com` — YouTube tutorials Kanban app; also mints go.agrolloo.com short links. Bindings: `SESSIONS` (KV), `CLICKS_KV`, `clicks-db` (D1).
- **yt-income** — `yt-income.agrolloo.com` — revenue dashboard: affiliate income by month and by tool, every figure tallied against bank credits, with an explicit Untraced row for money that arrived but cannot be attributed. Shared-password gate (stateless signed cookie). **No bindings and no upstream API keys** — the figures are a build-time snapshot of `pipelines/income-analysis/summary.json`, copied in by `scripts/sync-summary.mjs`, so the Worker never holds a PayPal, impact.com or PartnerStack credential. Refreshed by the `yt-income` skill, not on a schedule (half the income only exists in a hand-exported bank passbook). Secrets: `APP_PASSWORD`, `SESSION_SECRET`.
- **yt-analytics** — `yt-analytics.agrolloo.com` — click dashboard (per-video/per-link counts) over `clicks-db`, plus **live YouTube view counts** fetched from the YouTube Data API per load. Shared-password gate (stateless signed cookie, no KV). Binding: `clicks-db` (D1, read-only). Secrets: `APP_PASSWORD`, `SESSION_SECRET`, `YT_API_KEY` (YouTube Data API v3 key, project `n8n-workflows-454504`).
- **lists-app** — `lists.agrolloo.com` — personal categorized-lists app (SPA). Shared-password gate (stateless signed cookie, no KV). Bindings: `ASSETS` (SPA in `dist/`), `DB` (D1 `lists-db`). Secrets: `APP_PASSWORD`, `SESSION_SECRET`.
- **founders-tracker** — `founders.agrolloo.com` — founders/CRM tracker SPA. Bindings: `ASSETS`, `DB` (D1 `founders-db`). Worker cron `35 18 * * *`. Secrets: `APP_PIN`, `SESSION_SECRET`.
- **timeblock** — `timeblock.agrolloo.com` — tap-to-block day planner. Shared-password gate (stateless signed cookie, no KV sessions). Bindings: `ASSETS`, `BLOCKS_KV` (KV, one JSON blob per day). Secrets: `APP_PASSWORD`, `SESSION_SECRET`.
- **closet-app** — `closet.agrolloo.com` — wear counter + tagged outfit gallery PWA (two tabs: Clothes = raw wears-since-wash per garment, Looks = tagged outfit photos). Shared-password gate (stateless signed cookie, no KV). Bindings: `ASSETS` (SPA in `dist/`), `DB` (D1 `closet-db`), `PHOTOS` (R2 `closet-photos`). Secrets: `APP_PASSWORD`, `SESSION_SECRET`. Deployed 2026-08-17.
- **yt-script-desk** — `https://script-desk.agrolloo.com` — access is a per-video secret link; there is no login. Binding: `DESK_DB` (D1 `script-desk-db`). Secret: `DESK_ADMIN_TOKEN`.
- **bridebestie** — `bridebestie.com` + `www` — static landing page (assets-only).
- **vps-watchdog** — cron `*/2 * * * *`, no HTTP route — pings the dashboard; reboots VPS via Hostinger API if down. Binding: `WATCHDOG_KV`.

### KV namespaces (4)
- `WATCHDOG_KV` — vps-watchdog state.
- `CLICKS_KV` — redirector clicks.
- `SESSIONS` — tutorials-tracker logins.
- `BLOCKS_KV` — timeblock day blobs (key `day:YYYY-MM-DD`).

### D1 databases (6)
- `lists-db` — lists-app data store (categories + items). Bound as `DB` in lists-app only.
- `clicks-db` — redirector click store. Written by redirector + yt-tutorials-tracker; read by yt-analytics (read-only) and by `pipelines/youtube/yt-analysis/sync_clicks.py`. `videos` has an additive `yt_video_id` column (migration `0002`, owned by the redirector) so yt-analytics can look up YouTube views. All 65 uploaded `@AgrolloReviews` videos were backfilled here (per-video tracking links `go.agrolloo.com/<code>/<tool>`) on 2026-06-16.
- `tracker-db` — yt-tutorials-tracker app data (second D1 binding alongside `clicks-db`).
- `founders-db` — founders-tracker data store. Bound as `DB` in founders-tracker only.
- `yt-rankings` — YouTube rankings data, bound in yt-analytics (second D1 binding alongside read-only `clicks-db`).
  (yt-income has **no** database — its figures are baked into the Worker bundle at build time.)
- `closet-db` — closet-app data (`clothes`, `looks`, `tags`, `item_tags`, `events`). Bound as `DB` in closet-app only. Id `f454ff38-7ed8-4903-923e-bab70a96d54a` (region APAC). The `events` table is the wear/wash log that powers Undo — do not derive counts from it, `clothes.wears` is the live value.

### R2 buckets (2)
- `kushal-docs` — kushal-docs document vault.
- `closet-photos` — closet-app garment + outfit thumbnails (client-downscaled JPEGs, ≤400 KB, UUID keys). Bound as `PHOTOS`. Objects are deleted when their cloth/look is deleted or its photo replaced.

### DNS — agrolloo.com
- `agrolloo.com` + `www` → `191.101.230.133` (Hostinger shared hosting, proxied) — NOT the VPS, NOT a Worker.
- `my-dashboard.agrolloo.com` → `72.61.241.170` (VPS, proxied) — personal-dashboard container via Traefik.
- `render2.agrolloo.com` → `72.61.241.170` (VPS, proxied) — Hyperframes → MP4 renderer behind Traefik (added after the 2026-06-13 audit).
- `go` / `kushal-gym` / `kushal-docs` / `tutorials-tracker` / `yt-analytics` / `kushal-tools` / `lists` / `founders` / `timeblock` / `vo` / `closet` → the 11 routed Workers above (custom domains show as proxied `AAAA 100::`).
- `ftp.agrolloo.com` → `191.101.230.133` (Hostinger hosting).
- MX + `autoconfig` / `autodiscover` / DKIM → Hostinger mail.
- `send.notifications.agrolloo.com` + `resend._domainkey` → Amazon SES / Resend (transactional email sending).

### DNS — bridebestie.com
- apex + `www` → `bridebestie` Worker.
- MX → Cloudflare Email Routing (`route1/2/3.mx.cloudflare.net`) → forwards `hello@bridebestie.com` to hub Gmail.
- SPF + DKIM (`cf2024`) for Cloudflare email.

---

## Affiliate mailboxes (agrolloo.com)

`agrolloo.com` mail is Hostinger's own (`mx1/mx2.hostinger.com`), **not** Gmail, so
`pp-gmail` cannot read it. Two mailboxes carry every affiliate commission and payout
notice: `khushibakliwal@agrolloo.com` and `kushalbakliwal@agrolloo.com`, 1 GB each.

Two consumers, one credential, two copies:

| Consumer | Where the password lives |
|---|---|
| gmail-digest cron (Telegram digest) | `/srv/crons/gmail-digest/.env` on the VPS |
| `pipelines/income-analysis/mailbox.py` (yt-income tally) | `infra/secrets/hostinger-mail.env` (gitignored, chmod 600) |

⚠️ These are **mailbox passwords, not scoped tokens** — they can send as well as read.
Rotate in Hostinger webmail, then update **both** locations or one consumer breaks
silently. Account config (hosts, ports, env-var names, no secrets) is committed at
`apps/telegram-email-assistant/imap-accounts.json`.

## Hostinger VPS

- Host: `srv1377177.hstgr.cloud` / `72.61.241.170` (IPv6 `2a02:4780:12:4d02::1`).
- Plan: KVM 2 — 2 vCPU, 8 GB RAM, 100 GB disk. OS: Ubuntu 24.04 LTS. Timezone: **UTC**.
- Disk ~19% used. **No swap.**
- SSH: key-only (`ssh -i ~/.ssh/hostinger_vps root@72.61.241.170`). Firewall `kb-vps-default`: inbound 22/80/443 only.
- Claude auth on box: `kushalbakliwal25@gmail.com` (Pro). Weekly Hostinger backups.
- **Recovery posture (checked 2026-08-30).** Three layers, and they are not equivalent:
  1. **Hostinger weekly backup** — the real disaster-recovery layer for the whole box.
  2. **Hostinger snapshot** — one slot, overwritten on create, and it **expires after
     24 hours**. Restore takes ~30 min. Treat it as a pre-change undo button, NOT as a
     backup: take one immediately before risky work, do not rely on one being there.
  3. **D1 dumps in R2** (`d1-backups`) — the only copy that survives losing the VPS.
     Data only, no box config; rebuilding the VPS is a separate job.

### Docker containers (5, all up — verified via `docker ps` 2026-08-30)
- **n8n-traefik-1** (traefik) — reverse proxy + Let's Encrypt TLS; the box's public edge. Ports `:80`, `:443`.
- **n8n-n8n-1** (n8nio/n8n) — workflow automation. Internal `:5678`.
- **personal-dashboard** (local build) — mobile dashboard PWA at `my-dashboard.agrolloo.com`. Internal `:8787`.
- **hyperframes-render** (local build) — Hyperframes → MP4 renderer at `render2.agrolloo.com`, behind Traefik.
- **minio** (minio) — S3-style asset storage. **Loopback only** `:9000/9001` (reach via SSH tunnel).

### Cron jobs (Pattern B; canonical `/srv/crons/crontab.txt`)
- `06:00 IST` (`30 0 * * *` UTC) → `my-planner` — Calendar + workout digest → Telegram.
- `06:00 IST` (`30 0 * * *` UTC) → `gmail-digest` — Gmail summary → Telegram.
- Every 15 min (`*/15 * * * *`) → `repo-sync` — pull personal-stuff + relink Claude skills so interactive Claude (Remote Control / mobile) stays current.
- `01:00 IST` (`30 19 * * *` UTC) → `d1-backup` — nightly export of all 6 D1 databases,
  written to MinIO on this box **and** copied offsite to the Cloudflare R2 bucket
  `d1-backups` (added 2026-08-30 — MinIO lives on the VPS it backs up, so a box loss
  used to take the dumps with it). 30-day retention on MinIO; R2 keeps everything.
- Hourly (`15 * * * *`) → `site-probe` — curls every URL in `my-hosted-sites.md`; Telegram on DOWN.
- `05:00 IST` (`30 23 * * *` UTC) → `cred-probe` — credential/auth health probe → Telegram.
- Sunday `08:00 IST` (`30 2 * * 0` UTC) → `route-audit` — weekly read-only routing audit (autonomy pilot, report-only).
- Stock: daily Docker image prune (`8 0 * * *`), certbot renewal, sysstat.
- Details for every cron: `VPS-CRONS.md` "Active crons" (that file stays the cron runbook of record).

### Key paths
- `/srv/projects/personal-stuff` — code clone (read-only deploy key).
- `/srv/crons` — cron orchestration (read-write deploy key).
- `/docker/{n8n,minio,personal-dashboard}` — compose projects.

### Services
- `claude-rc.service` — Claude Code Remote Control (personal Pro).
- `fail2ban` — active.

---

## Git push chokepoint (`pp-push`)

This repo is **PUBLIC** and `main` has **no branch protection**, so any push is an
irreversible publish. `.gitignore` is not a sufficient last line of defence: a rule
pointing at a moved directory matched nothing for months, and `boss-commit-main.sh`'s
`git add -A` has misfired twice on that class (once ~200 MB of `.mp4`/`.mov`).

- **Every push goes through `pp-push`.** It refuses a commit range containing a
  secret-shaped path (`.env`, `*.pem`, `credentials.json`, `.dev.vars`, …) or a file over
  1 MB, and it holds its own lock so two landings cannot race. Source of truth:
  `tooling/cli/pp-push/pp-push`; harness: `tooling/cli/pp-push/test-pp-push.sh`.
- **It is installed as a COPY at `~/.local/libexec/pp-push`**, deliberately *not* a
  symlink into the checkout like the CLIs in `scripts/link-clis.sh`. A symlinked gate is
  editable by the branches it guards and vanishes on a checkout of an older commit. The
  installed copy refuses to run from inside a working tree, and verifies itself against
  `~/.local/libexec/pp-push.sha256` recorded at install time.
- **`scripts/lib/guard-install.sh` installs it**, sourced and called by **both**
  `scripts/relink.sh` (Mac) and `scripts/vps-sync.sh` (VPS 15-min cron). Run
  `scripts/relink.sh` after pulling a change to the gate.
- **`core.hooksPath` is deliberately UNSET and must stay unset.** It used to point at a
  path containing a space (`.../personal stuff/.git/hooks`), so no git hook in this repo
  had ever run. The pointer lives in `.git/config`, which is per-clone and untracked, so
  a tracked `.githooks/` directory would carry the scripts but never the pointer. With it
  unset, git's default lookup finds the shared `.git/hooks`, which fires from the main
  worktree **and** from every linked worktree.
- **The `pre-push` net lives in the shared `.git/hooks`, untracked by design.** It
  refuses any push that did not come through `pp-push`. If that is ever too blunt for a
  legitimate manual push, call `pp-push --repo <worktree> origin <refspec>` — do not
  weaken the net.

The three former bare pushers now all call the gate: `tooling/cli/greenlight/greenlight`
(the real lander), `tooling/boss/bin/boss-commit-main.sh` (which also gained a
`BOSS_COMMIT_MAIN_MAX` blast-radius refusal, default 10 paths) and
`tooling/boss/bin/boss-merge.sh` (the `plans/README.md` registry push).

---

## Cleanup / confirm

- [x] Removed stale nginx vhost `n8n-website` (sites-enabled + sites-available). Backup: `/root/cleanup-backup-20260613/`. nginx still disabled.
- [x] Decommissioned Hermes entirely on 2026-06-14 — removed the `hermes` + `hermes-dashboard` containers, the `nousresearch/hermes-agent` image (~4.8GB), `/docker/hermes`, and `/root/.hermes`.
- ntfy is **retired** (2026-08-30). It ran public on `:8888` with `auth-default-access: read-write`, so the old "topic name = the secret" threat model gave anyone who ever saw a topic name permanent read AND write. It also had 0 subscribers, so the fallback delivered nothing. Container removed, port closed; Telegram is the only notification channel. See decisions.md 2026-08-30.
- [x] Purged nginx entirely (`nginx`, `nginx-common`, `python3-certbot-nginx`); `/etc/nginx` removed. Traefik still owns 80/443; dashboard + n8n verified 200.
- `send.notifications.agrolloo.com` + `resend._domainkey` DNS — **kept** (no app in this repo, but may be used externally). Revisit if confirmed unused.
- Swap — **left off** by choice. Watch if n8n + MinIO spike together.
