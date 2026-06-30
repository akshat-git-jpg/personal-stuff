#!/usr/bin/env node
// ccusage dashboard v2 — overview-first local view of Claude Code usage (work + personal).
// Zero dependencies (Node built-ins only). Start: `node dashboard.mjs`, open the printed URL.

import http from 'node:http';
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

const PORT = process.env.PORT || 4319;
const CCUSAGE = process.env.CCUSAGE_BIN || `${homedir()}/.npm-global/bin/ccusage`;
const CACHE_TTL_MS = 8000;

const SCOPES = [
  { id: 'work', label: 'Work', dir: `${homedir()}/.claude-work`, accent: '#5aa0e8' },
  { id: 'personal', label: 'Personal', dir: `${homedir()}/.claude-personal`, accent: '#5fd08a' },
  { id: 'all', label: 'Total', dir: `${homedir()}/.claude-work,${homedir()}/.claude-personal`, accent: '#cbb46a' },
];

// ---- ccusage + helpers ------------------------------------------------------
async function runCcusage(args, dir) {
  const { stdout } = await execFileP(CCUSAGE, [...args, '--json'], {
    env: { ...process.env, CLAUDE_CONFIG_DIR: dir, FORCE_COLOR: '0', NO_COLOR: '1' },
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

// ---- Plan limits (account-wide, server-side `/usage` data) -------------------
// Claude Code stores OAuth creds in the macOS Keychain under
// `Claude Code-credentials-<sha256(configDir)[:8]>`. The same token can read the
// live subscription rate-limit state — the 5-hour + weekly windows that `/usage`
// shows. This is account-level (every device/surface), unlike the local ccusage
// cost data below which only sees this machine's transcripts. Read-only: on a
// 401/expired token we surface a message rather than refreshing (refreshing from
// outside Claude Code would rotate the refresh token and desync its own copy).
const credSuffix = (dir) => createHash('sha256').update(dir).digest('hex').slice(0, 8);

async function fetchUsage(dir) {
  let raw;
  try {
    ({ stdout: raw } = await execFileP('security',
      ['find-generic-password', '-s', `Claude Code-credentials-${credSuffix(dir)}`, '-w'], { timeout: 4000 }));
  } catch { return { error: 'no credentials in keychain' }; }
  let oa;
  try { const t = JSON.parse(raw.trim()); oa = t.claudeAiOauth || t; } catch { return { error: 'unreadable credentials' }; }
  const token = oa.accessToken;
  const plan = oa.subscriptionType || null;
  if (!token) return { error: 'no access token', plan };
  if (oa.expiresAt && oa.expiresAt < Date.now()) return { error: 'token expired — open Claude to refresh', plan };
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 15000);
    const r = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20', 'Content-Type': 'application/json' },
      signal: ac.signal,
    });
    clearTimeout(to);
    if (r.status === 401) return { error: 'token expired — open Claude to refresh', plan };
    if (!r.ok) return { error: `HTTP ${r.status}`, plan };
    return { plan, ...(await r.json()) };
  } catch (e) { return { error: e.name === 'AbortError' ? 'timeout' : (e.message || 'fetch failed').slice(0, 80), plan }; }
}

const localDateStr = (d = new Date()) => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
function weekStartStr() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDateStr(d);
}
const shortModel = (m = '') => m.replace('claude-', '').replace(/-\d{8}$/, '');

function summarize(daily) {
  const arr = daily?.daily || [];
  const today = localDateStr(), wk = weekStartStr(), mon = today.slice(0, 7);
  const acc = (pred) => arr.reduce((a, e) => pred(e.period)
    ? { cost: a.cost + (e.totalCost || 0), tokens: a.tokens + (e.totalTokens || 0) } : a, { cost: 0, tokens: 0 });
  return {
    today: acc((p) => p === today),
    week: acc((p) => p >= wk),
    month: acc((p) => p.startsWith(mon)),
    total: { cost: daily?.totals?.totalCost || 0, tokens: daily?.totals?.totalTokens || 0 },
    trend: arr.slice(-90).map((e) => ({ date: e.period, cost: e.totalCost || 0 })),
  };
}

const INPUT_PRICE = {
  'claude-fable-5': 10, 'claude-mythos-5': 10,
  'claude-opus-4-8': 5, 'claude-opus-4-7': 5, 'claude-opus-4-6': 5, 'claude-opus-4-5': 5,
  'claude-sonnet-4-6': 3, 'claude-sonnet-4-5': 3, 'claude-haiku-4-5': 1,
};
function inputPrice(m = '') {
  if (INPUT_PRICE[m]) return INPUT_PRICE[m];
  if (m.includes('fable') || m.includes('mythos')) return 10;
  if (m.includes('opus')) return 5;
  if (m.includes('sonnet')) return 3;
  if (m.includes('haiku')) return 1;
  return 5;
}

function cacheStats(daily) {
  const t = daily?.totals || {};
  const read = t.cacheReadTokens || 0, write = t.cacheCreationTokens || 0, input = t.inputTokens || 0;
  let savings = 0;
  for (const e of daily?.daily || [])
    for (const m of e.modelBreakdowns || []) {
      const p = inputPrice(m.modelName) / 1e6;
      savings += ((m.cacheReadTokens || 0) * 0.9 - (m.cacheCreationTokens || 0) * 0.25) * p;
    }
  return { read, write, input, hitRate: read + write ? read / (read + write) : 0, savings };
}

function modelBreakdown(daily) {
  const m = {};
  for (const e of daily?.daily || [])
    for (const b of e.modelBreakdowns || []) m[b.modelName] = (m[b.modelName] || 0) + (b.cost || 0);
  const tot = Object.values(m).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(m).map(([model, cost]) => ({ model: shortModel(model), cost, pct: 100 * cost / tot }))
    .sort((a, b) => b.cost - a.cost);
}

// scan project dirs: uuid -> short project label, and uuid -> transcript path
function scanProjects(dirs) {
  const encHome = homedir().replace(/\//g, '-');
  const label = (n) => (n.startsWith(encHome) ? n.slice(encHome.length) : n).replace(/^-/, '').replace(/^codebase-/, '') || n;
  const project = {}, path = {};
  for (const base of dirs) {
    const root = `${base}/projects`;
    let ds = [];
    try { ds = readdirSync(root, { withFileTypes: true }); } catch { continue; }
    for (const d of ds) {
      if (!d.isDirectory()) continue;
      const lbl = label(d.name);
      let files = [];
      try { files = readdirSync(`${root}/${d.name}`); } catch { continue; }
      for (const f of files) if (f.endsWith('.jsonl')) { const u = f.slice(0, -6); project[u] = lbl; path[u] = `${root}/${d.name}/${f}`; }
    }
  }
  return { project, path };
}

// pull the session's /rename (or auto) title from the last ai-title line of its transcript
function titleFor(fp) {
  if (!fp) return null;
  try {
    const txt = readFileSync(fp, 'utf8');
    const i = txt.lastIndexOf('"type":"ai-title"');
    if (i < 0) return null;
    const start = txt.lastIndexOf('\n', i) + 1;
    let end = txt.indexOf('\n', i); if (end < 0) end = txt.length;
    return JSON.parse(txt.slice(start, end)).aiTitle || null;
  } catch { return null; }
}

function projectBreakdown(session, pmap, n = 6) {
  const agg = {};
  for (const s of session?.session || []) { const p = pmap[s.period] || 'other'; agg[p] = (agg[p] || 0) + (s.totalCost || 0); }
  return Object.entries(agg).map(([project, cost]) => ({ project, cost })).sort((a, b) => b.cost - a.cost).slice(0, n);
}

function recentSessions(session, scan, n = 6) {
  const arr = (session?.session || []).slice()
    .sort((a, b) => new Date(b.metadata?.lastActivity || 0) - new Date(a.metadata?.lastActivity || 0)).slice(0, n);
  return arr.map((s) => ({
    name: titleFor(scan.path[s.period]),
    project: scan.project[s.period] || '—',
    cost: s.totalCost || 0,
    model: (s.modelsUsed || []).map(shortModel).join(', '),
    last: s.metadata?.lastActivity || null,
  }));
}

function activeBlock(blocks) {
  const b = (blocks?.blocks || []).find((x) => x.isActive);
  if (!b) return null;
  return {
    cost: b.costUSD || 0,
    projectedCost: b.projection?.totalCost ?? null,
    remainingMin: b.projection?.remainingMinutes ?? null,
    costPerHour: b.burnRate?.costPerHour ?? null,
  };
}

async function rtkGain() {
  try {
    const { stdout } = await execFileP('rtk', ['gain', '-f', 'json'], { timeout: 4000 });
    const s = JSON.parse(stdout).summary || {};
    return { saved: s.total_saved || 0, pct: s.avg_savings_pct || 0, commands: s.total_commands || 0 };
  } catch { return null; }
}

const z = () => ({ cost: 0, tokens: 0 });

async function scopeData(scope) {
  try {
    const [daily, blocks, session] = await Promise.all([
      runCcusage(['daily'], scope.dir),
      runCcusage(['blocks', '--active'], scope.dir).catch(() => ({ blocks: [] })),
      runCcusage(['session'], scope.dir).catch(() => ({ session: [] })),
    ]);
    const scan = scanProjects(scope.dir.split(','));
    const sess = session?.session || [];
    const avgSession = sess.length ? sess.reduce((a, s) => a + (s.totalCost || 0), 0) / sess.length : 0;
    return {
      ...scope, ...summarize(daily), cache: cacheStats(daily),
      models: modelBreakdown(daily), projects: projectBreakdown(session, scan.project),
      sessions: recentSessions(session, scan), avgSession, sessionCount: sess.length,
      active: activeBlock(blocks), error: null,
    };
  } catch (err) {
    return {
      ...scope, error: err.message?.slice(0, 200) || 'failed', today: z(), week: z(), month: z(), total: z(),
      trend: [], cache: null, models: [], projects: [], sessions: [], avgSession: 0, sessionCount: 0, active: null,
    };
  }
}

// Plan limits are fetched separately — only on manual refresh, never on the 15s
// auto-poll. The /api/oauth/usage endpoint is built for the human-triggered
// `/usage` command, so polling it every 15s for two accounts trips its rate
// limit (HTTP 429). A short TTL just de-dupes rapid double-clicks.
const USAGE_TTL_MS = 5000;
let usageCache = { at: 0, data: null, inflight: null };
async function getUsage() {
  if (usageCache.data && Date.now() - usageCache.at < USAGE_TTL_MS) return usageCache.data;
  if (usageCache.inflight) return usageCache.inflight;
  usageCache.inflight = Promise.all(
    SCOPES.filter((s) => s.id !== 'all').map(async (s) =>
      [s.id, await fetchUsage(s.dir).catch((e) => ({ error: e.message?.slice(0, 80) || 'failed' }))]),
  ).then((entries) => {
    const data = { fetchedAt: new Date().toISOString(), usage: Object.fromEntries(entries) };
    usageCache = { at: Date.now(), data, inflight: null };
    return data;
  }).catch((e) => { usageCache.inflight = null; throw e; });
  return usageCache.inflight;
}

function buildInsights(scopes, rtk) {
  const t = scopes.find((s) => s.id === 'all') || {};
  const out = [];
  if (t.models?.length) {
    const top = t.models[0], fable = t.models.find((m) => m.model.includes('fable'));
    out.push({ tone: 'info', text: `${top.model} is ${top.pct.toFixed(0)}% of spend.` + (fable ? ` Fable is ${fable.pct.toFixed(0)}% ($${fable.cost.toFixed(0)}) — routine work on Opus would be cheaper.` : ' No pricey-model concentration to trim.') });
  }
  if (t.cache) {
    const hr = 100 * t.cache.hitRate;
    out.push({ tone: hr >= 90 ? 'good' : 'warn', text: `Cache hit ${hr.toFixed(0)}% — ${hr >= 90 ? 'healthy, no action needed' : 'low; long idle gaps may be expiring the 5-min cache'}. Saved ~$${t.cache.savings.toFixed(0)} vs no caching.` });
  }
  if (rtk) out.push({ tone: 'info', text: rtk.commands ? `rtk: ${rtk.pct.toFixed(0)}% saved across ${rtk.commands} bash command${rtk.commands === 1 ? '' : 's'} (${(rtk.saved / 1e3).toFixed(1)}k tokens). Grows as you use Claude.` : 'rtk installed — savings appear here after Claude runs some bash commands.' });
  if (t.projects?.length) out.push({ tone: 'info', text: `Top cost projects: ${t.projects.slice(0, 3).map((p) => `${p.project} ($${p.cost.toFixed(0)})`).join(' · ')}.` });
  if (t.avgSession) out.push({ tone: 'info', text: `Avg session cost: $${t.avgSession.toFixed(2)} across ${t.sessionCount} sessions.` });
  return out;
}

let cache = { at: 0, data: null, inflight: null };
async function getData() {
  if (cache.data && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  if (cache.inflight) return cache.inflight;
  cache.inflight = Promise.all([Promise.all(SCOPES.map(scopeData)), rtkGain()]).then(([scopes, rtk]) => {
    const data = { generatedAt: new Date().toISOString(), scopes, rtk, insights: buildInsights(scopes, rtk) };
    cache = { at: Date.now(), data, inflight: null };
    return data;
  }).catch((e) => { cache.inflight = null; throw e; });
  return cache.inflight;
}

// ---- HTTP -------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/usage')) {
    try {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(await getUsage()));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }
  if (req.url.startsWith('/api/data')) {
    try {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(await getData()));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(HTML);
});

server.listen(PORT, () => {
  console.log(`\n  ccusage dashboard → http://localhost:${PORT}`);
  console.log(`  reads: work (~/.claude-work) · personal (~/.claude-personal)`);
  console.log(`  Ctrl-C to stop.\n`);
});

// ---- Front-end --------------------------------------------------------------
const HTML = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claude usage</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; background:#0d0f12; color:#e6e8eb; font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif; }
  header { display:flex; align-items:baseline; justify-content:space-between; padding:18px 26px 4px; }
  header h1 { font-size:16px; font-weight:600; margin:0; }
  header .meta { font-size:12px; color:#8b929b; }
  .wrap { padding:10px 26px 36px; max-width:1180px; }
  .sec-h { font-size:11px; text-transform:uppercase; letter-spacing:.7px; color:#7b828c; margin:22px 2px 10px; }
  /* KPI strip */
  .kpis { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; }
  @media (max-width:820px){ .kpis{ grid-template-columns:repeat(2,1fr); } }
  .kpi { background:#15181d; border:1px solid #20242b; border-radius:12px; padding:13px 15px; }
  .kpi .k { font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#7b828c; }
  .kpi .v { font-size:22px; font-weight:700; margin-top:3px; }
  .kpi .s { font-size:11px; color:#8b929b; margin-top:1px; }
  /* account cards */
  .accts { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
  @media (max-width:820px){ .accts{ grid-template-columns:1fr; } }
  .acct { background:#15181d; border:1px solid #20242b; border-radius:12px; padding:14px 15px; }
  .acct h3 { font-size:12px; font-weight:600; margin:0 0 10px; display:flex; align-items:center; gap:7px; text-transform:uppercase; letter-spacing:.5px; }
  .dot { width:8px; height:8px; border-radius:50%; }
  .twrow { display:flex; gap:14px; }
  .twrow div { flex:1; }
  .twrow .k { font-size:9px; text-transform:uppercase; letter-spacing:.4px; color:#7b828c; }
  .twrow .v { font-size:16px; font-weight:650; }
  .acct .foot { margin-top:9px; padding-top:8px; border-top:1px dashed #262b33; font-size:11px; color:#9aa2ad; display:flex; flex-direction:column; gap:3px; }
  .acct .foot b { color:#e6e8eb; font-weight:600; }
  /* insights */
  .insights { background:#15181d; border:1px solid #20242b; border-radius:12px; padding:6px 16px; }
  .insights .i { display:flex; gap:9px; align-items:baseline; padding:8px 0; border-bottom:1px solid #1c2027; font-size:12.5px; color:#cfd3da; }
  .insights .i:last-child { border-bottom:none; }
  .insights .i i { width:7px; height:7px; border-radius:50%; flex:0 0 auto; transform:translateY(5px); }
  /* detail */
  .toggle { display:inline-flex; gap:5px; margin-left:10px; }
  .toggle button { background:#1c2027; color:#9aa2ad; border:1px solid #262b33; border-radius:7px; font:inherit; font-size:11px; padding:3px 10px; cursor:pointer; }
  .toggle button.on { background:#2a2f37; color:#e6e8eb; }
  .detail { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  @media (max-width:820px){ .detail{ grid-template-columns:1fr; } }
  .panel { background:#15181d; border:1px solid #20242b; border-radius:12px; padding:14px 15px; }
  .panel .hd { font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#7b828c; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; }
  .row { display:grid; grid-template-columns:1fr auto; gap:8px; align-items:baseline; font-size:12px; color:#cfd3da; padding:1px 0; }
  .row .sub { color:#7b828c; font-size:11px; }
  .row b { font-weight:650; color:#e6e8eb; }
  .mbar { height:5px; border-radius:3px; background:#1c2027; overflow:hidden; margin:2px 0 7px; }
  .mbar > div { height:100%; }
  .trow { display:grid; grid-template-columns:44px 1fr 52px; align-items:center; gap:8px; font-size:11px; color:#9aa2ad; padding:1px 0; }
  .trow .tbar { height:8px; border-radius:3px; }
  .trow b { color:#e6e8eb; text-align:right; font-weight:600; }
  .err { color:#e06a6a; font-size:12px; }
  .idle { color:#6b7280; font-size:12px; }
  /* scope tags — make the data source unmistakable */
  .sec-h { display:flex; align-items:center; }
  .scopetag { font-size:9px; font-weight:600; letter-spacing:.3px; padding:2px 8px; border-radius:20px; margin-left:9px; text-transform:none; }
  .scopetag.wide { background:rgba(90,160,232,.15); color:#7db4ee; border:1px solid rgba(90,160,232,.35); }
  .scopetag.local { background:rgba(203,180,106,.13); color:#cbb46a; border:1px solid rgba(203,180,106,.35); }
  /* plan-limit cards */
  .limits .acct { display:flex; flex-direction:column; gap:11px; }
  .limits h3 { margin-bottom:2px; }
  .planbadge { margin-left:auto; font-size:9px; font-weight:600; color:#9aa2ad; background:#1c2027; border:1px solid #2c323b; padding:1px 8px; border-radius:20px; letter-spacing:.4px; }
  .lhd { display:flex; justify-content:space-between; align-items:baseline; font-size:11.5px; color:#cfd3da; margin-bottom:4px; }
  .lhd b { font-weight:700; font-variant-numeric:tabular-nums; }
  .lbar { height:8px; border-radius:5px; background:#1c2027; overflow:hidden; }
  .lbar > div { height:100%; border-radius:5px; transition:width .35s ease; }
  .lreset { font-size:10.5px; color:#7b828c; margin-top:3px; }
  .lextra { font-size:11px; color:#9aa2ad; padding-top:9px; border-top:1px dashed #262b33; }
  .lnote { font-size:10.5px; color:#6b7280; margin:-4px 2px 0; }
  .refreshbtn { margin-left:auto; background:#1c2027; color:#cfd3da; border:1px solid #2c323b; border-radius:7px; font:inherit; font-size:11px; padding:3px 11px; cursor:pointer; text-transform:none; letter-spacing:0; }
  .refreshbtn:hover { background:#2a2f37; }
  .refreshbtn:disabled { opacity:.6; cursor:default; }
  .lstamp { font-size:10.5px; color:#7b828c; margin-left:10px; text-transform:none; letter-spacing:0; font-weight:400; }
</style></head><body>
<header>
  <h1>Claude usage</h1>
  <div class="meta"><span id="updated">loading…</span> · auto-refresh 15s</div>
</header>
<div class="wrap" id="app"></div>
<script>
const fmtC = n => '$' + (n||0).toFixed(2);
const fmtC0 = n => '$' + Math.round(n||0);
const fmtT = n => { n=n||0; if(n>=1e9)return (n/1e9).toFixed(2)+'B'; if(n>=1e6)return (n/1e6).toFixed(1)+'M'; if(n>=1e3)return (n/1e3).toFixed(1)+'k'; return ''+n; };
const fmtMin = m => m==null?'—':(m>=60?Math.floor(m/60)+'h '+(m%60)+'m':m+'m');
const fmtAge = iso => { if(!iso)return''; const m=Math.floor((Date.now()-new Date(iso).getTime())/60000); if(m<60)return m+'m'; const h=Math.floor(m/60); if(h<24)return h+'h'; return Math.floor(h/24)+'d'; };
const TONE = { good:'#5fd08a', warn:'#e0b24a', info:'#5aa0e8' };
const cap = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : '';
const limitColor = p => p>=90?'#e0574d' : p>=70?'#e0b24a' : '#5fd08a';
function fmtResetIn(iso){
  if(!iso) return null;
  const ms=new Date(iso).getTime()-Date.now();
  if(ms<=0) return 'now';
  const m=Math.floor(ms/60000); if(m<60) return 'in '+m+'m';
  const h=Math.floor(m/60); if(h<24) return 'in '+h+'h '+(m%60)+'m';
  return 'in '+Math.floor(h/24)+'d '+(h%24)+'h';
}
function limitBar(label, win){
  if(!win || win.utilization==null) return '';
  const p=Math.round(win.utilization), c=limitColor(p), reset=fmtResetIn(win.resets_at);
  return \`<div class="lrow">
    <div class="lhd"><span>\${label}</span><b style="color:\${c}">\${p}%</b></div>
    <div class="lbar"><div style="width:\${Math.min(100,Math.max(2,p))}%;background:\${c}"></div></div>
    \${reset?\`<div class="lreset">resets \${reset}</div>\`:''}
  </div>\`;
}
function limitCard(s, u){
  const plan=cap(u?.plan);
  const head=\`<h3><span class="dot" style="background:\${s.accent}"></span>\${s.label}\${plan?\`<span class="planbadge">\${plan}</span>\`:''}</h3>\`;
  if(!u) return \`<div class="acct">\${head}<div class="idle">not loaded — click ↻ refresh</div></div>\`;
  if(u.error) return \`<div class="acct">\${head}<div class="\${u.error.includes('expired')?'err':'idle'}">\${u.error}</div></div>\`;
  let bars = limitBar('5-hour session', u.five_hour) + limitBar('Weekly — all usage', u.seven_day)
    + limitBar('Weekly — Opus', u.seven_day_opus) + limitBar('Weekly — Sonnet', u.seven_day_sonnet);
  if(!bars) bars='<div class="idle">no active limits reported</div>';
  let extra='';
  if(u.extra_usage?.is_enabled){
    const e=u.extra_usage, p=e.utilization==null?null:Math.round(e.utilization);
    extra=\`<div class="lextra">Extra credits\${p!=null?' — <b style="color:'+limitColor(p)+'">'+p+'%</b> of':''} \${e.currency==='USD'?'$':''}\${e.monthly_limit??'?'} used</div>\`;
  }
  return \`<div class="acct">\${head}\${bars}\${extra}</div>\`;
}
function planLimitsSection(d){
  const accts=d.scopes.filter(s=>s.id!=='all');
  if(!accts.length) return '';
  const btn=\`<button class="refreshbtn" onclick="loadUsage()" \${usageLoading?'disabled':''}>\${usageLoading?'refreshing…':'↻ refresh'}</button>\`;
  const stamp=\`<span class="lstamp">\${usageData?.fetchedAt?'updated '+new Date(usageData.fetchedAt).toLocaleTimeString():'not loaded'}</span>\`;
  return '<div class="sec-h">🎯 Plan limits <span class="scopetag wide">account-wide · counts every device (laptop · VPS · mobile · web)</span>'+btn+stamp+'</div>'
    + '<div class="lnote">How close each Claude account is to its plan ceiling, and when each window resets. Manual refresh only — not auto-polled (the usage endpoint rate-limits frequent polling).</div>'
    + '<div class="accts limits">'+accts.map(s=>limitCard(s, usageData?.usage?.[s.id])).join('')+'</div>';
}

let lastData=null, selScope='all', trendDays=14, usageData=null, usageLoading=false;
const getScope = id => lastData.scopes.find(s=>s.id===id) || {};
function setScope(id){ selScope=id; render(); }
function setTrend(n){ trendDays=n; render(); }

function kpiStrip(d){
  const t=getScope('all'), a=t.active, c=t.cache, rtk=d.rtk;
  const kpi=(k,v,s)=>\`<div class="kpi"><div class="k">\${k}</div><div class="v">\${v}</div><div class="s">\${s||''}</div></div>\`;
  return '<div class="kpis">'
    + kpi('This month', fmtC0(t.month?.cost), 'today '+fmtC(t.today?.cost))
    + kpi('All-time', fmtC0(t.total?.cost), (t.sessionCount||0)+' sessions')
    + kpi('Active block', a?fmtC(a.cost):'idle', a?('proj '+fmtC(a.projectedCost)+' · '+fmtMin(a.remainingMin)+' left'):'no active session')
    + kpi('Cache hit', c?(100*c.hitRate).toFixed(0)+'%':'—', c?('saved ~'+fmtC0(c.savings)):'')
    + kpi('rtk saved', rtk?(rtk.pct.toFixed(0)+'%'):'—', rtk?(fmtT(rtk.saved)+' tok · '+rtk.commands+' cmds'):'pending')
    + '</div>';
}

function acctCard(s){
  if(s.error) return \`<div class="acct"><h3><span class="dot" style="background:\${s.accent}"></span>\${s.label}</h3><div class="err">\${s.error}</div></div>\`;
  const a=s.active, c=s.cache;
  const tw=(k,o)=>\`<div><div class="k">\${k}</div><div class="v">\${fmtC(o.cost)}</div></div>\`;
  return \`<div class="acct"><h3><span class="dot" style="background:\${s.accent}"></span>\${s.label}</h3>
    <div class="twrow">\${tw('Today',s.today)}\${tw('Week',s.week)}\${tw('Month',s.month)}</div>
    <div class="foot">
      <span>All-time <b>\${fmtC(s.total.cost)}</b> · avg/session <b>\${fmtC(s.avgSession)}</b></span>
      <span>Active block: \${a?('<b>'+fmtC(a.cost)+'</b> → '+fmtC(a.projectedCost)+', '+fmtMin(a.remainingMin)+' left'):'<span class="idle">idle</span>'}</span>
      <span>Cache hit <b>\${c?(100*c.hitRate).toFixed(0)+'%':'—'}</b></span>
    </div></div>\`;
}

function insightsPanel(d){
  if(!d.insights?.length) return '';
  const rows=d.insights.map(i=>\`<div class="i"><i style="background:\${TONE[i.tone]||TONE.info}"></i><span>\${i.text}</span></div>\`).join('');
  return '<div class="sec-h">💡 Optimization insights</div><div class="insights">'+rows+'</div>';
}

function barList(title, items, accent, key, withPct){
  if(!items?.length) return '<div class="idle">no data</div>';
  const max=Math.max(...items.map(i=>i.cost),0.0001);
  return items.map(i=>{
    const w=Math.max(3,(i.cost/max)*100);
    const lbl = withPct ? \`\${i[key]} <span class="sub">\${i.pct.toFixed(0)}%</span>\` : i[key];
    return \`<div class="row"><span>\${lbl}</span><b>\${fmtC(i.cost)}</b></div><div class="mbar"><div style="width:\${w}%;background:\${accent}"></div></div>\`;
  }).join('');
}

function trendList(full, accent){
  if(!full?.length) return '<div class="idle">no data</div>';
  const trend=full.slice(-trendDays), max=Math.max(...trend.map(t=>t.cost),0.0001);
  return trend.map(t=>{
    const w=Math.max(2,(t.cost/max)*100);
    return \`<div class="trow"><span>\${t.date.slice(5)}</span><div class="tbar" style="width:\${w}%;background:\${accent}"></div><b>\${fmtC(t.cost)}</b></div>\`;
  }).join('');
}

function sessionsList(items){
  if(!items?.length) return '<div class="idle">no sessions</div>';
  return items.map(s=>{
    const title = s.name || s.project;
    const sub = (s.name && s.project!=='—' ? s.project+' · ' : '') + s.model;
    return \`<div class="row"><span>\${title} <span class="sub">\${sub}</span></span><b>\${fmtC(s.cost)} <span class="sub">\${fmtAge(s.last)}</span></b></div>\`;
  }).join('');
}

function detailPanel(d){
  const tog = '<span class="toggle">'+d.scopes.map(s=>\`<button class="\${s.id===selScope?'on':''}" onclick="setScope('\${s.id}')">\${s.label}</button>\`).join('')+'</span>';
  const s=getScope(selScope), ac=s.accent;
  const ttog='<span class="toggle">'+[14,30,90].map(n=>\`<button class="\${n===trendDays?'on':''}" onclick="setTrend(\${n})">\${n}d</button>\`).join('')+'</span>';
  return '<div class="sec-h">🔍 Detail '+tog+'</div><div class="detail">'
    + \`<div class="panel"><div class="hd">By model</div>\${barList('',s.models,ac,'model',true)}</div>\`
    + \`<div class="panel"><div class="hd">By project</div>\${barList('',s.projects,ac,'project',false)}</div>\`
    + \`<div class="panel"><div class="hd">Daily trend \${ttog}</div>\${trendList(s.trend,ac)}</div>\`
    + \`<div class="panel"><div class="hd">Recent sessions</div>\${sessionsList(s.sessions)}</div>\`
    + '</div>';
}

function render(){
  if(!lastData) return;
  document.getElementById('app').innerHTML =
    planLimitsSection(lastData)
    + '<div class="sec-h">💻 Cost &amp; tokens <span class="scopetag local">this laptop only · local Claude Code sessions</span></div>'
    + '<div class="lnote">Dollar estimates from transcripts on this Mac — does not include the VPS, mobile, or claude.ai.</div>'
    + kpiStrip(lastData)
    + '<div class="sec-h">Accounts</div><div class="accts">'+lastData.scopes.map(acctCard).join('')+'</div>'
    + insightsPanel(lastData)
    + detailPanel(lastData);
}

async function loadUsage(){
  if(usageLoading) return;
  usageLoading=true; render();
  try{
    const r=await fetch('/api/usage',{cache:'no-store'});
    usageData=await r.json();
  }catch(e){ /* keep previous usageData on failure */ }
  usageLoading=false; render();
}

async function load(){
  try{
    const r=await fetch('/api/data',{cache:'no-store'});
    lastData=await r.json();
    render();
    document.getElementById('updated').textContent='updated '+new Date(lastData.generatedAt).toLocaleTimeString();
  }catch(e){ document.getElementById('updated').textContent='fetch failed'; }
}
load();
setInterval(load, 15000);
</script>
</body></html>`;
