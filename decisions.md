# Decisions log — personal-stuff

Append-only record of non-obvious decisions: a tool/approach chosen, a convention
set, or a load-bearing "why". Newest at the top. Check here before re-deriving or
re-asking. One line per decision; link to detail where it helps.

Format: `YYYY-MM-DD — <decision> — <why> (<optional link>)`

## Decisions

2026-07-01 — `apps/lists-app` (lists.agrolloo.com) auth is a stateless signed-cookie password gate (HMAC-SHA256 over the expiry, SESSION_SECRET), NOT Google OAuth + KV like tracker-app. Why: single-user personal app — no per-user identity needed, so a KV session store and OAuth dance are unjustified weight; the cookie is self-verifying with no datastore lookup.

2026-07-01 — Repo routing self-audit ships as an on-demand `/audit-repo-route` skill (personal account), not a VPS Pattern B cron — runs locally over personal-stuff + TY, auto-fixes mechanical map drift (intent-table rows, dead links, missing READMEs) and flags decisions.md staleness. Why: it's manual/Mac-triggered, needs no deploy keys or Telegram, and can edit the working tree directly for review via `git diff`.

<!-- 2026-06-30 — example: skills are edited only in tooling/claude-skills/ and symlinked via scripts/relink.sh — single source of truth across both accounts. -->
