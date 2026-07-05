# Plan 020: Local-apps dashboard — one-click Start/Stop/Open for local dev servers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat de6c321..HEAD -- tooling/cli/local-apps-dashboard apps/local-apps.md`
> Expect: **no output** (these paths are new/untouched since the base commit). If
> `apps/local-apps.md` shows as modified, read it before editing so you preserve
> existing content. The repo has unrelated uncommitted changes under
> `apps/tracker-app/` — those are NOT yours; never stage them (see Git workflow).

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Executor**: sonnet
- **Difficulty**: standard
- **Planned at**: commit `de6c321`, 2026-07-05

## Why this matters

The owner runs several local dev servers by hand — opening a new terminal tab per
app and pasting multi-line commands from `apps/local-apps.md`. This plan replaces
that with a single local web page (like the existing ccusage dashboard) that lists
every local app with **Start / Stop / Open** buttons and live running status.

Two design decisions were already made with the owner and are fixed — do not
re-litigate them:

1. **Interface = a local web dashboard** at `http://localhost:4321`.
2. **Lifecycle = "only while the dashboard is open."** Each app runs as its own
   detached process group so a single **Stop** can kill the whole tree, and a
   dashboard-exit handler reaps every app when the dashboard quits. Nothing
   survives the dashboard. No auto-start on login, no persistence.
3. **Registry = one JSON file** (`apps.json`). The dashboard UI is the source of
   truth for how to run each app; `apps/local-apps.md` becomes a one-line stub
   pointing here. Adding a new local app later = adding one object to `apps.json`.

The intelligence-heavy part (process-group spawn/kill, teardown, port-conflict
guard) is written out for you below as the reference implementation. Your job is
to place these files exactly, then verify behavior with the commands given. Only
deviate if a Verify step fails.

## Current state

- **Exemplar to match**: `tooling/cli/ccusage-dashboard/dashboard.mjs` — a
  zero-dependency Node HTTP server that serves an inline dark-themed HTML page and
  exposes `/api/*` JSON endpoints. Your `dashboard.mjs` follows the same shape
  (Node built-ins only, inline `HTML` template string, same visual language).
- **House convention** (repo backlog note `DEP-01`): local Node CLIs use **Node
  built-ins only, no `package.json`, no dependencies**. Do not add one.
- **The three apps to register** (verified against each app's `package.json`
  scripts and `apps/local-apps.md`):
  - `ccusage` — `node dashboard.mjs` in `tooling/cli/ccusage-dashboard`, serves
    `http://localhost:4319`. Single zero-dep node process, starts instantly. **This
    is the app used for automated verification below** because it needs no install.
  - `tracker` — `npm run seed:local && npm run dev:local` in `apps/tracker-app`;
    `dev:local` runs `concurrently` → wrangler on :8787 + vite on :5173. UI at
    `http://localhost:5173/dev-login?email=seankerman25@gmail.com`.
  - `lists` — `npm run db:local && npm run dev:local` in `apps/lists-app`; same
    concurrently shape, UI at `http://localhost:5173`.
- Because `tracker` and `lists` both bind :5173, they cannot run at the same time —
  the dashboard's port-conflict guard is what enforces that (refuses Start if the
  app's declared port is already busy).
- **Process-tree gotcha**: `npm run dev:local` spawns `concurrently`, which spawns
  vite and wrangler. Killing only the top process orphans vite/wrangler. The
  reference `stopApp` kills the **process group** (`process.kill(-pid, ...)`),
  which is why apps are spawned `detached: true`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax check | `node --check tooling/cli/local-apps-dashboard/dashboard.mjs` | exit 0, no output |
| Registry valid JSON | `node -e "JSON.parse(require('fs').readFileSync('tooling/cli/local-apps-dashboard/apps.json','utf8'));console.log('json ok')"` | prints `json ok` |
| Run the dashboard | `node tooling/cli/local-apps-dashboard/dashboard.mjs` | prints `local-apps dashboard → http://localhost:4321` |
| Full behavior test | the Step 4 script below | all curl assertions pass |

## Scope

**In scope** (the ONLY files you create/modify):
- `tooling/cli/local-apps-dashboard/dashboard.mjs` (new)
- `tooling/cli/local-apps-dashboard/apps.json` (new)
- `tooling/cli/local-apps-dashboard/README.md` (new)
- `tooling/cli/local-apps-dashboard/CLAUDE.md` (new)
- `apps/local-apps.md` (edit → replace with the stub in Step 6)
- `plans/README.md` (Step 7: flip this plan's status row only)

**Out of scope** (looks related — do NOT touch):
- `tooling/cli/ccusage-dashboard/*` — read it as a reference only; do not edit.
- `apps/tracker-app/*`, `apps/lists-app/*` — the tracker app has unrelated
  uncommitted changes in the working tree. Never stage or modify these.
- Root `README.md` / `CLAUDE.md` routing tables — not needed for this plan.

## Git workflow

- Branch: `git checkout -b advisor/020-local-apps-dashboard` (the unrelated
  tracker working-tree changes will follow onto this branch uncommitted — that is
  expected and harmless; you must not commit them).
- Stage **only the in-scope paths explicitly** — never `git add -A` / `git add .`:
  ```
  git add tooling/cli/local-apps-dashboard/ apps/local-apps.md plans/README.md
  ```
- Commit message: `feat(tooling): local-apps dashboard — one-click start/stop/open`
  — no AI footers. **Do NOT push.**

## Steps

### Step 1: Create `tooling/cli/local-apps-dashboard/dashboard.mjs`

Create the directory and write this file **verbatim**. It is the complete
reference implementation — do not abbreviate or "improve" it.

```js
#!/usr/bin/env node
// local-apps dashboard — one-click Start/Stop/Open for local dev servers.
// Zero dependencies (Node built-ins only). Start: `node dashboard.mjs`, open the URL.
//
// Apps run as DETACHED process groups so a single Stop kills the whole tree
// (npm → concurrently → vite/wrangler). A dashboard-exit handler reaps every
// app when the dashboard quits — nothing survives the dashboard.

import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY = join(__dirname, 'apps.json');
const PORT = process.env.PORT || 4321;
const LOG_LINES = 200;

// id -> { child, pid, startedAt, log: string[] }
const running = new Map();

const loadRegistry = () => JSON.parse(readFileSync(REGISTRY, 'utf8'));

// True if something is already listening on 127.0.0.1:<port>.
function portBusy(port) {
  return new Promise((resolve) => {
    if (!port) return resolve(false);
    const srv = net.createServer();
    srv.once('error', (e) => resolve(e.code === 'EADDRINUSE'));
    srv.once('listening', () => srv.close(() => resolve(false)));
    srv.listen(port, '127.0.0.1');
  });
}

function pushLog(rec, chunk) {
  for (const line of chunk.toString().split('\n')) rec.log.push(line);
  if (rec.log.length > LOG_LINES) rec.log.splice(0, rec.log.length - LOG_LINES);
}

async function startApp(app) {
  if (running.has(app.id)) return { ok: false, error: 'already running' };
  if (app.port && (await portBusy(app.port)))
    return { ok: false, error: `port ${app.port} already in use (another app?)` };
  const child = spawn(app.start, {
    cwd: app.cwd,
    shell: true, // run the command string via /bin/sh -c (supports &&)
    detached: true, // own process group → Stop can kill the whole tree
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  const rec = { child, pid: child.pid, startedAt: Date.now(), log: [] };
  child.stdout.on('data', (d) => pushLog(rec, d));
  child.stderr.on('data', (d) => pushLog(rec, d));
  child.on('exit', () => { running.delete(app.id); });
  child.on('error', (e) => { pushLog(rec, `spawn error: ${e.message}`); running.delete(app.id); });
  running.set(app.id, rec);
  return { ok: true };
}

function stopApp(id) {
  const rec = running.get(id);
  if (!rec) return { ok: false, error: 'not running' };
  try { process.kill(-rec.pid, 'SIGTERM'); }         // negative pid = whole group
  catch { try { rec.child.kill('SIGTERM'); } catch {} }
  setTimeout(() => { try { process.kill(-rec.pid, 'SIGKILL'); } catch {} }, 4000);
  running.delete(id);
  return { ok: true };
}

function statusList() {
  return loadRegistry().apps.map((a) => {
    const rec = running.get(a.id);
    return {
      id: a.id, name: a.name, url: a.url || null, port: a.port || null,
      running: !!rec,
      uptimeSec: rec ? Math.floor((Date.now() - rec.startedAt) / 1000) : 0,
    };
  });
}

// ---- teardown: nothing survives the dashboard --------------------------------
let tearingDown = false;
function teardown() {
  if (tearingDown) return;
  tearingDown = true;
  for (const [, rec] of running) { try { process.kill(-rec.pid, 'SIGTERM'); } catch {} }
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', teardown);
process.on('SIGTERM', teardown);
process.on('SIGHUP', teardown);
process.on('exit', () => {
  for (const [, rec] of running) { try { process.kill(-rec.pid, 'SIGKILL'); } catch {} }
});

// ---- HTTP --------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(obj));
  };
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === '/api/status') return send(200, { apps: statusList() });
    if (req.method === 'POST' && url.pathname.startsWith('/api/start/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/start/'.length));
      const app = loadRegistry().apps.find((a) => a.id === id);
      if (!app) return send(404, { ok: false, error: 'unknown app' });
      return send(200, await startApp(app));
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/stop/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/stop/'.length));
      return send(200, stopApp(id));
    }
    if (url.pathname.startsWith('/api/logs/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/logs/'.length));
      const rec = running.get(id);
      return send(200, { log: rec ? rec.log.join('\n') : '(not running)' });
    }
  } catch (e) { return send(500, { ok: false, error: e.message }); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(HTML);
});

server.listen(PORT, () => {
  console.log(`\n  local-apps dashboard → http://localhost:${PORT}`);
  console.log(`  registry: ${REGISTRY}`);
  console.log(`  Apps run only while this dashboard is open. Ctrl-C stops everything.\n`);
});

// ---- Front-end ---------------------------------------------------------------
const HTML = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Local apps</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; background:#0d0f12; color:#e6e8eb; font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif; }
  header { display:flex; align-items:baseline; justify-content:space-between; padding:18px 26px 4px; }
  header h1 { font-size:16px; font-weight:600; margin:0; }
  header .meta { font-size:12px; color:#8b929b; }
  .wrap { padding:14px 26px 40px; max-width:840px; }
  .app { background:#15181d; border:1px solid #20242b; border-radius:12px; padding:14px 16px; margin-bottom:12px; }
  .app .top { display:flex; align-items:center; gap:10px; }
  .dot { width:9px; height:9px; border-radius:50%; flex:0 0 auto; }
  .name { font-size:14px; font-weight:600; }
  .sub { font-size:11px; color:#7b828c; margin-left:auto; }
  .btns { display:flex; gap:8px; margin-top:11px; flex-wrap:wrap; }
  button { background:#1c2027; color:#cfd3da; border:1px solid #2c323b; border-radius:8px; font:inherit; font-size:12px; padding:5px 13px; cursor:pointer; }
  button:hover { background:#2a2f37; }
  button:disabled { opacity:.4; cursor:default; }
  button.start { border-color:#2e5d3f; color:#8fe0aa; }
  button.stop { border-color:#5d2e2e; color:#e59a9a; }
  a.open { text-decoration:none; }
  .logs { margin-top:10px; background:#0a0c0f; border:1px solid #20242b; border-radius:8px; padding:9px 11px; font:11px/1.45 ui-monospace,Menlo,monospace; color:#9aa2ad; white-space:pre-wrap; max-height:220px; overflow:auto; }
</style></head><body>
<header>
  <h1>Local apps</h1>
  <div class="meta"><span id="updated">loading…</span> · auto-refresh 2s · apps stop when you quit the dashboard</div>
</header>
<div class="wrap" id="app"></div>
<script>
let apps=[], openLogs={};
const fmtUp = s => { if(!s) return ''; if(s<60) return s+'s'; const m=Math.floor(s/60); if(m<60) return m+'m '+(s%60)+'s'; return Math.floor(m/60)+'h '+(m%60)+'m'; };
async function j(url,opts){ const r=await fetch(url,{cache:'no-store',...opts}); return r.json(); }
async function start(id){ const r=await j('/api/start/'+encodeURIComponent(id),{method:'POST'}); if(!r.ok) alert(r.error||'start failed'); refresh(); }
async function stop(id){ await j('/api/stop/'+encodeURIComponent(id),{method:'POST'}); refresh(); }
function toggleLogs(id){ openLogs[id]=!openLogs[id]; render(); }
async function pullLogs(id){ const el=document.getElementById('log-'+id); if(!el) return; const r=await j('/api/logs/'+encodeURIComponent(id)); el.textContent=r.log||''; }
function render(){
  document.getElementById('app').innerHTML = apps.map(a=>{
    const on=a.running, color=on?'#5fd08a':'#4a4f57';
    const openBtn = a.url ? (on
      ? \`<a class="open" href="\${a.url}" target="_blank"><button>↗ Open</button></a>\`
      : \`<button disabled>↗ Open</button>\`) : '';
    return \`<div class="app">
      <div class="top"><span class="dot" style="background:\${color}"></span>
        <span class="name">\${a.name}</span>
        <span class="sub">\${on?('running · '+fmtUp(a.uptimeSec)):'stopped'}\${a.port?(' · :'+a.port):''}</span></div>
      <div class="btns">
        <button class="start" \${on?'disabled':''} onclick="start('\${a.id}')">▶ Start</button>
        <button class="stop" \${on?'':'disabled'} onclick="stop('\${a.id}')">■ Stop</button>
        \${openBtn}
        <button onclick="toggleLogs('\${a.id}')">\${openLogs[a.id]?'Hide logs':'Logs'}</button>
      </div>
      \${openLogs[a.id]?\`<pre class="logs" id="log-\${a.id}"></pre>\`:''}
    </div>\`;
  }).join('');
  for(const a of apps) if(openLogs[a.id]) pullLogs(a.id);
}
async function refresh(){
  try {
    const d=await j('/api/status'); apps=d.apps; render();
    document.getElementById('updated').textContent='updated '+new Date().toLocaleTimeString();
  } catch(e){ document.getElementById('updated').textContent='fetch failed'; }
}
refresh(); setInterval(refresh, 2000);
</script>
</body></html>`;
```

**Verify**: `node --check tooling/cli/local-apps-dashboard/dashboard.mjs` -> exit 0, no output.

### Step 2: Create `tooling/cli/local-apps-dashboard/apps.json`

Write this file **verbatim**:

```json
{
  "port": 4321,
  "apps": [
    {
      "id": "ccusage",
      "name": "ccusage dashboard",
      "cwd": "/Users/kbtg/codebase/personal-stuff/tooling/cli/ccusage-dashboard",
      "start": "node dashboard.mjs",
      "port": 4319,
      "url": "http://localhost:4319"
    },
    {
      "id": "tracker",
      "name": "tutorials-tracker",
      "cwd": "/Users/kbtg/codebase/personal-stuff/apps/tracker-app",
      "start": "npm run seed:local && npm run dev:local",
      "port": 5173,
      "url": "http://localhost:5173/dev-login?email=seankerman25@gmail.com"
    },
    {
      "id": "lists",
      "name": "lists",
      "cwd": "/Users/kbtg/codebase/personal-stuff/apps/lists-app",
      "start": "npm run db:local && npm run dev:local",
      "port": 5173,
      "url": "http://localhost:5173"
    }
  ]
}
```

**Verify**: `node -e "JSON.parse(require('fs').readFileSync('tooling/cli/local-apps-dashboard/apps.json','utf8'));console.log('json ok')"` -> prints `json ok`.

### Step 3: Create `tooling/cli/local-apps-dashboard/README.md` and `CLAUDE.md`

`README.md` (human orientation — keep it plain and factual):

```markdown
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
```

`CLAUDE.md` (how Claude operates here):

```markdown
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
```

**Verify**: `test -f tooling/cli/local-apps-dashboard/README.md && test -f tooling/cli/local-apps-dashboard/CLAUDE.md && echo ok` -> prints `ok`.

### Step 4: Behavior test (start / stop / teardown, end-to-end)

Run this exact script from the repo root. It uses the `ccusage` app because it is
a single zero-dep node process that binds :4319 instantly (no npm install needed).

```bash
cd /Users/kbtg/codebase/personal-stuff/tooling/cli/local-apps-dashboard
# make sure nothing is already on the ports we assert on
lsof -ti :4321 -ti :4319 | xargs kill -9 2>/dev/null || true

node dashboard.mjs & DASH=$!
sleep 1
echo "A status (expect 3 apps, all running:false):"
curl -s localhost:4321/api/status
echo
echo "B start ccusage (expect {\"ok\":true}):"
curl -s -XPOST localhost:4321/api/start/ccusage
echo
sleep 2
echo "C ccusage running (expect running:true for ccusage):"
curl -s localhost:4321/api/status
echo
echo "D ccusage page reachable (expect 200):"
curl -s -o /dev/null -w "%{http_code}\n" localhost:4319
echo "E stop ccusage:"
curl -s -XPOST localhost:4321/api/stop/ccusage
echo
sleep 3
echo "F ccusage page after stop (expect 000 = refused):"
curl -s -o /dev/null -w "%{http_code}\n" localhost:4319
echo "G restart ccusage, then kill the DASHBOARD to test teardown:"
curl -s -XPOST localhost:4321/api/start/ccusage; echo
sleep 2
kill $DASH
sleep 3
echo "H ccusage page after dashboard death (expect 000 = refused, nothing survived):"
curl -s -o /dev/null -w "%{http_code}\n" localhost:4319
lsof -ti :4321 -ti :4319 | xargs kill -9 2>/dev/null || true
```

**Verify** — the assertions that must hold:
- A: JSON lists 3 apps (`ccusage`, `tracker`, `lists`), all `running:false`.
- B: `{"ok":true}`.
- C: `ccusage` shows `running:true`.
- D: `200`.
- F: `000` (connection refused — Stop killed the process group).
- H: `000` (connection refused — teardown reaped the app when the dashboard died).

If D is not `200`, or F/H are not `000`, STOP and report — the process-group
lifecycle is broken and must not be worked around.

### Step 5: (skipped — folded into Step 4)

### Step 6: Replace `apps/local-apps.md` with a stub

Overwrite the whole file with:

```markdown
# Local apps

These local (non-deployed) dev servers now run from the **local-apps dashboard**,
not by pasting commands into terminal tabs.

```bash
node /Users/kbtg/codebase/personal-stuff/tooling/cli/local-apps-dashboard/dashboard.mjs
# then open http://localhost:4321 — Start / Stop / Open per app
```

The registry (how each app is run: dir, command, port, URL) lives in
`tooling/cli/local-apps-dashboard/apps.json`. To add a local app, add one object
there — see that folder's README/CLAUDE.md. Apps run only while the dashboard is
open.
```

**Verify**: `grep -q "local-apps-dashboard" apps/local-apps.md && echo ok` -> prints `ok`.

### Step 7: Update `plans/README.md`

In the status table, change plan 020's row status from `TODO` to `DONE`.

**Verify**: `grep -E "^\| 020 " plans/README.md` -> the row shows `DONE`.

## Test plan

The Step 4 script is the full functional test: it proves Start launches an app,
the app becomes reachable, Stop kills the whole process group (page refused
afterward), and dashboard teardown reaps a running app (page refused after the
dashboard is killed). `node --check` and the JSON parse cover syntax/registry
validity. The `tracker`/`lists` entries are exercised manually by the owner later
(they need `npm install` + wrangler/D1 and are slow); do not block on them.

## Done criteria

- [ ] `node --check tooling/cli/local-apps-dashboard/dashboard.mjs` exits 0.
- [ ] `apps.json` parses as JSON and lists the 3 apps.
- [ ] `README.md` and `CLAUDE.md` exist in the tool folder.
- [ ] Step 4 assertions all hold (D=200, F=000, H=000 in particular).
- [ ] `apps/local-apps.md` is the stub pointing at the dashboard.
- [ ] `plans/README.md` row 020 = `DONE`.
- [ ] `git status` shows ONLY the in-scope paths staged; no `apps/tracker-app/`
      or `apps/lists-app/` files staged.

## STOP conditions

- The Step 4 lifecycle assertions fail (D not 200, or F/H not 000) after placing
  the files verbatim — report; do not rewrite the spawn/kill logic to paper over
  it.
- `git status` would include any `apps/tracker-app/` or `apps/lists-app/` change
  in your commit — STOP; you are staging too broadly. Stage only the in-scope
  paths listed in Git workflow.
- Port :4319 or :4321 cannot be freed for the test (something real is using them)
  — report rather than killing unknown processes.

## Maintenance notes

- Adding a local app = one object in `apps.json` (documented in the folder's
  CLAUDE.md). No code change.
- Multi-port apps (tracker, lists use :5173 **and** :8787) declare only their main
  port for the conflict guard; the guard checks that one port. Fine today.
- Known limitation: if the dashboard is `kill -9`'d (SIGKILL, no handler runs),
  detached apps can be orphaned. Normal quit (Ctrl-C / SIGTERM / close) reaps them
  via the teardown handler. Reaping orphans on next startup is a possible future
  add, not needed now.
- The dashboard re-reads `apps.json` on every request, so registry edits take
  effect on page reload without restarting the dashboard.
