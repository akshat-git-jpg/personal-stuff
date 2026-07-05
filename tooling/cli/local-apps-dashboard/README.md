# local-apps-dashboard

A local control panel for the dev servers that don't run on the VPS or Cloudflare —
the ones you'd otherwise start by hand in separate terminal tabs.

## Run it

```bash
node /Users/kbtg/codebase/personal-stuff/tooling/cli/local-apps-dashboard/dashboard.mjs
```

Then open http://localhost:4321. Each app has Start / Stop / Open buttons and a
live status dot. Apps run only while this dashboard is open — quit it (Ctrl-C or
close the process) and every app it started shuts down too.

Zero dependencies, Node built-ins only. No build step.

## Add an app

Add one object to `apps.json` and reload the page — no restart needed:

```json
{ "id": "myapp", "name": "My App", "cwd": "/abs/path", "start": "npm run dev", "port": 3000, "url": "http://localhost:3000" }
```

- `start` is the shell command (chains with `&&` are fine — put prep like a
  db-seed before the server: `npm run seed:local && npm run dev:local`).
- `port` is the app's main port. The dashboard refuses to start an app if that
  port is already taken, which is how it stops two apps that share a port (e.g.
  tracker and lists both use :5173) from clobbering each other.
- `url` is what the Open button points at.
