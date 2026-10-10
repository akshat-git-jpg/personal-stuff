// 035 gate: one page, one job: thumbs up or down per storyboard panel, with a note. Writes storyboard.json.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { workdirOf } from './paths.mjs';
import { readRunConfig } from './run-config.mjs';
import { loadMoments } from './author-moments.mjs';
import { readBoard, decide, panelPath, sheetPath, momentSig } from './storyboard.mjs';

export const STORYBOARD_PORT = 4331;

function sendJson(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (d) => { b += d; if (b.length > 1e5) req.destroy(); });
    req.on('end', () => resolve(b));
    req.on('error', reject);
  });
}

export function createStoryboardServer(slug) {
  readRunConfig(workdirOf(slug));
  const page = fs.readFileSync(path.join(import.meta.dirname, 'storyboard-page.html'), 'utf8');
  const png = (res, file) => {
    if (!fs.existsSync(file)) return sendJson(res, 404, { ok: false, error: 'not drawn yet' });
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  };
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://local');
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(page);
      }
      if (req.method === 'GET' && url.pathname === '/api/state') {
        const board = readBoard(slug);
        const panels = loadMoments(slug).map((m, i) => {
          const p = board.moments[m.id];
          return { n: i + 1, id: m.id, kind: m.kind ?? 'takeover', start: m.start, end: m.end, idea: m.idea,
            ...(p ? { at: p.at, caption: p.caption, status: p.sig === momentSig(m) ? p.status : 'stale', note: p.note ?? '' } : { status: 'missing' }) };
        });
        return sendJson(res, 200, { video: slug, panels });
      }
      if (req.method === 'GET' && url.pathname === '/sheet.png') return png(res, sheetPath(slug));
      const p = /^\/panel\/([a-z0-9-]+)\.png$/.exec(url.pathname);
      if (req.method === 'GET' && p) return png(res, panelPath(slug, p[1]));
      if (req.method === 'POST' && url.pathname === '/api/decide') {
        const { id, status, note } = JSON.parse(await readBody(req));
        if (!['approved', 'rejected'].includes(status)) return sendJson(res, 400, { ok: false, error: 'status must be approved or rejected' });
        if (status === 'rejected' && !String(note ?? '').trim()) return sendJson(res, 400, { ok: false, error: 'say what to change' });
        const board = decide(slug, [id], status, String(note ?? '').trim());
        return sendJson(res, 200, { ok: true, panel: board.moments[id] });
      }
      sendJson(res, 404, { ok: false, error: 'not found' });
    } catch (e) {
      sendJson(res, 400, { ok: false, error: e.message });
    }
  });
}

export function serveStoryboard(slug, { port = STORYBOARD_PORT } = {}) {
  const server = createStoryboardServer(slug);
  server.listen(port, '127.0.0.1', () => console.log(`storyboard ${slug}: http://127.0.0.1:${port}/  (Ctrl+C to stop)`));
  return server;
}
