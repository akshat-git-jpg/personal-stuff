# apps/hyperframes-render — operating notes

Paste-and-render web tool: editor pastes Hyperframes card HTML, downloads an MP4. Full detail: `README.md`.

## Guardrails

- **This is NOT a Cloudflare Worker.** Node/Express (`src/server.js`) running as a **Docker container on the Hostinger VPS** behind Traefik (`render2.agrolloo.com`). Deploy with `docker compose`, not `wrangler`.
- The Templates tab reads card HTML live from the **TY repo** at `TY/yt-visuals-hyperframe/` (mounted read-only at `/cards`, set by `CARDS_DIR`; a VPS cron `git pull`s every 15 min). **To add/change a template, edit it in TY and push** — don't hand-edit cards here, and don't bake card files into this app.
- Rendering uses headless Chrome — the container needs `shm_size: 1gb` (Docker's 64MB default crashes Chrome).

## Run / deploy

```bash
npm run dev                 # node --watch src/server.js (local)
docker compose up -d --build   # on the VPS, deploy dir /docker/hyperframes-render/ holds .env
```

Secrets in `.env`: `APP_PASSWORD`, `SESSION_SECRET`.
