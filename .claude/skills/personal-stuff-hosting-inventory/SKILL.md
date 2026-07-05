---
name: personal-stuff-hosting-inventory
description: Use when answering anything about personal-stuff's live URLs — what's deployed where, which folder serves a domain, whether a site is up, what auth gates it, adding or retiring a public surface, or reconciling my-hosted-sites.md / INFRA.md / the kushal-tools hub when they disagree.
---

# Hosting inventory

## Overview

`my-hosted-sites.md` (repo root) is the canonical flat list of live URLs — `probe-sites.sh` literally parses it. This skill adds the URL→folder→surface→auth mapping and the update discipline that keeps the three inventory surfaces honest.

## Live surface map (as of 2026-07-05)

| URL | Repo folder | Surface | Auth |
|---|---|---|---|
| kushal-tools.agrolloo.com | `apps/kushal-tools/` | Worker (no build) | password, HMAC cookie |
| kushal-gym.agrolloo.com | `apps/gym-app/` | Worker (SPA) | **none** (obscure URL, deliberate) |
| kushal-docs.agrolloo.com | `apps/kushal-docs/` | Worker (SPA) + R2 | Google OAuth, single allow-listed email |
| tutorials-tracker.agrolloo.com | `apps/tutorial-tracker-app/` | Worker (SPA) + KV + 2×D1 | Google OAuth → role in D1 |
| yt-analytics.agrolloo.com | `apps/analytics-app/` | Worker (SPA) + 2×D1 | password, HMAC cookie |
| founders.agrolloo.com | `apps/founders-tracker/` | Worker (SPA) + D1 + cron `35 18 * * *` | PIN, HMAC token — non-expiring, no revocation: open security finding **SEC-05** in `plans/README.md` (deferred, NOT settled design) |
| lists.agrolloo.com | `apps/lists-app/` | Worker (SPA) + D1 | password, HMAC cookie |
| go.agrolloo.com | `apps/redirector/` | Worker (zone route `/*`) + KV + D1 | public by design |
| keto-kitchen.agrolloo.com | `apps/pinterest-landing-pages/keto-kitchen/` | assets-only Worker | public |
| bridebestie.com (+www) | `apps/pinterest-landing-pages/bridebestie/` | assets-only Worker, own zone | public |
| my-dashboard.agrolloo.com | `apps/personal-dashboard/` | **VPS Docker** behind Traefik | password (hash self-heals into DB) |
| render2.agrolloo.com | `apps/hyperframes-render/` | **VPS Docker** behind Traefik | password |
| localhost:4319 | `tooling/cli/ccusage-dashboard/` | local only (`ccu-dash`) | n/a |

Not URLs but public surface: `agrolloo.com` apex + `www` → Hostinger **shared hosting** (`191.101.230.133`), not this repo; ntfy on VPS `:8888` (plain HTTP, topic-name-as-secret); `infra/vps-watchdog/` Worker (cron-only, no route).

## Confirming a URL

```bash
./scripts/probe-sites.sh              # all sites; exit 1 + DOWN_SITES: line on failure
curl -sI https://<url> | head -3      # single site; expect 200/302 (gated apps 302/401 to login)
```
An hourly site-uptime cron (plan 027, wired in the `vps-crons` repo) already probes these — check its Telegram alerts before concluding a long outage went unnoticed.

## The triple-update rule (launch or retire)

When a public surface changes, update **all three in the same change**:
1. `my-hosted-sites.md` (one line; probe-sites reads it — a URL missing here is invisible to monitoring),
2. `INFRA.md` (Worker/bindings/DNS inventory),
3. the kushal-tools hub card (`apps/kushal-tools/src/hub.ts` `APPS` array) + redeploy kushal-tools — its own CLAUDE.md mandates this.

**This rule has already slipped once**: founders-tracker made `my-hosted-sites.md` but never made INFRA.md (still absent as of 2026-07-05, along with 3 of the 5 D1 databases). If you're touching INFRA.md anyway, fix that drift and log it.

## Retiring a surface

Remove the wrangler custom domain (or Traefik label), delete the three inventory entries, decide data disposition (D1/R2/KV — export before delete), append the decommission to `decisions.md`, and add a row to **personal-stuff-failure-archaeology**'s ledger. Half-retired surfaces (DNS up, app dead) are worse than either state.

## When NOT to use this skill

- A listed site is DOWN → **personal-stuff-debugging-playbook** row 14
- Deploy mechanics for a new surface → **personal-stuff-deploy-and-operate**
- Platform details (bindings, domains) → **cloudflare-and-vps-reference**

## Provenance and maintenance

Map verified against `my-hosted-sites.md`, every `apps/*/wrangler.*`, app CLAUDE.mds, and `INFRA.md` on 2026-07-05. Re-verify:
- List vs reality: `./scripts/probe-sites.sh`
- Folder↔domain: `grep -rn "custom_domain\|pattern\|directory" apps/*/wrangler.*` (gym-app/kushal-docs: the source config carries the domain, but only `npm run deploy` — via `patch-routes.mjs` — actually ships it)
- Hub cards: `grep -n "url" apps/kushal-tools/src/hub.ts`
