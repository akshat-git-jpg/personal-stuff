// 080: one page, one job: play a cut and leave timestamped comments in the workdir's feedback.json.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { workdirOf, mediaDirOf, readJson } from './paths.mjs';
import { readRunConfig } from './run-config.mjs';
import { readFeedback, saveFeedback, appendFinalItem, deleteItem } from './feedback.mjs';
import { momentAt } from './moments.mjs';

export const DEFAULT_PORT = 4330;

function versionsOf(media) {
  const p = path.join(media, 'versions.json');
  return fs.existsSync(p) ? readJson(p).versions : [];
}

function sendJson(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (d) => { b += d; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(b));
    req.on('error', reject);
  });
}

// Byte ranges, so the browser can seek inside a long cut.
function streamFile(req, res, file) {
  const size = fs.statSync(file).size;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (!m) {
    res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': size, 'accept-ranges': 'bytes' });
    return fs.createReadStream(file).pipe(res);
  }
  const start = m[1] ? Number(m[1]) : 0;
  const end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  res.writeHead(206, { 'content-type': 'video/mp4', 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes' });
  fs.createReadStream(file, { start, end }).pipe(res);
}

export function createReviewServer(slug) {
  const workdir = workdirOf(slug);
  readRunConfig(workdir);
  const media = mediaDirOf(slug);
  const page = fs.readFileSync(path.join(import.meta.dirname, 'review-page.html'), 'utf8');
  const moments = () => {
    const p = path.join(workdir, 'moments.json');
    return fs.existsSync(p) ? readJson(p).moments : [];
  };
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://local');
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(page);
      }
      if (req.method === 'GET' && url.pathname === '/api/state') {
        return sendJson(res, 200, { video: slug, versions: versionsOf(media), moments: moments().map(({ id, start, end, idea }) => ({ id, start, end, idea })), items: readFeedback(workdir).items ?? {} });
      }
      const v = /^\/video\/(v\d+)$/.exec(url.pathname);
      if (req.method === 'GET' && v) {
        const entry = versionsOf(media).find((x) => x.label === v[1]);
        if (!entry) return sendJson(res, 404, { ok: false, error: 'no such version' });
        return streamFile(req, res, path.join(media, entry.file));
      }
      if (req.method === 'POST' && url.pathname === '/api/feedback') {
        const { label, text, t } = JSON.parse(await readBody(req));
        const { fb, key } = appendFinalItem(readFeedback(workdir), label, { text, t: Number(t), moment: momentAt(moments(), Number(t))?.id });
        saveFeedback(workdir, fb);
        return sendJson(res, 200, { ok: true, key, item: fb.items[key] });
      }
      if (req.method === 'POST' && url.pathname === '/api/feedback-delete') {
        const { key } = JSON.parse(await readBody(req));
        saveFeedback(workdir, deleteItem(readFeedback(workdir), key));
        return sendJson(res, 200, { ok: true });
      }
      sendJson(res, 404, { ok: false, error: 'not found' });
    } catch (e) {
      sendJson(res, 400, { ok: false, error: e.message });
    }
  });
}

export function serveReview(slug, { port = DEFAULT_PORT } = {}) {
  const server = createReviewServer(slug);
  server.listen(port, '127.0.0.1', () => console.log(`review ${slug}: http://127.0.0.1:${port}/  (Ctrl+C to stop)`));
  return server;
}
