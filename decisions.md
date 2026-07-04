# Decisions log — personal-stuff

Append-only record of non-obvious decisions: a tool/approach chosen, a convention
set, or a load-bearing "why". Newest at the top. Check here before re-deriving or
re-asking. One line per decision; link to detail where it helps.

Format: `YYYY-MM-DD — <decision> — <why> (<optional link>)`

## Decisions

2026-07-04 — repo-wide orchestrator→executor convention: expensive model writes self-contained plans into plans/ (template + lifecycle in plans/WORKFLOW.md), cheaper models execute, orchestrator reviews — generalizes the per-model step split already proven in the Devsplainers pipeline.

2026-07-04 — MCP graveyard cleaned: google-calendar-mcp-server, google-docs-mcp-server, elevenlabs removed; gmail-mcp-server + google-shared kept (load-bearing: VPS digest cron + CLI OAuth) with STATUS banners; skill-sync logic extracted to scripts/lib/skill-link.sh with dangling-link pruning + vps-sync flock/pull-failure alert.

2026-07-04 — uniform verification: tsc -b/--noEmit as 'typecheck' script on TS apps, node --check on JS apps; check-apps.sh runs them in CI/local, skipping known-failing lints.

2026-07-04 — media policy: inputs/reference assets are tracked; render outputs are gitignored+untracked (git rm --cached, no history rewrite); heavy generated artifacts (models, work dirs) live outside the repo in ~/kb-scratch/ — the working tree was 18GB and every agent search walked it.

2026-07-04 — ty/ stays a self-governing subtree (own CLAUDE.md/docs/decisions.md); root map delegates into it; Workers live with their domain (redirector stays in ty/workers/) — every external toucher (VPS crons, symlinks, scripts/README.md list) hardcodes current paths, so moves are high-risk/low-benefit; discoverability was the actual problem.

2026-07-04 — placement rule: apps/ = personal products, ty/ = money-making projects, tooling/ = agent surface; every new folder gets README.md + CLAUDE.md from day one.

2026-07-04 — personal-dashboard auth gate restored (session check in requireAuth + client login overlay + startup password-hash self-heal) — the gate had been removed as a no-op while the app was publicly reachable; docs always described it as gated.

2026-07-01 — `apps/lists-app` (lists.agrolloo.com) auth is a stateless signed-cookie password gate (HMAC-SHA256 over the expiry, SESSION_SECRET), NOT Google OAuth + KV like tracker-app. Why: single-user personal app — no per-user identity needed, so a KV session store and OAuth dance are unjustified weight; the cookie is self-verifying with no datastore lookup.

2026-07-01 — Repo routing self-audit ships as an on-demand `/audit-repo-route` skill (personal account), not a VPS Pattern B cron — runs locally over personal-stuff + TY, auto-fixes mechanical map drift (intent-table rows, dead links, missing READMEs) and flags decisions.md staleness. Why: it's manual/Mac-triggered, needs no deploy keys or Telegram, and can edit the working tree directly for review via `git diff`.

<!-- 2026-06-30 — example: skills are edited only in tooling/claude-skills/ and symlinked via scripts/relink.sh — single source of truth across both accounts. -->
