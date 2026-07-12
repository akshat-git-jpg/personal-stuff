---
name: personal-stuff-config-and-secrets
description: Use when hunting where a secret, token, API key, or env var lives in personal-stuff, adding a new one, rotating one, or debugging "not set in .env" / auth-failed errors — Worker secrets, pipelines .env, Google OAuth tokens, VPS cron .env files, .dev.vars, .mcp.json, or infra/secrets. Also use before rebuilding any environment from an .example file.
---

# Config and secrets map

## Overview

Secrets never enter git — they live in exactly six places, each with its own rotation path. **Names are documented; values are not.** If a script errors `<NAME> not set in .env`, find the axis below, don't invent a new location.

## The six secret axes

| Axis | Location | What lives there | Rotation / setup |
|---|---|---|---|
| 1. Worker prod secrets | Cloudflare, per Worker | `APP_PASSWORD`/`APP_PIN`, `SESSION_SECRET`, app-specific (below) | `wrangler secret put <NAME>` in the app folder |
| 2. Worker local dev | `apps/<app>/.dev.vars` (gitignored; `.dev.vars.example` templates) | mirror of axis 1 | edit file |
| 3. Python workspace | `pipelines/.env` + `pipelines/credentials.json` (both gitignored) | 21 keys (below) + Google **service account** | edit `.env`; share each Sheet with the service account's `client_email` as Editor |
| 4. Google OAuth (human accounts) | `tooling/mcp/google-shared/credentials.json` + `tokens/<email>.json` (gitignored) | one OAuth Desktop client; per-account tokens (5 as of 2026-07-12: `kushalbakliwal25`, `seankerman25`, `jessicap123k`, `akshatpatidar17`, `seemabakliwal19` @gmail.com) | `python3 tooling/mcp/google-shared/setup_auth.py <email>` (browser consent on the Mac) |
| 5. Misc tool secrets | `infra/secrets/` | `heygen-web-curls.txt` (+ `heygen-usage-last.json` ledger), `hostinger-vps.env`, `impact.env`, `minio.env`, `fal.env`, `telegram.env` (+ `telegram.env.example`, `minio-access.md`) | edit file; heygen cookies rotate in minutes–hours (recapture cURL on 403) |
| 6. VPS-side | `/srv/crons/<job>/.env` (Telegram bot+chat), vendored `token.json` next to project code, `/root/.claude/.credentials.json`, `/root/.claude-rc.env` (chmod 600, EnvironmentFile for `claude-rc.service`: ELEVENLABS/PEXELS/SKOOL/VALYU/OPENROUTER keys) | per-cron delivery secrets, OAuth tokens, Claude Pro login, Remote Control env | edit on VPS directly / `scp` from Mac — never via git |

Also per-CLI: the Hostinger API token lives at `tooling/mcp/hostinger/.env` (`API_TOKEN`) — the `pp-hostinger` CLI in `tooling/cli/hostinger/` reads it from there, NOT from a `.env` of its own; `~/.config/` holds `paypal-txns-pp-cli` creds. `GUMROAD_ACCESS_TOKEN` for the gumroad CLI.

## `pipelines/.env` — real key list (21 keys, re-verified 2026-07-12)

`YT_API_KEY`, `GEMINI_API_KEY`, `CREDENTIALS_FILE`, `YT_MAIN_SHEET_URL`, `YT_TRACKER_SHEET_URL`, `WORKFLOW_DEADLINES_SHEET_URL`, `KEYWORD_RESEARCH_SHEET_URL`, `AFFILIATE_PROGRAMS_SHEET_URL`, `ANALYSIS_INCOME_SHEET_URL`, `INCOME_ANALYSIS`, `GOOGLE_SHEET_URL`, `RANDOM_NOTES_SHEET_URL`, `PROBLEMS_AUTOMATIONS_SHEET_URL`, `MISC_CHANNELS_SHEET_URL`, `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID`, `CF_KV_NAMESPACE_ID`, `LINK_DOMAIN`, `CF_GLOBAL_API_KEY`, `CF_API_EMAIL`.

**TRAP:** `pipelines/.env.example` lists only 10 of these 21 (as of 2026-07-12). Rebuilding from the example alone breaks most sync scripts. `common/env.py` auto-loads `.env` keyed off its own file location (not CWD) — scripts never load it themselves. `common/cloudflare.py` hard-requires `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID`/`CF_KV_NAMESPACE_ID` (raises `RuntimeError: <NAME> not set in .env`).

## Worker app-specific secrets (beyond the gate pair)

| App | Extra secrets |
|---|---|
| gym-app | `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REFRESH_TOKEN`, `SHEET_ID` |
| kushal-docs | `GOOGLE_CLIENT_ID/SECRET`, `ALLOWED_EMAIL` |
| tutorial-tracker-app | `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REDIRECT_URI`, `SHEET_ID`, `GOOGLE_SA_JSON`, `GMAIL_*` (dev-only: `DEV_AUTH`, `NOTIFY_REDIRECT` — never in prod) |
| analytics-app | `YT_API_KEY` (required) |
| redirector, landing pages | none |

## Machine-local config (not secret, still per-machine)

- `.mcp.json` (repo root) — **gitignored**, absolute paths; regenerate after clone/move: `./scripts/regen-mcp-json.sh` (env `MCP_PYTHON` overrides the interpreter). Wires only `google-drive` + `cloudflare`.
- `.claude/settings.local.json` — permission allow-list + enabled MCP servers.
- Per-app `.npmrc` pinning the public npm registry (work `~/.npmrc` → CodeArtifact 401s).

## Account boundaries (deliberate — do not "simplify")

- Cloudflare + GCP project `n8n-workflows-454504`: `akshatpatidar17@gmail.com`.
- VPS Claude: `kushalbakliwal25@gmail.com` (personal Pro) — cron LLM usage stays off the work Team seat. Mac work account: `kushal.b@zluri.com`.
- Every Google CLI/MCP call passes an explicit full-email `account` argument.
- `gcloud` (Homebrew) is authed as `akshatpatidar17@gmail.com` and can do most GCP admin. **Console-UI-only (no API exists):** creating OAuth 2.0 client IDs, the consent screen, consent test users. New OAuth clients can take minutes–hours to propagate (`invalid_client` on a fresh one = lag, not error); Google blocks sensitive scopes (e.g. spreadsheets) on gcloud's default client — use the own OAuth client or the service account.
- A separate Gmail token (`…filters.json`, scopes settings.basic+modify) exists just for managing akshatpatidar17's Gmail filters/labels (7 inbox-cleanup filters live as of 2026-06).

## Adding a new secret — checklist

1. Pick the axis above; add it there (never a new location, never git).
2. Add the NAME to the matching `.example` file (`.dev.vars.example`, `pipelines/.env.example`, `vps-crons/<job>/.env.example`) — this is the step that keeps rebuilds possible.
3. Re-verify: run the consumer once (`wrangler dev` + hit the route; or the pipeline script; or the cron's `run.sh` manually).
4. `git status` — confirm nothing secret is staged.

## No-secrets zones

`context/` (explicit no-secrets/PII rule), skills, docs, decisions.md, plan files.

## When NOT to use this skill

- Auth *behavior* broken (401s, expired sessions) → **personal-stuff-debugging-playbook**
- Rebuilding a whole machine → **personal-stuff-build-and-env**
- Rotating a cron's Google token step-by-step → `VPS-CRONS.md` "Rotate a Google OAuth token"

## Provenance and maintenance

Key names verified against `pipelines/.env` (names only), `infra/secrets/` listing, `tooling/cli/hostinger/pp_hostinger.py`, app wrangler configs + CLAUDE.mds, `tooling/mcp/README.md`, and `VPS-CRONS.md` on 2026-07-12. Re-verify: run `scripts/verify.sh` in this skill dir (offline, names-only; exit 0 = all documented facts hold, exit 1 names the failing check). The one check it can't run offline — Worker prod secrets — stays manual: `cd apps/<app> && npx wrangler secret list` (needs Cloudflare auth).
