// Low-level HTTP + auth for HeyGen's OFFICIAL, PUBLIC API (api.heygen.com).
//
// This is the metered path. It is a deliberate sibling to tooling/cli/heygen-web,
// which drives the *web-session* API (api2.heygen.com) with cookies and renders
// Avatar III free. Do not merge the two: different host, different auth, and
// crucially different money. heygen-web stays the default; this exists because
// the owner asked for a key-driven path on a machine with no captured session
// (2026-08-16).
//
// Endpoint contract verified against developers.heygen.com on 2026-08-16:
//   POST /v3/assets              multipart `file`      -> { data: { asset_id } }
//   GET  /v3/templates                                 -> { data: { templates[] } }
//   GET  /v3/templates/{id}                            -> { data: { variables } }
//   POST /v3/templates/{id}      { variables, title }  -> { data: { video_id } }
//   GET  /v1/video_status.get?video_id=                -> { data: { status, video_url } }
// The older /v2/template/{id}/generate path still answers but HeyGen has it
// marked for deprecation alongside legacy AI Studio; v3 is what we build on.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const API = 'https://api.heygen.com';

// The key file is a plain KEY=value env file so it can be sourced by a shell
// too. It lives under infra/secrets/, which .gitignore blocks wholesale
// (`**/secrets/*`) — verified before this file was written.
export const KEY_FILE = process.env.HEYGEN_API_KEY_FILE
  || path.resolve(HERE, '../../../../infra/secrets/heygen-api.env');

export function loadKey() {
  if (process.env.HEYGEN_API_KEY) return process.env.HEYGEN_API_KEY.trim();
  if (!fs.existsSync(KEY_FILE)) {
    die(`no API key — set HEYGEN_API_KEY, or write it to:\n  ${KEY_FILE}\nas a single line: HEYGEN_API_KEY=hg_...`);
  }
  const txt = fs.readFileSync(KEY_FILE, 'utf8');
  const m = txt.match(/^\s*(?:export\s+)?HEYGEN_API_KEY\s*=\s*["']?([^"'\s#]+)/m);
  if (!m) die(`${KEY_FILE} exists but has no HEYGEN_API_KEY=... line`);
  return m[1];
}

export function die(msg) {
  console.error(`heygen-api: ${msg}`);
  process.exit(1);
}

// HeyGen is inconsistent about where it puts failure: sometimes a non-2xx,
// sometimes 200 with {error: {...}} or a non-100 `code`. Treat all three as
// failure so a bad render never looks like a submitted one.
async function unwrap(res, what) {
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = null; }
  if (!res.ok) {
    die(`${what} -> HTTP ${res.status}\n${text.slice(0, 600)}`);
  }
  if (body && body.error) {
    die(`${what} -> ${JSON.stringify(body.error).slice(0, 600)}`);
  }
  if (body && typeof body.code === 'number' && body.code !== 100 && body.code !== 0) {
    die(`${what} -> code ${body.code}: ${body.message ?? text.slice(0, 300)}`);
  }
  return body ?? {};
}

export async function apiGet(key, route, what = route) {
  const res = await fetch(`${API}${route}`, { headers: { 'x-api-key': key, accept: 'application/json' } });
  return unwrap(res, what);
}

export async function apiPost(key, route, json, what = route) {
  const res = await fetch(`${API}${route}`, {
    method: 'POST',
    headers: { 'x-api-key': key, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(json),
  });
  return unwrap(res, what);
}

// Upload an audio (or image/video) file and get an asset_id back.
// 32 MB is HeyGen's documented ceiling; we check locally so a 6-minute wav
// fails here with a clear message instead of as an opaque 413.
const MAX_ASSET_BYTES = 32 * 1024 * 1024;

export async function uploadAsset(key, file) {
  if (!fs.existsSync(file)) die(`asset not found: ${file}`);
  const bytes = fs.statSync(file).size;
  if (bytes > MAX_ASSET_BYTES) {
    die(`asset is ${(bytes / 1048576).toFixed(1)} MB — HeyGen caps uploads at 32 MB: ${file}`);
  }
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: mimeFor(file) }), path.basename(file));
  const res = await fetch(`${API}/v3/assets`, {
    method: 'POST',
    headers: { 'x-api-key': key, accept: 'application/json' },
    body: form,
  });
  const body = await unwrap(res, `upload ${path.basename(file)}`);
  const id = body?.data?.asset_id ?? body?.asset_id;
  if (!id) die(`upload succeeded but no asset_id in response: ${JSON.stringify(body).slice(0, 300)}`);
  return { asset_id: id, url: body?.data?.url ?? null, bytes };
}

export function mimeFor(file) {
  const e = path.extname(file).toLowerCase();
  return { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[e]
    ?? 'application/octet-stream';
}

export const listTemplates = (key) => apiGet(key, '/v3/templates', 'list templates');
export const getTemplate = (key, id) => apiGet(key, `/v3/templates/${id}`, `get template ${id}`);

// Build the `variables` payload that swaps one audio slot in a template.
// Shape per the v3 reference: every asset-bearing variable nests an `asset`
// object carrying a discriminating `type`.
export function audioVariable(assetId) {
  return { type: 'audio', asset: { type: 'asset_id', asset_id: assetId } };
}

export async function generateFromTemplate(key, templateId, { variables, title, dimension }) {
  const body = { variables, caption: false };
  if (title) body.title = title;
  if (dimension) body.dimension = dimension;
  const out = await apiPost(key, `/v3/templates/${templateId}`, body, `generate from template ${templateId}`);
  const id = out?.data?.video_id ?? out?.data?.id ?? out?.video_id;
  if (!id) die(`generate returned no video id: ${JSON.stringify(out).slice(0, 400)}`);
  return { video_id: id, raw: out?.data ?? out };
}

export async function videoStatus(key, videoId) {
  const out = await apiGet(key, `/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`, `status ${videoId}`);
  const d = out?.data ?? {};
  return { status: String(d.status ?? 'unknown').toLowerCase(), video_url: d.video_url ?? null, duration: d.duration ?? null, error: d.error ?? null };
}

export async function downloadTo(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) die(`download -> HTTP ${res.status} for ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return fs.statSync(dest).size;
}
