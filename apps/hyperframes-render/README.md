# hyperframes-render

A paste-and-render web tool for Hyperframes video cards. The editor logs in, pastes a card's HTML, and downloads an MP4. No terminal, no local setup.

Live at https://render2.agrolloo.com (password-gated).

## How it works

An Express server (`src/server.js`) serves a small web UI and renders pasted HTML with headless Chrome. Login is a shared password, so cookies need a stable secret to survive restarts.

The Templates tab is a gallery of ready-made cards read live from the TY checkout at `TY/yt-visuals-hyperframe/`. On the VPS that folder is mounted read-only at `/cards` (set by `CARDS_DIR`) and a cron pulls it every 15 minutes, so adding a template in TY and pushing makes it show up here with no redeploy.

## Config

Copy `.env.example` to `.env` and set:

- `APP_PASSWORD` — the shared login password.
- `SESSION_SECRET` — long random string (`openssl rand -hex 32`) so logins survive restarts.

Optional: `HF_VERSION` (Hyperframes version, default 0.6.97), `FPS` (default 30), `QUALITY` (draft | standard | high, default high), `PORT` (default 8080).

## Deploy

Runs as a Docker container on the Hostinger VPS behind the existing Traefik v3, same pattern as personal-dashboard. Deploy dir on the VPS is `/docker/hyperframes-render/` (holds `.env`). The `Host(...)` rule in `docker-compose.yml` sets the subdomain. Chrome needs `shm_size: 1gb` — the default 64MB is not enough.

```bash
docker compose up -d --build
```
