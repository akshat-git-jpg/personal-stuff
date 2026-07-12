---
name: personal-stuff-deploy-and-operate
description: Use when deploying or operating anything in personal-stuff — shipping a Worker app, rebuilding a VPS Docker container, adding/changing/removing a VPS cron, running the gated deploy-all script, accessing MinIO, or verifying that a deploy actually took. Also use when asked "how do I ship this change to prod".
---

# Deploy and operate

## Overview

Three deployment surfaces, three mechanisms. **Deploys go to production directly — there is no staging.** Pick the row, follow it, verify, then update the docs of record.

| Surface | Mechanism | Verify |
|---|---|---|
| Cloudflare Worker (`apps/*` with wrangler config) | `npm run deploy` inside the app folder | curl the URL + app smoke test |
| VPS Docker app (personal-dashboard, hyperframes-render) | SSH → `cd /docker/<name> && docker compose up -d --build` | `docker ps` + curl the domain |
| VPS cron | Pattern B (code in git, wiring via SSH) — lifecycle in `VPS-CRONS.md`; schedule/dep changes: `ssh root@72.61.241.170 '/srv/crons/vps-apply.sh'` | manual run: `/srv/crons/<job>/run.sh`, then `tail logs/cron.log` |

**Orchestrated path (plan-driven work): boss** (`tooling/boss/`, captain's successor — captain is frozen). Boss lands PRs via greenlight then runs the gated `bin/boss-deploy.sh`. Standing permission (decisions.md 2026-07-11): boss may execute the owner-side deploy chain itself — `wrangler secret put`/`deploy`, VPS SSH cron wiring, committing wrappers to `vps-crons`, syncing the mirrored `VPS-CRONS.md` copies — but ONLY after the owner explicitly says "deploy" (or equivalent) on that item; the deploy gate itself is unchanged. Still human-only: interactive browser OAuth consent and deleting a live credential/account.

## Workers — the rules

1. **Always the app's own `deploy` npm script, never bare `wrangler deploy`.** Per-app quirks live in each `deploy` script on purpose — gym-app and kushal-docs need their `patch-routes.mjs` step or the custom domain silently drops (mechanism: **cloudflare-and-vps-reference**). kushal-tools has no build; landing pages are `node build-pages.mjs` (bridebestie only) then `npx wrangler deploy` per subfolder.
2. **Fleet deploy:** `./scripts/deploy-apps.sh [--dry-run] [--skip-checks] [--only a,b]` — runs `./scripts/check-apps.sh` as a gate first, then each app's own `deploy` script. Dry-run first. `--skip-checks` is only for immediate re-runs after a green `check-apps.sh` — not a way around the gate. Never inline app-specific logic into this script (stated in its header).
3. **First deploy of a new custom domain** auto-creates DNS + SSL — no dashboard step. Exception: tutorial-tracker-app's Google OAuth callback URL must be added manually in the GCP console (project `n8n-workflows-454504`) or logins break.
4. Secrets: `wrangler secret put <NAME>` in the app folder before first deploy (list per app: **personal-stuff-config-and-secrets**).
5. Git identity for pushes: existing `github-router` skill. Commit gate: existing `commit-now` skill.

## VPS Docker apps

- Deploy dir on the VPS (`/docker/<name>/`) holds the compose file + `.env`; rebuild with `docker compose up -d --build`. Source of truth for code is the repo (`apps/personal-dashboard/`, `apps/hyperframes-render/`) — keep them in sync when shipping.
- hyperframes-render specifically: deploy dir is `/docker/hyperframes-render/`; ship updates by rsync from `apps/hyperframes-render/` (exclude `node_modules`/`.env`) then `docker compose up -d --build` on the box. Note: VPS renders output 1080p; local `--quality high` gives 4K/2× DPR.
- hyperframes-render mounts card templates read-only from the VPS repo clone (`/srv/projects/personal-stuff/pipelines/video/card-library/`), which the `repo-sync` cron refreshes every 15 min — **template changes are just `git push`; never hand-edit on the VPS.**
- Traefik owns 80/443; a new VPS-hosted domain means a Traefik label in the compose file + a proxied DNS A/AAAA record to `72.61.241.170` (see `my-dashboard` / `render2` rows in `INFRA.md`).

## Crons — operational cheat sheet

Full lifecycle (scaffold from `vps-crons/_template/`) is in `VPS-CRONS.md`; the day-to-day ops:

```bash
ssh root@72.61.241.170 '/srv/crons/vps-apply.sh'          # apply crontab.txt / requirements changes
ssh root@72.61.241.170 '/srv/crons/<job>/run.sh'          # manual trigger now
ssh root@72.61.241.170 'tail -50 /srv/crons/<job>/logs/cron.log'
ssh root@72.61.241.170 'crontab -l'                        # must equal /srv/crons/crontab.txt
```

Remember: VPS is UTC (IST − 5:30); cron PATH is stripped (absolute paths only); code changes need only `git push` — the wrapper pulls on every tick. The VPS is Linux: smoke-test with `timeout`, never macOS `gtimeout` (exit 127 = the test silently no-ops).

## MinIO (generated-asset storage)

Localhost-only on the VPS by choice (no public exposure). Access: SSH tunnel `ssh -i ~/.ssh/hostinger_vps -L 9001:localhost:9001 root@72.61.241.170`, then http://localhost:9001. Creds: `infra/secrets/minio.env` (see `infra/secrets/minio-access.md`). Purpose: keep generated assets out of git per the media policy (**personal-stuff-change-control**). Mac-side, the same policy is the asset-hub convention (decisions.md 2026-07-12): repo hubs `pipelines/video/{tts,heygen}/` track only reference assets + output manifests; the generated media itself lives outside the repo in `~/kb-scratch/video/{tts,heygen}/<consuming-pipeline>/`.

## After every deploy (non-negotiable)

1. **Verify it took**: `./scripts/probe-sites.sh` (curls every URL in `my-hosted-sites.md`; exits 1 + `DOWN_SITES:` line on failure), plus one real user action in the app.
2. **Update the inventory** if the surface changed (new app/domain/card): `my-hosted-sites.md` + `INFRA.md` + kushal-tools hub card — see **personal-stuff-hosting-inventory**.
3. tutorial-tracker-app only: confirm `DEV_AUTH` / `NOTIFY_REDIRECT` are NOT set in prod vars.

## When NOT to use this skill

- Platform concepts (bindings, domains, D1 ownership) → **cloudflare-and-vps-reference**
- What to run before committing → **personal-stuff-validation-and-qa**
- Deploy "worked" but the site is broken → **personal-stuff-debugging-playbook**
- Standing up a brand-new app end-to-end → **personal-stuff-idea-to-shipped**

## Provenance and maintenance

Verified against `scripts/deploy-apps.sh`, `scripts/check-apps.sh`, `scripts/probe-sites.sh`, app package.json deploy scripts, `tooling/boss/README.md` + `bin/boss-deploy.sh`, `decisions.md` (2026-07-11 boss deploy permission, 2026-07-12 asset hubs), `VPS-CRONS.md`, `INFRA.md`, and `infra/secrets/minio-access.md` on 2026-07-12 (VPS SSH unreachable from the verifying network that day — VPS-side facts re-checked against the docs of record only). No verify script on purpose: this skill's real checks (probe-sites curls, cron runs, `wrangler secret list`) need network/SSH, and a script that can't run offline is worse than commands with expected outputs. Re-verify:
- deploy-apps flags: `sed -n '1,30p' scripts/deploy-apps.sh`
- Per-app deploy quirks: `grep '"deploy"' apps/*/package.json` (also shows the mixed v3/v4 wrangler pins — see **personal-stuff-build-and-env**)
- Boss deploy path: `tooling/boss/README.md` + decisions.md 2026-07-11 entry
- Cron ops: `VPS-CRONS.md` "Common operations"
- MinIO access: `infra/secrets/minio-access.md`
