# local-apps-dashboard — operating notes for Claude

This is the source of truth for local (non-deployed) dev servers. `apps.json` is
the registry the dashboard reads; the dashboard UI at :4321 is how the owner runs
them.

**When you build a new local-only app or script the owner will want to run:**
register it by adding one object to `apps.json` (`id`, `name`, `cwd` absolute,
`start` shell command, `port`, `url`). That is the whole "document a local app"
workflow — there is no separate doc to keep in sync. `apps/local-apps.md` is only
a stub pointing here.

**Every app gets its OWN ports so all can run at once — this is the scalable
rule, not sibling-blocking.** Two apps must never share a port.

**Vite web + wrangler API apps** (the `dev:local` pattern): the app reads
`WEB_PORT`/`API_PORT` from env — `vite.config.ts` uses them for `server.port`
(with `strictPort: true`) and the `/api` proxy target, and `dev:api` is
`wrangler dev --port ${API_PORT:-8787}`. In the registry, give each such app:
- `"env": { "WEB_PORT": "5273", "API_PORT": "8887" }` — the dashboard injects these.
- `"ports": [5273, 8887]` — every port the app binds (for stale-port reclaim + readiness).
- `"port"` + `"url"` using the web port.

Convention for new vite+wrangler apps: **web** 5173, 5273, 5373… (+100) and
**api** 8787, 8887, 8987… (+100). Pick the next free pair. A plain single-port
app (like ccusage) just needs `port`/`ports`/`url`, no `env`.

`port` is the primary/UI port (Open link + status line). The dashboard uses the
full `ports` set to (a) reclaim stale/zombie holders before Start so a leftover
process can never wedge a restart, and (b) decide readiness (all ports listening
= ready → Open enabled). If two registry entries accidentally share a port, Start
refuses with "port N in use by <app>" — that's a config error to fix (bump one to
a free pair), not normal usage.

**Do not** add a `package.json` or dependencies — this tool is Node built-ins
only, matching the sibling `ccusage-dashboard`.

Lifecycle is deliberate: apps are spawned as detached process groups so Stop can
kill the whole tree, and they are all reaped when the dashboard exits. There is no
persistence and no auto-start on login — that was the owner's explicit choice.
