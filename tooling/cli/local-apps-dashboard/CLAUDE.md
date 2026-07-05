# local-apps-dashboard — operating notes for Claude

This is the source of truth for local (non-deployed) dev servers. `apps.json` is
the registry the dashboard reads; the dashboard UI at :4321 is how the owner runs
them.

**When you build a new local-only app or script the owner will want to run:**
register it by adding one object to `apps.json` (`id`, `name`, `cwd` absolute,
`start` shell command, `port`, `url`). That is the whole "document a local app"
workflow — there is no separate doc to keep in sync. `apps/local-apps.md` is only
a stub pointing here.

**Do not** add a `package.json` or dependencies — this tool is Node built-ins
only, matching the sibling `ccusage-dashboard`.

Lifecycle is deliberate: apps are spawned as detached process groups so Stop can
kill the whole tree, and they are all reaped when the dashboard exits. There is no
persistence and no auto-start on login — that was the owner's explicit choice.
