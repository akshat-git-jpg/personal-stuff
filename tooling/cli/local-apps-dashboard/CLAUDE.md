# local-apps-dashboard — operating notes for Claude

This is the source of truth for local (non-deployed) dev servers. `apps.json` is
the registry the dashboard reads; the dashboard UI at :4321 is how the owner runs
them.

**When you build a new local-only app or script the owner will want to run:**
register it by adding one object to `apps.json` (`id`, `name`, `cwd` absolute,
`start` shell command, `port`, `url`). That is the whole "document a local app"
workflow — there is no separate doc to keep in sync. `apps/local-apps.md` is only
a stub pointing here.

**Multi-port apps** (e.g. a Vite+wrangler `dev:local` that binds both 5173 and
8787): list every port in a `ports` array, e.g. `"ports": [5173, 8787]`. `port`
stays the primary/UI port (used for the Open link + status line). The dashboard
uses the full `ports` set to (a) reclaim stale/zombie holders before Start so a
leftover process can never wedge a restart, and (b) decide readiness (all ports
listening = ready → Open enabled). If you omit `ports`, it falls back to `[port]`.

**Do not** add a `package.json` or dependencies — this tool is Node built-ins
only, matching the sibling `ccusage-dashboard`.

Lifecycle is deliberate: apps are spawned as detached process groups so Stop can
kill the whole tree, and they are all reaped when the dashboard exits. There is no
persistence and no auto-start on login — that was the owner's explicit choice.
