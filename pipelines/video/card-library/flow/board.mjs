// board.mjs — local review board (port 4322) for a video's graphics cues.
//
//   node flow/board.mjs <workdir>
//   → open the printed http://localhost:4322
//
// One tile per cue: the REAL card, playing in an iframe, driven by that cue's
// VO slice (postMessage seeks the card's paused GSAP timeline). Edits write
// back through the same resolver flow/resolve.mjs's CLI uses; nothing here
// duplicates the anchor-matching logic.

import { createServer as httpCreateServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveCues } from './resolve.mjs';
import { mmss } from './render.mjs';

const REQUIRED_FILES = ['cues.json', 'resolved.json', 'vo.mp3'];

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function injectShim(html, variables) {
  const varsJson = JSON.stringify(variables ?? {}).replace(/</g, '\\u003c');
  const shim = `<script>
  window.__hyperframes = { getVariables: () => (${varsJson}) };
  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data.t !== 'number') return;
    const tls = Object.values(window.__timelines || {});
    if (!tls.length) return;
    const tl = tls[0];
    tl.pause();
    tl.time(Math.min(e.data.t, tl.duration()));
  });
</script>
`;
  const idx = html.search(/<script/i);
  if (idx === -1) return shim + html;
  return html.slice(0, idx) + shim + html.slice(idx);
}

function ensureSlices(workdir) {
  const resolvedPath = path.join(workdir, 'resolved.json');
  const { resolved } = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const resolvedMtime = fs.statSync(resolvedPath).mtimeMs;
  const slicesDir = path.join(workdir, 'slices');
  fs.mkdirSync(slicesDir, { recursive: true });
  const voPath = path.join(workdir, 'vo.mp3');
  for (const cue of resolved) {
    const slicePath = path.join(slicesDir, `${cue.id}.mp3`);
    const stale = !fs.existsSync(slicePath) || fs.statSync(slicePath).mtimeMs < resolvedMtime;
    if (!stale) continue;
    const result = spawnSync('ffmpeg', [
      '-y', '-i', voPath,
      '-ss', String(cue.start),
      '-t', String(cue.duration),
      '-c:a', 'libmp3lame', '-q:a', '4',
      slicePath,
    ], { encoding: 'utf8' });
    if (result.status !== 0) {
      console.error(`slice failed for ${cue.id}: ${result.stderr || result.error}`);
    }
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const BOARD_CSS = `
  :root { --bg:#0f0b07; --panel:#181210; --line:rgba(255,255,255,0.10);
    --text:#f5ede2; --dim:rgba(245,237,226,0.55); --accent:#fb923c; --ok:#34d399; --err:#ff6b6b;
    --font:"Inter",-apple-system,system-ui,sans-serif; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:var(--font); background:var(--bg); color:var(--text); padding:28px 32px 80px; }
  .topbar { display:flex; align-items:center; gap:20px; margin-bottom:16px; font-size:14px; color:var(--dim); }
  .topbar strong { color:var(--text); }
  .topbar button { font:inherit; font-weight:700; border-radius:9px; padding:9px 16px; cursor:pointer;
    border:1px solid var(--line); background:var(--panel); color:var(--text); }
  #approveBtn { border-color:var(--ok); color:var(--ok); }
  #saveBtn { border-color:var(--accent); color:var(--accent); }
  .banner { margin-bottom:16px; padding:10px 14px; border-radius:9px; font-size:13px; }
  .banner.ok { background:rgba(52,211,153,0.12); border:1px solid var(--ok); color:var(--ok); }
  .banner.err { background:rgba(255,107,107,0.12); border:1px solid var(--err); color:var(--err); }
  .tiles { display:grid; grid-template-columns:repeat(auto-fill, minmax(480px,1fr)); gap:20px; }
  .tile { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:16px; }
  .tile.flagged { opacity:0.55; border-color:var(--err); }
  .tile-header { font-family:ui-monospace,Menlo,monospace; font-size:12px; color:var(--dim); margin-bottom:8px; }
  .anchor { font-size:14px; margin-bottom:6px; }
  .beats { list-style:none; font-size:12px; color:var(--dim); margin-bottom:10px; }
  .preview { width:480px; height:270px; overflow:hidden; position:relative; background:#000; border-radius:8px; margin-bottom:8px; }
  .preview iframe { width:1920px; height:1080px; border:0; transform:scale(0.25); transform-origin:top left; position:absolute; top:0; left:0; }
  .unresolved-note { font-size:12px; color:var(--err); margin-bottom:8px; }
  audio.scrub { width:100%; margin-bottom:10px; }
  .flag { display:block; font-size:12px; color:var(--dim); margin-bottom:6px; }
  .note { width:100%; font:inherit; font-size:12px; padding:6px 8px; margin-bottom:8px; background:#0f0b07; color:var(--text); border:1px solid var(--line); border-radius:6px; }
  textarea.frag { width:100%; min-height:140px; font-family:ui-monospace,Menlo,monospace; font-size:11px;
    background:#0f0b07; color:var(--text); border:1px solid var(--line); border-radius:6px; padding:8px; }
`;

function renderBoardPage(cuesFile, resolved) {
  const byId = new Map(resolved.map((r) => [r.id, r]));
  const cues = cuesFile.cues || [];
  const flaggedCount = cues.filter((c) => c.flagged).length;

  const tiles = cues.map((cue) => {
    const r = byId.get(cue.id);
    const beats = cue.beats ?? [];
    const fragment = { anchor: cue.anchor, hold: cue.hold ?? 3.0, variables: cue.variables ?? {}, beats };
    const beatLines = beats
      .map((b) => `<li><strong>${escapeHtml(b.reveal?.text ?? '')}</strong> @ "${escapeHtml(b.anchor ?? '')}"</li>`)
      .join('');
    const header = r
      ? `#${escapeHtml(cue.id)} &middot; ${mmss(r.start)} &middot; ${escapeHtml(cue.card)} &middot; ${r.duration}s &middot; ${escapeHtml(r.placement)}`
      : `#${escapeHtml(cue.id)} &middot; unresolved &middot; ${escapeHtml(cue.card)}`;
    const media = r
      ? `<div class="preview"><iframe src="/card/${encodeURIComponent(cue.id)}"></iframe></div>
      <audio class="scrub" controls src="/slice/${encodeURIComponent(cue.id)}.mp3"></audio>`
      : `<div class="unresolved-note">no resolved timing for this cue — fix the anchor and Save</div>`;

    return `<div class="tile ${cue.flagged ? 'flagged' : ''}" data-id="${escapeHtml(cue.id)}" data-card="${escapeHtml(cue.card)}" data-lead="${cue.lead ?? ''}">
      <div class="tile-header">${header}</div>
      <div class="anchor"><strong>${escapeHtml(cue.anchor ?? '')}</strong></div>
      <ul class="beats">${beatLines}</ul>
      ${media}
      <label class="flag"><input type="checkbox" class="flag-input" ${cue.flagged ? 'checked' : ''}/> flag: no card fits</label>
      <input class="note" type="text" placeholder="note (why no card fits)" value="${escapeHtml(cue.note ?? '')}" />
      <textarea class="frag">${escapeHtml(JSON.stringify(fragment, null, 2))}</textarea>
    </div>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Graphics storyboard board</title>
<style>${BOARD_CSS}</style>
</head>
<body>
  <div class="topbar">
    <div>video: <strong>${escapeHtml(cuesFile.video ?? '')}</strong></div>
    <div>${cues.length} cues &middot; ${flaggedCount} flagged</div>
    <button id="approveBtn">Approve</button>
    <button id="saveBtn">Save</button>
  </div>
  <div id="banner">${cuesFile.approved ? '<div class="banner ok">approved — ready for <code>node flow/render.mjs</code></div>' : ''}</div>
  <div class="tiles">${tiles}</div>
  <script>
    const VIDEO = ${JSON.stringify(cuesFile.video ?? '')};
    let APPROVED = ${JSON.stringify(!!cuesFile.approved)};

    document.querySelectorAll('.tile').forEach((tile) => {
      const iframe = tile.querySelector('iframe');
      const audio = tile.querySelector('audio');
      if (!iframe || !audio) return;
      const post = () => { try { iframe.contentWindow.postMessage({ t: audio.currentTime }, '*'); } catch {} };
      let raf = null;
      audio.addEventListener('timeupdate', post);
      audio.addEventListener('seeked', post);
      audio.addEventListener('pause', () => { post(); if (raf) cancelAnimationFrame(raf); });
      audio.addEventListener('play', () => {
        const loop = () => { post(); if (!audio.paused) raf = requestAnimationFrame(loop); };
        loop();
      });
    });

    function showBanner(html, cls) {
      document.getElementById('banner').innerHTML = '<div class="banner ' + cls + '">' + html + '</div>';
    }

    document.getElementById('saveBtn').onclick = async () => {
      const cues = [...document.querySelectorAll('.tile')].map((tile) => {
        const fragment = JSON.parse(tile.querySelector('.frag').value);
        const cue = {
          id: tile.dataset.id,
          card: tile.dataset.card,
          anchor: fragment.anchor,
          hold: fragment.hold,
          variables: fragment.variables,
          beats: fragment.beats,
          flagged: tile.querySelector('.flag-input').checked,
        };
        if (tile.dataset.lead !== '') cue.lead = Number(tile.dataset.lead);
        const note = tile.querySelector('.note').value;
        if (note) cue.note = note;
        return cue;
      });
      const res = await fetch('/save', { method: 'POST', body: JSON.stringify({ video: VIDEO, approved: APPROVED, cues }) });
      const data = await res.json();
      if (!data.ok) {
        showBanner(data.errors.map(escapeForBanner).join('<br>'), 'err');
      } else {
        location.reload();
      }
    };

    document.getElementById('approveBtn').onclick = async () => {
      await fetch('/approve', { method: 'POST' });
      location.reload();
    };

    function escapeForBanner(s) {
      return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    }
  </script>
</body>
</html>`;
}

async function handleSave(req, res, workdir, cardLibraryRoot) {
  const body = await readBody(req);
  let cuesFile;
  try {
    cuesFile = JSON.parse(body);
  } catch (err) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, errors: [`invalid JSON: ${err.message}`] }));
  }

  const cuesPath = path.join(workdir, 'cues.json');
  fs.writeFileSync(cuesPath, JSON.stringify(cuesFile, null, 2));

  const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(path.join(cardLibraryRoot, 'catalog.json'), 'utf8'));
  const { resolved, errors } = resolveCues(cuesFile.cues ?? [], words, catalog);

  res.setHeader('content-type', 'application/json');
  if (errors.length) {
    return res.end(JSON.stringify({ ok: false, errors }));
  }

  fs.writeFileSync(
    path.join(workdir, 'resolved.json'),
    JSON.stringify({ video: cuesFile.video, resolved }, null, 2),
  );
  ensureSlices(workdir);
  res.end(JSON.stringify({ ok: true, errors: [] }));
}

async function handleApprove(req, res, workdir) {
  await readBody(req);
  const cuesPath = path.join(workdir, 'cues.json');
  const cuesFile = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
  cuesFile.approved = true;
  fs.writeFileSync(cuesPath, JSON.stringify(cuesFile, null, 2));
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
}

function serveCard(res, workdir, cardLibraryRoot, id) {
  const { resolved } = JSON.parse(fs.readFileSync(path.join(workdir, 'resolved.json'), 'utf8'));
  const cue = resolved.find((c) => c.id === id);
  if (!cue) {
    res.statusCode = 404;
    return res.end('cue has no resolved timing');
  }
  const indexPath = path.join(cardLibraryRoot, cue.card, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(injectShim(html, cue.variables));
}

function serveSlice(res, workdir, id) {
  const slicePath = path.join(workdir, 'slices', `${id}.mp3`);
  if (!fs.existsSync(slicePath)) {
    res.statusCode = 404;
    return res.end('slice not found');
  }
  res.setHeader('content-type', 'audio/mpeg');
  res.setHeader('cache-control', 'no-store');
  res.end(fs.readFileSync(slicePath));
}

async function handleRequest(req, res, workdir, cardLibraryRoot) {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index')) {
    const cuesFile = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    const { resolved } = JSON.parse(fs.readFileSync(path.join(workdir, 'resolved.json'), 'utf8'));
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(renderBoardPage(cuesFile, resolved));
  }

  const cardMatch = url.pathname.match(/^\/card\/([^/]+)$/);
  if (req.method === 'GET' && cardMatch) {
    return serveCard(res, workdir, cardLibraryRoot, cardMatch[1]);
  }

  const sliceMatch = url.pathname.match(/^\/slice\/([^/]+)\.mp3$/);
  if (req.method === 'GET' && sliceMatch) {
    return serveSlice(res, workdir, sliceMatch[1]);
  }

  if (req.method === 'POST' && url.pathname === '/save') {
    return handleSave(req, res, workdir, cardLibraryRoot);
  }

  if (req.method === 'POST' && url.pathname === '/approve') {
    return handleApprove(req, res, workdir);
  }

  res.statusCode = 404;
  res.end('not found');
}

export function createServer(workdir) {
  const cardLibraryRoot = path.resolve(import.meta.dirname, '..');
  for (const name of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(workdir, name))) {
      throw new Error(`workdir missing ${name}: ${path.join(workdir, name)}`);
    }
  }

  ensureSlices(workdir);

  return httpCreateServer((req, res) => {
    handleRequest(req, res, workdir, cardLibraryRoot).catch((err) => {
      res.statusCode = 500;
      res.end(String((err && err.stack) || err));
    });
  });
}

async function main() {
  const workdir = process.argv[2];
  if (!workdir) {
    console.error('usage: node flow/board.mjs <workdir>');
    process.exit(1);
  }
  const resolvedWorkdir = path.resolve(workdir);
  let server;
  try {
    server = createServer(resolvedWorkdir);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const port = Number(process.env.BOARD_PORT) || 4322;
  server.listen(port, () => {
    console.log(`board at http://localhost:${server.address().port}`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
