# apps/personal-dashboard — operating notes

Mobile dashboard PWA at `my-dashboard.agrolloo.com`. Full detail: `README.md`.

## Guardrails

- **This is NOT a Cloudflare Worker.** It's a Node/Express app (`src/server.js`) running as a **Docker container on the Hostinger VPS** behind Traefik. Deploy with `docker compose`, not `wrangler`. Don't reach for the Worker tooling the sibling apps use.
- State lives in a local SQLite-style DB under `data/` on the VPS. **Google Calendar OAuth tokens are stored in the DB, not in env** — don't move them to `.env`.
- `APP_PASSWORD` is hashed into the DB on first boot; changing the env var afterwards doesn't change the login. Secrets in `.env` (see `.env.example`): `APP_PASSWORD`, `SESSION_SECRET`, optional `OPENROUTER_API_KEY`, Google OAuth vars.

## Run / deploy

```bash
npm run dev                 # node --watch src/server.js (local)
docker compose up -d --build   # on the VPS, deploy dir holds .env
```

Gotcha: the Traefik network in `docker-compose.yml` (`traefik-net`) must match the actual network name on the VPS (`docker network ls`).
