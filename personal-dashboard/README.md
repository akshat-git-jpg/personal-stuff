# Personal Dashboard

Mobile-first personal dashboard: to-dos with LLM-assisted capture, habit tracking with streaks, mindset remembers, and Google Calendar view. Single-user, runs on SQLite, deployable on a Hostinger VPS behind Traefik.

## Local development

```bash
# 1. Copy env and fill in at minimum APP_PASSWORD and OPENROUTER_API_KEY
cp .env.example .env

# 2. Start (creates data/app.sqlite automatically on first boot)
npm start

# 3. Open http://localhost:8787
#    Default password is set in .env APP_PASSWORD (fallback: "changeme")
```

For live reload during development:

```bash
npm run dev
```

## Data storage

SQLite database at `data/app.sqlite`. Gitignored. Back up this file to preserve all your data. Use Settings → Export to get a full JSON dump at any time.

## Deploying to the Hostinger VPS (Traefik)

### One-time DNS setup

Add an A record: `dash.srv1377177.hstgr.cloud` → `72.61.241.170`.

### Deploy

```bash
# From your local machine
rsync -av --exclude node_modules --exclude data --exclude .git \
  "/path/to/personal-dashboard/" \
  root@72.61.241.170:/docker/personal-dashboard/ \
  -e "ssh -i ~/.ssh/hostinger_vps"

# On the VPS
ssh -i ~/.ssh/hostinger_vps root@72.61.241.170
cd /docker/personal-dashboard
cp .env.example .env   # fill in real secrets
docker compose up -d --build
```

Traefik picks up the labels and issues a TLS cert automatically. The app is available at `https://dash.srv1377177.hstgr.cloud`.

Note: check `docker network ls` on the VPS and update `traefik-net` in `docker-compose.yml` to match the actual Traefik network name.

## Google Calendar — one-time OAuth setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create an OAuth 2.0 Client ID (Web application).
3. Add authorized redirect URI: `https://dash.srv1377177.hstgr.cloud/api/settings/google/callback`.
4. Copy the Client ID and Secret into `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. Set `GOOGLE_REDIRECT_URI=https://dash.srv1377177.hstgr.cloud/api/settings/google/callback`.
6. In the dashboard, go to Settings → Google Calendar → Connect.
7. Complete the OAuth flow. Tokens are stored in the database (not in env).

## Environment variables

See `.env.example` for the full list. Required:

| Variable | Description |
|---|---|
| `APP_PASSWORD` | Initial login password (hashed in DB on first boot) |
| `SESSION_SECRET` | Cookie session secret (set a long random string) |
| `OPENROUTER_API_KEY` | OpenRouter key for LLM capture (optional — fallback works without it) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (optional — for Calendar) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Must match the OAuth client's redirect URI |
