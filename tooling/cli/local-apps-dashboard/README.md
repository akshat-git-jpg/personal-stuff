# local-apps-dashboard

A local control panel for the dev servers that don't run on the VPS or Cloudflare —
the ones you'd otherwise start by hand in separate terminal tabs.

## Run it

From the repo root:

```bash
node tooling/cli/local-apps-dashboard/dashboard.mjs   # macOS, Linux
```

```powershell
node tooling\cli\local-apps-dashboard\dashboard.mjs   # Windows
```

Then open http://localhost:4321. Each app has Start / Stop / Open buttons and a
live status dot. Apps run only while this dashboard is open. Quit it (Ctrl-C or
close the process) and every app it started shuts down too.

Zero dependencies, Node built-ins only. No build step. Runs on macOS, Linux and
Windows; the OS-specific parts (port lookup, killing a process tree) sit in one
shim block near the top of `dashboard.mjs`.

## Add an app

Add one object to `apps.json` and reload the page — no restart needed:

```json
{ "id": "myapp", "name": "My App", "cwd": "apps/my-app", "start": "npm run dev", "port": 3000, "url": "http://localhost:3000" }
```

- `cwd` is relative to the repo root, so the same registry works on every clone
  and every OS. Don't write absolute paths.
- `start` is the shell command (chains with `&&` are fine, so put prep like a
  db-seed before the server: `npm run seed:local && npm run dev:local`).
- `port` is the app's main port. The dashboard refuses to start an app if that
  port is already taken, which is how it stops two apps that share a port (e.g.
  tracker and lists both use :5173) from clobbering each other.
- `url` is what the Open button points at.
