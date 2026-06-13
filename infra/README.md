# infra/

Infrastructure code for the VPS and Cloudflare setup. The canonical inventory of zones, Workers, KV, DNS, and VPS containers lives in `../INFRA.md` at the repo root — read that first.

| Folder | What it is |
|---|---|
| `docker/` | Compose files for VPS containers (currently ntfy). |
| `vps-watchdog/` | Cloudflare Worker on a 2-minute cron — pings the dashboard and reboots the VPS if it's down. |
| `secrets/` | Local-only credentials. Gitignored, never committed. |
