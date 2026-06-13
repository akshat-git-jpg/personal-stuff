# vps-watchdog

A Cloudflare Worker on a cron (`*/2 * * * *`) that checks the VPS is alive and reboots it through the Hostinger API if it isn't. It has no HTTP route — the cron is the only trigger. State lives in the `WATCHDOG_KV` namespace.

The signal it watches is the personal-dashboard health endpoint; if that stops responding, the Worker calls Hostinger to restart the box.

- `src/index.js` — the Worker.
- `wrangler.jsonc` — config and the KV binding.
- `.status-secret` — local secret, gitignored.

Deploy with `npx wrangler deploy`.
