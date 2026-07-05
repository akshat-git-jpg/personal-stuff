#!/usr/bin/env node
// local-apps dashboard — one-click Start/Stop/Open for local dev servers.
// Zero dependencies (Node built-ins only). Start: `node dashboard.mjs`.
//
// Robustness guarantees (so a stale process can never wedge it again):
//  - Start reclaims stale/zombie ports first, so a leftover vite/wrangler cannot
//    block a restart — EXCEPT a port held by another app THIS dashboard is
//    running, which is refused (we never kill a sibling).
//  - A crashed app keeps its logs + exit code so you can see WHY it stopped.
//  - Stop kills the whole process group AND frees the app's ports.
//  - Teardown reaps every app (SIGTERM then SIGKILL) when the dashboard exits.

import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY = join(__dirname, 'apps.json');
const PORT = process.env.PORT || 4321;
const LOG_LINES = 300;

// id -> { child, pid, startedAt, log:[], alive:bool, exit:string|null }
const procs = new Map();

// Never throw: a missing/malformed apps.json returns an empty registry plus a
// human-readable error the UI surfaces as a banner, instead of breaking the page.
function loadRegistry() {
  try {
    const reg = JSON.parse(readFileSync(REGISTRY, 'utf8'));
    if (!Array.isArray(reg.apps)) return { apps: [], error: `apps.json has no "apps" array (${REGISTRY})` };
    return reg;
  } catch (e) {
    const why = e.code === 'ENOENT' ? 'not found' : (e.message || 'unreadable');
    return { apps: [], error: `registry ${why}: ${REGISTRY}` };
  }
}

// Every port an app binds — primary plus any secondary (e.g. wrangler's 8787).
const appPorts = (app) => (app.ports && app.ports.length ? app.ports : (app.port ? [app.port] : []));

// PIDs currently LISTENing on a TCP port (macOS/Linux lsof).
function pidsOnPort(port) {
  const r = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
  return (r.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean).map(Number);
}
// Process-group id of a pid (a detached leader has pgid === its own pid).
function pgidOf(pid) {
  const r = spawnSync('ps', ['-o', 'pgid=', '-p', String(pid)], { encoding: 'utf8' });
  const n = Number((r.stdout || '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}
// pgids of the apps THIS dashboard is currently running.
const managedPgids = () => new Set([...procs.values()].filter((r) => r.alive).map((r) => r.pid));

const isPortReady = (port) => pidsOnPort(port).length > 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pushLog(rec, chunk) {
  for (const line of chunk.toString().split('\n')) rec.log.push(line);
  if (rec.log.length > LOG_LINES) rec.log.splice(0, rec.log.length - LOG_LINES);
}
function killGroup(pid, sig = 'SIGTERM') { try { process.kill(-pid, sig); } catch {} }

async function startApp(app) {
  const cur = procs.get(app.id);
  if (cur && cur.alive) return { ok: false, error: 'already running' };

  const ports = appPorts(app);
  const managed = managedPgids();
  // 1) refuse if a SIBLING app (one we manage) holds any of these ports
  for (const port of ports) {
    for (const pid of pidsOnPort(port)) {
      const pg = pgidOf(pid);
      if (pg && managed.has(pg)) {
        const owner = [...procs.entries()].find(([, r]) => r.alive && r.pid === pg)?.[0];
        return { ok: false, error: `port ${port} is in use by "${owner || 'another app'}" — stop it first` };
      }
    }
  }
  // 2) reclaim any zombie holders (leftovers we don't manage)
  let reclaimed = false;
  for (const port of ports) {
    for (const pid of pidsOnPort(port)) { try { process.kill(pid, 'SIGKILL'); reclaimed = true; } catch {} }
  }
  if (reclaimed) await sleep(800); // let the OS release the sockets

  const child = spawn(app.start, {
    cwd: app.cwd, shell: true, detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    // app.env lets each app declare its own ports (WEB_PORT/API_PORT) etc. so
    // many apps run at once without colliding.
    env: { ...process.env, FORCE_COLOR: '0', ...(app.env || {}) },
  });
  const rec = { child, pid: child.pid, startedAt: Date.now(), log: [], alive: true, exit: null };
  child.stdout.on('data', (d) => pushLog(rec, d));
  child.stderr.on('data', (d) => pushLog(rec, d));
  child.on('exit', (code, signal) => { rec.alive = false; rec.exit = signal ? `signal ${signal}` : `code ${code}`; });
  child.on('error', (e) => { pushLog(rec, `spawn error: ${e.message}`); rec.alive = false; rec.exit = 'spawn error'; });
  procs.set(app.id, rec);
  return { ok: true, reclaimed };
}

function stopApp(id) {
  const rec = procs.get(id);
  if (!rec || !rec.alive) return { ok: false, error: 'not running' };
  killGroup(rec.pid, 'SIGTERM');
  setTimeout(() => killGroup(rec.pid, 'SIGKILL'), 3000);
  // belt-and-suspenders: free the app's ports so nothing lingers
  const app = loadRegistry().apps.find((a) => a.id === id);
  if (app) setTimeout(() => {
    for (const port of appPorts(app)) for (const pid of pidsOnPort(port)) { try { process.kill(pid, 'SIGKILL'); } catch {} }
  }, 1200);
  rec.alive = false; rec.exit = 'stopped';
  return { ok: true };
}

function statusList() {
  const reg = loadRegistry();
  const apps = reg.apps.map((a) => {
    const rec = procs.get(a.id);
    const alive = !!rec && rec.alive;
    const ports = appPorts(a);
    const ready = alive ? (ports.length ? ports.every(isPortReady) : true) : false;
    return {
      id: a.id, name: a.name, url: a.url || null, port: a.port || (ports[0] || null),
      running: alive, ready,
      uptimeSec: alive ? Math.floor((Date.now() - rec.startedAt) / 1000) : 0,
      exited: rec && !rec.alive ? rec.exit : null, // "stopped" (clean) or "code N"/"signal X" (crash)
    };
  });
  return { apps, error: reg.error || null };
}

// ---- teardown: nothing survives the dashboard --------------------------------
let tearingDown = false;
function teardown() {
  if (tearingDown) return;
  tearingDown = true;
  for (const [, rec] of procs) if (rec.alive) killGroup(rec.pid, 'SIGTERM');
  setTimeout(() => {
    for (const [, rec] of procs) if (rec.alive) killGroup(rec.pid, 'SIGKILL');
    process.exit(0);
  }, 800);
}
process.on('SIGINT', teardown);
process.on('SIGTERM', teardown);
process.on('SIGHUP', teardown);
process.on('exit', () => { for (const [, rec] of procs) if (rec.alive) killGroup(rec.pid, 'SIGKILL'); });

// ---- HTTP -------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(obj));
  };
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === '/api/status') return send(200, statusList());
    if (req.method === 'POST' && url.pathname.startsWith('/api/start/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/start/'.length));
      const reg = loadRegistry();
      if (reg.error) return send(500, { ok: false, error: reg.error });
      const app = reg.apps.find((a) => a.id === id);
      if (!app) return send(404, { ok: false, error: 'unknown app' });
      return send(200, await startApp(app));
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/stop/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/stop/'.length));
      return send(200, stopApp(id));
    }
    if (url.pathname.startsWith('/api/logs/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/logs/'.length));
      const rec = procs.get(id);
      return send(200, { log: rec ? rec.log.join('\n') : '(no logs — never started)' });
    }
  } catch (e) { return send(500, { ok: false, error: e.message }); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(HTML);
});

server.listen(PORT, () => {
  console.log(`\n  local-apps dashboard → http://localhost:${PORT}`);
  console.log(`  registry: ${REGISTRY}`);
  console.log(`  Apps run only while this dashboard is open. Ctrl-C stops everything.\n`);
  // one-click: open the page in the default browser (macOS `open`). NO_OPEN=1 skips it.
  if (!process.env.NO_OPEN) {
    try { spawn('open', [`http://localhost:${PORT}`], { stdio: 'ignore', detached: true }).unref(); } catch {}
  }
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
  .sub.err { color:#e59a9a; }
  .btns { display:flex; gap:8px; margin-top:11px; flex-wrap:wrap; }
  button { background:#1c2027; color:#cfd3da; border:1px solid #2c323b; border-radius:8px; font:inherit; font-size:12px; padding:5px 13px; cursor:pointer; }
  button:hover { background:#2a2f37; }
  button:disabled { opacity:.4; cursor:default; }
  button.start { border-color:#2e5d3f; color:#8fe0aa; }
  button.stop { border-color:#5d2e2e; color:#e59a9a; }
  a.open { text-decoration:none; }
  .logs { margin-top:10px; background:#0a0c0f; border:1px solid #20242b; border-radius:8px; padding:9px 11px; font:11px/1.45 ui-monospace,Menlo,monospace; color:#9aa2ad; white-space:pre-wrap; max-height:240px; overflow:auto; }
  .banner { background:#2a1c1c; border:1px solid #5d2e2e; color:#e59a9a; border-radius:10px; padding:11px 14px; margin-bottom:14px; font-size:12.5px; }
  .banner code { color:#f0c0c0; font-family:ui-monospace,Menlo,monospace; }
</style></head><body>
<header>
  <h1>Local apps</h1>
  <div class="meta"><span id="updated">loading…</span> · auto-refresh 2s · apps stop when you quit the dashboard</div>
</header>
<div class="wrap" id="app"></div>
<script>
let apps=[], regError=null, openLogs={};
const fmtUp = s => { if(!s) return ''; if(s<60) return s+'s'; const m=Math.floor(s/60); if(m<60) return m+'m '+(s%60)+'s'; return Math.floor(m/60)+'h '+(m%60)+'m'; };
async function j(url,opts){ const r=await fetch(url,{cache:'no-store',...opts}); return r.json(); }
async function start(id){ const r=await j('/api/start/'+encodeURIComponent(id),{method:'POST'}); if(!r.ok) alert(r.error||'start failed'); refresh(); }
async function stop(id){ await j('/api/stop/'+encodeURIComponent(id),{method:'POST'}); refresh(); }
function toggleLogs(id){ openLogs[id]=!openLogs[id]; render(); }
async function pullLogs(id){ const el=document.getElementById('log-'+id); if(!el) return; const r=await j('/api/logs/'+encodeURIComponent(id)); el.textContent=r.log||''; }
function statusText(a){
  if(a.running && a.ready) return { t:'running · '+fmtUp(a.uptimeSec)+(a.port?' · :'+a.port:''), cls:'' };
  if(a.running && !a.ready) return { t:'starting…', cls:'' };
  if(a.exited && a.exited!=='stopped') return { t:'exited ('+a.exited+') — see Logs', cls:'err' };
  return { t:'stopped'+(a.port?' · :'+a.port:''), cls:'' };
}
function dotColor(a){
  if(a.running && a.ready) return '#5fd08a';        // green: up and serving
  if(a.running && !a.ready) return '#e0b24a';        // amber: starting
  if(a.exited && a.exited!=='stopped') return '#e0574d'; // red: crashed
  return '#4a4f57';                                  // gray: stopped
}
function render(){
  const banner = regError
    ? \`<div class="banner">Registry problem — <code>\${regError}</code>. Fix or create <code>apps.json</code>; the page recovers on its own.</div>\`
    : '';
  document.getElementById('app').innerHTML = banner + apps.map(a=>{
    const on=a.running, canOpen=a.running&&a.ready;
    const st=statusText(a);
    const openBtn = a.url ? (canOpen
      ? \`<a class="open" href="\${a.url}" target="_blank"><button>↗ Open</button></a>\`
      : \`<button disabled>↗ Open</button>\`) : '';
    return \`<div class="app">
      <div class="top"><span class="dot" style="background:\${dotColor(a)}"></span>
        <span class="name">\${a.name}</span>
        <span class="sub \${st.cls}">\${st.t}</span></div>
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
    const d=await j('/api/status'); apps=d.apps; regError=d.error||null; render();
    document.getElementById('updated').textContent='updated '+new Date().toLocaleTimeString();
  } catch(e){ document.getElementById('updated').textContent='fetch failed'; }
}
refresh(); setInterval(refresh, 2000);
</script>
</body></html>`;
