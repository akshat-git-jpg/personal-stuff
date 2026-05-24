# Hostinger VPS — srv1377177 — Inventory & Access

> **Generated:** 2026-05-22 · Source: Hostinger API (MCP) + live SSH inspection
>
> ⚠️ **SECURITY:** The root password is **not** in this file. It lives in
> `secrets/hostinger-vps.env` at the repo root (gitignored, never committed).
> As of 2026-05-24 the box is **SSH key-only** and the password was **rotated**
> (see Section 2); the password is now only for the hPanel browser console /
> emergency recovery.
> See Sections 8–9 for the daily-digest deployment and the full hardening changelog.

---

## 1. VPS Overview

| Field | Value |
|---|---|
| Hostname | `srv1377177.hstgr.cloud` |
| VM ID | `1377177` |
| Subscription ID | `Azytg5VBDMXG15Js0` |
| State | running |
| Plan | KVM 2 — 2 vCPU, 8 GB RAM, 100 GB disk |
| Bandwidth | 8 TB |
| Data center | ID 13 |
| OS / Template | Ubuntu 24.04.4 LTS (template "Ubuntu 24.04 with n8n", id 1153), kernel 6.8.0-110-generic |
| Created | 2026-02-14 |
| Firewall | `kb-vps-default` (id `297364`) — attached 2026-05-24. Inbound allow TCP 22/80/443 only; all other inbound dropped; outbound unrestricted. See Section 8. |
| IPv4 | `72.61.241.170` (PTR `srv1377177.hstgr.cloud`) |
| IPv6 | `2a02:4780:12:4d02::1` |
| Nameservers | ns1 `153.92.2.6`, ns2 `1.1.1.1` |

---

## 2. Access / Credentials

> **HARDENED 2026-05-24 (Claude Code). SSH is now KEY-ONLY — password login is disabled.
> Just use the key command below; there is nothing to type or remember.**

### How to connect (current method — SSH key only)
```bash
ssh -i ~/.ssh/hostinger_vps root@72.61.241.170
```
- Private key is on this Mac at `~/.ssh/hostinger_vps` (public key name `claude-code-mac-20260522`).
- The public key is now installed in `/root/.ssh/authorized_keys` on the **running** box (2026-05-24) — it is LIVE, no recreate needed.
- Hardening drop-in `/etc/ssh/sshd_config.d/00-hardening.conf` sets `PasswordAuthentication no` + `PermitRootLogin prohibit-password` (sorts before `50-cloud-init.conf`, so it wins). Password SSH login is refused.

### Root password (ROTATED 2026-05-24)

The current password is stored in `secrets/hostinger-vps.env` at the repo root
(gitignored). To retrieve:

```bash
grep '^ROOT_PASSWORD=' "$(git rev-parse --show-toplevel)/secrets/hostinger-vps.env" | cut -d= -f2-
```

- Rotated via `chpasswd` on 2026-05-24. The old password is now **DEAD**.
- This password is **only** for the Hostinger hPanel browser console / emergency — it does **not** work for SSH (password auth disabled).
- **Lost the SSH key?** Recover via Hostinger hPanel → this VM → Browser terminal (uses the password from the env file), or hPanel "Reset root password". You're never permanently locked out.

### Hostinger SSH key record
| Field | Value |
|---|---|
| Private key (this Mac) | `~/.ssh/hostinger_vps` |
| Public key | `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOqFb4bO30tdvJZSRlK1spFM4CiPM4Xwo2+JEb0cXJ3I claude-code-mac-20260522` |
| Hostinger key name | `claude-code-mac-20260522` |
| Hostinger key ID | `508450` |
| Status | **LIVE** — installed directly into `/root/.ssh/authorized_keys` on the running box (2026-05-24). Also attached in Hostinger for any future recreate. |

---

## 3. What's running — Docker

One Docker Compose project: **`n8n`** at `/docker/n8n/docker-compose.yml` (working dir `/docker/n8n`).

| Container | Image | Role | Ports | Status |
|---|---|---|---|---|
| `n8n-n8n-1` | `docker.n8n.io/n8nio/n8n` | n8n app | 5678 (internal only) | Up ~3 weeks |
| `n8n-traefik-1` | `traefik` v3.6.8 | Reverse proxy + Let's Encrypt TLS | 80, 443 (public) | Up ~3 weeks |

- **n8n URL:** `https://n8n.srv1377177.hstgr.cloud/` (Traefik router rule `Host(n8n.srv1377177.hstgr.cloud)`, TLS via ACME `mytlschallenge`).
- Traefik provider config: `--providers.docker=true --providers.docker.exposedbydefault=false`
  → it only routes to containers labeled `traefik.enable=true`. Currently **only n8n** is labeled.
- HTTP (`:80`) redirects to HTTPS (`:443`). No file provider; no catch-all router.
- Volumes: `n8n_data` (external), `traefik_data` (external, holds `/letsencrypt/acme.json`), host `/local-files` → `/files`.

---

## 4. What's running — outside Docker

### Custom project: `n8n-website` — ✅ REMOVED 2026-05-22

This project was decommissioned at the user's request (it was broken and unwanted). For the
historical record, what it had been:

- **VPS clone:** `/var/www/n8n-website`, remote `https://github.com/akshat-git-jpg/n8n-website.git`.
- **Standalone GitHub repo:** **did not exist** — `gh` under the owning account (`akshat-git-jpg`)
  returned "Could not resolve to a Repository". This is also why the cron pull failed
  (`fatal: could not read Username` — GitHub returns the same for a missing private repo).
- **Real source:** the content (`CLAUDE.md` + `index.html`, a Tailwind-CDN "coming soon" page)
  lived as the `n8n-website/` folder inside the `akshat-git-jpg/TY` repo
  (`/Users/kbtg/codebase/TY`), not as a standalone repo.
- **Deploy mechanism:** two near-duplicate root cron lines pulling every minute (both failing).
- **Serving:** nothing served it (no web container, no Traefik route).

**Removal actions performed:**
- VPS: deleted `/var/www/n8n-website`, removed both cron lines, deleted `/var/log/git-deploy.log`.
  (`/var/www` now contains only the default `html`; no active cron jobs remain.)
- GitHub + local: `git rm -r n8n-website/` in `TY`, committed (`150cf56`, scoped to that folder
  only — unrelated working-tree changes were left untouched) and pushed to `akshat-git-jpg/TY` main.
- The local folder `/Users/kbtg/codebase/TY/n8n-website` is gone (removed from the working tree).

### System-level scheduled jobs / services (beyond stock OS)
| Item | What it does |
|---|---|
| `certbot.timer` + `/etc/cron.d/certbot` | Let's Encrypt cert renewal, twice daily (system-level; note Traefik also does its own ACME) |
| `/etc/cron.d/docker-image-prune` | `8 0 * * * root docker image prune -af --filter "until=24h"` — daily image cleanup |
| `sysstat` timers | `sar` performance metrics collection |

Listening ports outside Docker: **sshd** `0.0.0.0:22` + **systemd-resolved** `127.0.0.53/54:53`.
Everything else (`qemu-guest-agent`, `unattended-upgrades`, `snapd`, `cron`, `rsyslog`,
`ModemManager`, etc.) is stock Ubuntu/VM service, not a user project.

---

## 5. Backups

- Automatic weekly backups via Hostinger (`backup_create` actions succeed weekly).
- Most recent backups (action timestamps): 2026-05-18, 2026-05-11, 2026-05-04, 2026-04-27 …
  (weekly cadence back to 2026-02-22).

---

## 6. Hostinger artifacts created in this session

| Action | Detail |
|---|---|
| SSH public key registered | `VPS_createPublicKeyV1` → key id `508450` (`claude-code-mac-20260522`) |
| SSH key attached to VM | `VPS_attachPublicKeyV1` (applies only on recreate) |
| Root password reset | `VPS_setRootPasswordV1` → action `95360070` (success) |

---

## 7. `n8n-website` — RESOLVED (removed)

The project was removed entirely on 2026-05-22 rather than repaired — see Section 4 for the
full removal record. No further action pending.

---

## 8. Daily Calendar Digest — deployed to this VPS 2026-05-24

The "Good morning" Google Calendar → Telegram digest now runs from THIS VPS via cron, because
GitHub Actions' scheduled cron was firing 3–5 hours late (and skipping days). Source repo is
still `akshat-git-jpg/kb-daily-planner` (private); the VPS copy was deployed by scp from the
local Mac working copy (`tools/google-calendar-telegram/`), not a git pull.

| Item | Value |
|---|---|
| Location | `/opt/kb-daily-planner/` (perms `700`; secrets `token.json`/`credentials.json`/`config.py` are `600`) |
| Python | system `python3` (3.12) + venv at `/opt/kb-daily-planner/.venv` |
| Entry | `run.sh` → `.venv/bin/python notifier.py` (cd's into dir; logs a timestamped header) |
| Cron (root) | `30 0 * * * /opt/kb-daily-planner/run.sh >> /var/log/kb-daily-planner.log 2>&1` |
| Schedule | `30 0` UTC = **06:00 IST** (VPS clock is UTC; IST has no DST, so this is stable) |
| Log | `/var/log/kb-daily-planner.log` |
| Fonts | `fonts-dejavu-core` installed (renderer loads `/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`) |

**Run it manually / check logs:**
```bash
ssh -i ~/.ssh/hostinger_vps root@72.61.241.170 '/opt/kb-daily-planner/run.sh'   # send now
ssh -i ~/.ssh/hostinger_vps root@72.61.241.170 'tail -30 /var/log/kb-daily-planner.log'
```

**PENDING (as of 2026-05-24):** GitHub Actions `schedule:` trigger in
`tools/google-calendar-telegram/.github/workflows/daily-digest.yml` is still ON as a fallback.
Once the VPS cron is confirmed firing at 6 AM IST (morning of 2026-05-25), remove the
`schedule:` trigger (keep `workflow_dispatch`) so you don't get duplicate digests.

**Low-priority note:** `config.py` (tracked in the private repo) hardcodes the Telegram bot
token as a default. It's only exposed to your own private GitHub repo, so low risk. If you ever
make the repo public, rotate the bot token via BotFather first.

### Firewall `kb-vps-default` (id 297364)
| Rule | Protocol | Port | Source |
|---|---|---|---|
| SSH | TCP | 22 | any |
| HTTP | TCP | 80 | any (n8n/Traefik) |
| HTTPS | TCP | 443 | any (n8n/Traefik) |

Default action = drop all other inbound. Outbound is unrestricted and stateful (verified: the
digest reaches Google + Telegram, n8n still serves). To roll back: Hostinger API
`VPS_deactivateFirewallV1(firewallId=297364, virtualMachineId=1377177)`.

---

## 9. Security hardening changelog — 2026-05-24 (Claude Code)

1. **SSH key-only.** Installed the Mac's public key into `/root/.ssh/authorized_keys`; added
   `/etc/ssh/sshd_config.d/00-hardening.conf` (`PasswordAuthentication no`,
   `PermitRootLogin prohibit-password`); restarted ssh. Verified key login works + password login refused.
2. **Root password rotated** via `chpasswd` (old plaintext password is dead). New one in Section 2 — for hPanel/emergency only.
3. **Firewall attached** (`kb-vps-default`, id 297364): inbound 22/80/443 only. Verified SSH, outbound, and n8n all still work.
4. **Auto security updates** confirmed on (`unattended-upgrades` enabled + active; `apt-daily-upgrade.timer` active).
5. Digest secret files set to `600`.
