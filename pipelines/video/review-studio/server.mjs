// Review Studio: one page for every video the edit recipes make. Start: node server.mjs
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { serveMediaFile } from '../visuals-flow/lib/board.mjs';
import { listVideos, videoDetail, mediaFile, imageFile, addComment, editComment, deleteComment, saveNotes, approveCut } from './lib/store.mjs';
import { thumbnail, peaks } from './lib/media.mjs';

export const DEFAULT_PORT = 4340;
const DIST = path.join(import.meta.dirname, 'ui', 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req, limit = 30e6) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (d) => {
      size += d.length;
      if (size > limit) { reject(Object.assign(new Error('body too large'), { code: 413 })); req.destroy(); return; }
      chunks.push(d);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('invalid JSON'), { code: 400 })); }
    });
    req.on('error', reject);
  });
}

function sendFile(res, file) {
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

function serveUi(res, pathname) {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    res.writeHead(503, { 'content-type': 'text/plain' });
    return res.end('UI not built. Run: npm run setup');
  }
  const rel = pathname.startsWith('/assets/') ? decodeURIComponent(pathname.slice(1)) : 'index.html';
  const file = path.resolve(DIST, rel);
  if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  return sendFile(res, file);
}

async function route(req, res) {
  const url = new URL(req.url, 'http://local');
  const p = url.pathname;

  if (req.method === 'GET' && p === '/api/videos') return json(res, 200, { videos: listVideos() });

  const v = /^\/api\/videos\/([a-z-]+)\/([a-z0-9-]+)(\/[a-z-]+)?$/.exec(p);
  if (v) {
    const [, recipe, slug, action] = v;
    if (req.method === 'GET' && !action) {
      const d = videoDetail(recipe, slug);
      return d ? json(res, 200, d) : json(res, 404, { ok: false, error: 'no such video' });
    }
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (action === '/comments') return json(res, 200, { ok: true, ...(await addComment(recipe, slug, body)) });
      if (action === '/comments-edit') return json(res, 200, { ok: true, item: editComment(recipe, slug, body) });
      if (action === '/comments-delete') { deleteComment(recipe, slug, body); return json(res, 200, { ok: true }); }
      if (action === '/notes') { saveNotes(recipe, slug, body); return json(res, 200, { ok: true }); }
      if (action === '/approve') return json(res, 200, { ok: true, approved: approveCut(recipe, slug, body) });
    }
  }

  const m = /^\/api\/(media|thumb|peaks)\/([a-z-]+)\/([a-z0-9-]+)\/(v\d+)$/.exec(p);
  if (m && req.method === 'GET') {
    const [, kind, recipe, slug, label] = m;
    const file = mediaFile(recipe, slug, label);
    if (!file) return json(res, 404, { ok: false, error: 'no video file for this version' });
    if (kind === 'media') return serveMediaFile(req, res, file, fs.statSync(file));
    if (kind === 'peaks') return json(res, 200, await peaks(file));
    return sendFile(res, await thumbnail(file, Number(url.searchParams.get('t') ?? 0)));
  }

  const img = /^\/api\/image\/([a-z-]+)\/([a-z0-9-]+)$/.exec(p);
  if (img && req.method === 'GET') {
    const file = imageFile(img[1], img[2], url.searchParams.get('key') ?? '', Number(url.searchParams.get('n') ?? 0));
    return file ? sendFile(res, file) : json(res, 404, { ok: false, error: 'no image' });
  }

  if (req.method === 'GET' && p === '/health') return json(res, 200, { ok: true, app: 'review-studio' });
  if (req.method === 'GET' && !p.startsWith('/api/')) return serveUi(res, p);
  return json(res, 404, { ok: false, error: 'not found' });
}

export function createStudioServer() {
  return http.createServer((req, res) => {
    route(req, res).catch((err) => {
      if (res.headersSent) return res.destroy();
      const code = Number.isInteger(err.code) ? err.code : 500;
      json(res, code, { ok: false, error: err.message });
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.REVIEW_PORT) || DEFAULT_PORT;
  process.on('uncaughtException', (err) => console.error('uncaught, studio stays up:', err?.stack ?? err));
  createStudioServer().listen(port, '127.0.0.1', () => console.log(`Review Studio at http://localhost:${port}`));
}
