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

// Never throw: a missing/malformed apps.json returns an empty registry plus a
// human-readable error the UI surfaces as a banner, instead of a 500 that breaks
// the whole page.
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
  const reg = loadRegistry();
  const apps = reg.apps.map((a) => {
    const rec = running.get(a.id);
    return {
      id: a.id, name: a.name, url: a.url || null, port: a.port || null,
      running: !!rec,
      uptimeSec: rec ? Math.floor((Date.now() - rec.startedAt) / 1000) : 0,
    };
  });
  return { apps, error: reg.error || null };
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
  .btns { display:flex; gap:8px; margin-top:11px; flex-wrap:wrap; }
  button { background:#1c2027; color:#cfd3da; border:1px solid #2c323b; border-radius:8px; font:inherit; font-size:12px; padding:5px 13px; cursor:pointer; }
  button:hover { background:#2a2f37; }
  button:disabled { opacity:.4; cursor:default; }
  button.start { border-color:#2e5d3f; color:#8fe0aa; }
  button.stop { border-color:#5d2e2e; color:#e59a9a; }
  a.open { text-decoration:none; }
  .logs { margin-top:10px; background:#0a0c0f; border:1px solid #20242b; border-radius:8px; padding:9px 11px; font:11px/1.45 ui-monospace,Menlo,monospace; color:#9aa2ad; white-space:pre-wrap; max-height:220px; overflow:auto; }
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
function render(){
  const banner = regError
    ? \`<div class="banner">Registry problem — <code>\${regError}</code>. Fix or create <code>apps.json</code>; the page recovers on its own.</div>\`
    : '';
  document.getElementById('app').innerHTML = banner + apps.map(a=>{
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
    const d=await j('/api/status'); apps=d.apps; regError=d.error||null; render();
    document.getElementById('updated').textContent='updated '+new Date().toLocaleTimeString();
  } catch(e){ document.getElementById('updated').textContent='fetch failed'; }
}
refresh(); setInterval(refresh, 2000);
</script>
</body></html>`;
