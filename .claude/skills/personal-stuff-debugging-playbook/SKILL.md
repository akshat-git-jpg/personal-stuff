---
name: personal-stuff-debugging-playbook
description: Use when something in personal-stuff is broken, flaky, or behaving impossibly — a UI change not showing, a domain 404ing after deploy, 401s from Claude Remote Control or Google APIs, an unreachable VPS, a cron that didn't fire, npm install 401s, a skill edit not taking effect, or MCP tools missing. Run the discriminating check BEFORE applying any fix.
---

# Debugging playbook

## Overview

These are this repo's REAL failure modes, each with the cheap check that discriminates it from lookalikes. **Run the check first** — half of these symptoms have a twin with a different cause, and the wrong fix (restarting, re-deploying, re-authing) destroys the evidence.

## Symptom → triage table

| # | Symptom | Discriminating check | Fix | Backstory |
|---|---|---|---|---|
| 1 | UI change not visible in local app (esp. tutorial-tracker-app) | Is the change visible on Vite `:5173` but not wrangler `:8787`? | `npm run build`, then **restart** `wrangler dev` — it serves stale `dist/` | Documented tracker-app gotcha; cost real time before it was written down |
| 2 | Custom domain 404/missing after a deploy of gym-app or kushal-docs | Was the deploy a bare `wrangler deploy` (not `npm run deploy`)? | Re-deploy via `npm run deploy` — `patch-routes.mjs` re-injects the routes (and kushal-docs' R2 binding) the build strips | See **cloudflare-and-vps-reference**; the Vite build strips routes from the generated `dist/<name>/wrangler.json` |
| 3 | Claude mobile / Remote Control: 401 on every message | `ssh root@72.61.241.170 'export PATH=/root/.local/bin:$PATH; claude auth status'` | `claude auth login` on the VPS (**NOT `setup-token`** — inference-only, Remote Control rejects it), restart `claude-rc.service`, start a NEW mobile session | Recorded incident + fix in project memory |
| 4 | VPS unreachable / SSH times out | Try IPv6: `ssh root@2a02:4780:12:4d02::1` — and wait 2–4 min: `infra/vps-watchdog/` auto-reboots the box when the dashboard stops answering | If IPv6 works, it's an IPv4/origin block, not a dead box | IPv4-blocked-but-IPv6-fine has happened; watchdog reboots are easy to misread as crashes |
| 5 | Claude ran with the wrong account / "personal" session sees work config | `~/.zshrc` has `alias claude='claude-work'` — a bare `claude` (even with `CLAUDE_CONFIG_DIR=...` prefixed) silently hits WORK | Use the `claude-work` / `claude-personal` shell functions; verify true MCP/config state by reading the account's `.claude.json` directly | The alias gotcha burned a debugging session before being memorialized |
| 6 | Edited a skill but sessions don't see the change (or see a deleted skill) | `./scripts/skills-status.sh` — is the symlink present/dangling? Was the session restarted? | Edit only in `tooling/claude-skills/`, run `./scripts/relink.sh`, **restart the session** — discovery is cached; trust the filesystem, not `claude -p` probing | Single-source rule in **personal-stuff-change-control** |
| 7 | MCP tools missing / wrong servers listed | `.mcp.json` is **gitignored + per-machine** — check it exists and paths are this machine's; check `enabledMcpjsonServers` in `.claude/settings.local.json` | `./scripts/regen-mcp-json.sh`, restart session | Only `google-drive` + `cloudflare` are supposed to be wired; the rest of `tooling/mcp/` is legacy (but `gmail-mcp-server` is used by the VPS digest cron — don't delete) |
| 8 | `npm install` → 401 Unauthorized | Does the failing project have its own `.npmrc`? (`cat .npmrc`) | Add a cwd-local `.npmrc` pinning the public registry — work `~/.npmrc` points at Zluri CodeArtifact | Hit repeatedly: tracker-app, HyperFrames nested projects |
| 9 | Google Sheets/Gmail/Drive auth failure | Which auth path? `pipelines/` uses the **service account** (`credentials.json` — is the Sheet shared with its `client_email` as Editor?); CLIs/MCP use **OAuth tokens** (`ls tooling/mcp/google-shared/tokens/`) | Service account: share the Sheet. OAuth: re-run `setup_auth.py <email>` on the Mac; for VPS crons, `scp` the fresh token (see `VPS-CRONS.md`) | Two different auth systems that look identical from the error message |
| 10 | YouTube transcript fetch fails / empty | Are you on a datacenter IP (VPS/CI)? | Run from the Mac — YouTube blocks datacenter IPs for `pp-yt-transcript` and `competitor-styles` ingest; same wall hits `skool` (HTTP 202) and `pinterest-research` live scrapes from the VPS. No free workaround — scraping stays on the laptop | Documented in the CLI README; yt-dlp caption path is broken, transcript API is the working route |
| 11 | HeyGen web CLI → 403 | Cookies rotate in minutes–hours | Recapture the cURL into `infra/secrets/heygen-web-curls.txt` per `tooling/cli/heygen-web/HANDOVER.md` | Session-cookie automation; also ToS-risky — keep usage light |
| 12 | Cron didn't fire or failed silently | `ssh root@72.61.241.170 'tail -50 /srv/crons/<job>/logs/cron.log'`; then `crontab -l` vs `/srv/crons/crontab.txt` (diverged = someone used `crontab -e`); then check the schedule math (VPS is **UTC**; IST − 5:30) | Re-apply `crontab /srv/crons/crontab.txt`; remember cron PATH is stripped — absolute paths / `claude-env.sh` only | All three causes have occurred; the UTC conversion is the most common |
| 13 | Python pipeline: `RuntimeError: <NAME> not set in .env` | `grep -o "^[A-Z_0-9]*" pipelines/.env` — is the key present? | Add the key (real list in **personal-stuff-config-and-secrets**); remember `common/env.py` loads `.env` relative to itself, not CWD — running from a weird dir is NOT the cause | `.env.example` is stale; rebuilds from it cause exactly this |
| 14 | Site down | `./scripts/probe-sites.sh` to scope it: one site or many? Worker or VPS-hosted (`my-dashboard`/`render2` = VPS behind Traefik; apex `agrolloo.com` = Hostinger shared hosting, NOT the VPS)? | Route by surface: Worker → redeploy/check Cloudflare; VPS → check container + Traefik | See **personal-stuff-hosting-inventory** for URL→surface mapping |
| 15 | Shell tool output looks truncated/mangled ("N matches in 0 files") | Is the `rtk` hook rewriting the command? | Re-run as `rtk proxy <original command>` for raw output | rtk is a token-optimizing proxy; `proxy` bypasses filtering |
| 16 | NotebookLM CLI auth errors | Cookies expire after weeks | Interactive `notebooklm login` (browser) | Documented in the `notebooklm` skill setup |

## Debugging discipline

- For any non-trivial bug, use the `superpowers:systematic-debugging` skill — find the root cause before fixing; these table entries are known-cause shortcuts, not permission to skip diagnosis when the symptom doesn't match exactly.
- Before any state-changing "fix" (restart, re-auth, redeploy), confirm the discriminating check actually passed — a matching symptom with a failing check means a NEW failure mode: diagnose, then add it to this table.

## When NOT to use this skill

- Nothing is broken, you're setting up fresh → **personal-stuff-build-and-env**
- Wondering whether a battle was already fought → **personal-stuff-failure-archaeology**
- Deploy procedure questions → **personal-stuff-deploy-and-operate**

## Provenance and maintenance

Entries verified against app CLAUDE.mds, `VPS-CRONS.md`, `tooling/cli/*` READMEs, scripts, and recorded incidents on 2026-07-05. Re-verify a row before relying on it if its subsystem changed:
- Row 2: `grep patch-routes apps/gym-app/package.json apps/kushal-docs/package.json`
- Row 7: `cat .mcp.json` + `tooling/mcp/README.md` STATUS banner
- Row 12: `ssh root@72.61.241.170 'crontab -l'`
- Rows 10/11: the respective README/HANDOVER under `tooling/cli/`
