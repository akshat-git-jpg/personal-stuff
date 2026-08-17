# closet-app operating notes

- **Stack**: Vite + React 19 + Tailwind v4 SPA, Hono on a Cloudflare Worker, D1 `closet-db` (binding `DB`), R2 `closet-photos` (binding `PHOTOS`).
- **Auth guardrail**: stateless HMAC signed cookie. Do NOT replace with OAuth/KV/a DB check (`decisions.md` 2026-07-01).
- **Design guardrails**: no wash limit / no threshold colour; looks are a plain gallery with no link to clothes. Both were owner decisions on 2026-08-17.
- **Gotchas**: `bash scripts/smoke.sh` is the merge gate and unit tests cannot replace it; `c.req.param()` is undefined in wildcard middleware; tags are normalised lowercase and pruned when orphaned; `--var` beats the dev vars file.
