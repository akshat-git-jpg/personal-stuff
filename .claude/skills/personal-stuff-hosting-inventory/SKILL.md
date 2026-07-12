---
name: personal-stuff-hosting-inventory
description: Use when answering anything about personal-stuff's live URLs — what's deployed where, which folder serves a domain, whether a site is up, what auth gates it, adding or retiring a public surface, or reconciling my-hosted-sites.md / INFRA.md / the kushal-tools hub when they disagree.
---

# Hosting inventory

## Overview

`my-hosted-sites.md` (repo root) is the canonical flat list of live URLs — `probe-sites.sh` literally parses it. This skill adds the URL→folder→surface→auth mapping and the update discipline that keeps the three inventory surfaces honest.

## Live surface map (as of 2026-07-12)

| URL | Repo folder | Surface | Auth |
|---|---|---|---|
| kushal-tools.agrolloo.com | `apps/kushal-tools/` | Worker (no build) | password, HMAC cookie |
| timeblock.agrolloo.com | `apps/timeblock/` | Worker (no build) + KV (`BLOCKS_KV`) | password, HMAC cookie |
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

`timeblock` (plan 054) is **deployed**, not just built — confirmed via `apps/timeblock/wrangler.toml` (`[[routes]] pattern = "timeblock.agrolloo.com"`, `custom_domain = true`) and its row in `my-hosted-sites.md`. Don't describe it as "built but not deployed" without re-checking those two.

Not a hosted surface: **media-board** (`localhost:4100`, via the `media-board` skill) is a local-only gallery over the tts/heygen asset hubs — same non-URL status as `ccu-dash` above. Don't add it to this table or to `my-hosted-sites.md`.

## Confirming a URL

```bash
./scripts/probe-sites.sh              # all sites; exit 1 + DOWN_SITES: line on failure
curl -sI https://<url> | head -3      # single site; expect 200/302 (gated apps 302/401 to login)
```
Two automated checkers already run on the VPS (see `VPS-CRONS.md` → "Active crons") — check their Telegram alerts before concluding a long outage or a routing drift went unnoticed:
- **site-probe** — hourly (`15 * * * *` UTC) — GETs every URL in `my-hosted-sites.md`, Telegram on any down site. This is the plan-027 uptime probe (renamed since; the cron name is `site-probe`, not "plan 027").
- **route-audit** — weekly, Sunday 08:00 IST (`30 2 * * 0` UTC) — read-only routing-drift audit via `claude -p` → Telegram report (plan 058, the autonomy pilot). Different job: checks doc/routing drift across the repo, not just URL uptime.

## The triple-update rule (launch or retire)

When a public surface changes, update **all three in the same change**:
1. `my-hosted-sites.md` (one line; probe-sites reads it — a URL missing here is invisible to monitoring),
2. `INFRA.md` (Worker/bindings/DNS inventory),
3. the kushal-tools hub card (`apps/kushal-tools/src/hub.ts` `APPS` array) + redeploy kushal-tools — its own CLAUDE.md mandates this.

This rule has slipped repeatedly. The 2026-06/07 drift it caused (founders-tracker and timeblock missing from INFRA.md, D1 count 2-vs-5, `BLOCKS_KV` unlisted, 4 crons missing, no timeblock hub card) was repaired on 2026-07-12 and the canonical drift table that lived here was retired per its own all-OK condition (logged in `decisions.md` 2026-07-12).

## INFRA.md drift — regression check

This skill stays the single home of the "is INFRA.md stale?" question; sibling skills (**personal-stuff-repo-map**, **personal-stuff-architecture-contract**, **cloudflare-and-vps-reference**) link here instead of re-describing drift. Check mechanically, don't eyeball:

`.claude/skills/personal-stuff-hosting-inventory/scripts/verify-inventory.sh` — compares INFRA.md against `apps/*/wrangler.*`, the hub-card `APPS` array, and `VPS-CRONS.md`; prints OK/DRIFT per row, exits 1 on any DRIFT, no network calls. All-OK as of 2026-07-12.

If it reports DRIFT again: treat `apps/*/wrangler.*` + `VPS-CRONS.md` + `my-hosted-sites.md` as ground truth over INFRA.md wherever they disagree, and route the repair through **personal-stuff-change-control** (don't patch INFRA.md as a side effect of an unrelated task).

## Retiring a surface

Remove the wrangler custom domain (or Traefik label), delete the three inventory entries, decide data disposition (D1/R2/KV — export before delete), append the decommission to `decisions.md`, and add a row to **personal-stuff-failure-archaeology**'s ledger. Half-retired surfaces (DNS up, app dead) are worse than either state.

## When NOT to use this skill

- A listed site is DOWN → **personal-stuff-debugging-playbook** row 14
- Deploy mechanics for a new surface → **personal-stuff-deploy-and-operate**
- Platform details (bindings, domains) → **cloudflare-and-vps-reference**

## Provenance and maintenance

Map verified against `my-hosted-sites.md`, every `apps/*/wrangler.*`, app CLAUDE.mds, `INFRA.md`, and `VPS-CRONS.md` on 2026-07-05, re-verified 2026-07-12 (added timeblock; consolidated the INFRA.md drift descriptions from repo-map / architecture-contract / cloudflare-and-vps-reference into the canonical table above; those skills now point here). Re-verify:
- Drift table: `.claude/skills/personal-stuff-hosting-inventory/scripts/verify-inventory.sh` (OK/DRIFT per row, exit 1 on any DRIFT)
- List vs reality: `./scripts/probe-sites.sh`
- Folder↔domain: `grep -rn "custom_domain\|pattern\|directory" apps/*/wrangler.*` (gym-app/kushal-docs: the source config carries the domain, but only `npm run deploy` — via `patch-routes.mjs` — actually ships it)
- Hub cards: `grep -n "url" apps/kushal-tools/src/hub.ts`
- D1 inventory (should be 5 — `clicks-db`, `lists-db`, `founders-db`, `tracker-db`, `yt-rankings`): `grep -rln "d1_databases" apps/*/wrangler.*` then `grep -n "database_name" <matches>`
- Cron names/rows: `VPS-CRONS.md` → "Active crons" (`site-probe` hourly, `route-audit` weekly)
