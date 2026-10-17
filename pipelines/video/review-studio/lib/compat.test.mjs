// The studio and the old boards share feedback.json. These tests run both against one file.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const TMP = path.join(import.meta.dirname, '..', '.test-tmp');
const VF_FIXTURE = path.resolve(import.meta.dirname, '..', '..', 'visuals-flow', 'lib', 'fixtures', 'board');
const SLUG = 'demo-video';

fs.rmSync(TMP, { recursive: true, force: true });
const vfVideos = path.join(TMP, 'vf-videos');
const afVideos = path.join(TMP, 'af-videos');
const vfMedia = path.join(TMP, 'vf-media');
const afMedia = path.join(TMP, 'af-media');
process.env.REVIEW_VF_VIDEOS = vfVideos;
process.env.REVIEW_AF_VIDEOS = afVideos;
process.env.ASSEMBLE_MEDIA_ROOT = vfMedia;
process.env.ANIMATE_MEDIA_ROOT = afMedia;
process.env.REVIEW_CACHE = path.join(TMP, 'cache');

const ffmpeg = (args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
};

// visuals-flow video: the old board's own fixture, plus one rendered version.
const vfDir = path.join(vfVideos, SLUG);
fs.mkdirSync(vfDir, { recursive: true });
for (const f of ['cues.json', 'resolved.json', 'transcript.json']) fs.copyFileSync(path.join(VF_FIXTURE, f), path.join(vfDir, f));
ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-c:a', 'libmp3lame', path.join(vfDir, 'vo.mp3')]);
fs.mkdirSync(path.join(vfMedia, SLUG, 'versions'), { recursive: true });
ffmpeg(['-f', 'lavfi', '-i', 'testsrc=duration=3:size=320x180:rate=25', '-f', 'lavfi', '-i', 'sine=duration=3',
  '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', path.join(vfMedia, SLUG, 'versions', 'v1.mp4')]);
fs.writeFileSync(path.join(vfMedia, SLUG, 'versions.json'), JSON.stringify({ versions: [{ label: 'v1', file: 'versions/v1.mp4', created: '2026-10-01T00:00:00Z' }] }));

// animate-flow video: words plus moments already resolved to seconds.
const afDir = path.join(afVideos, 'anim-demo');
fs.mkdirSync(afDir, { recursive: true });
fs.writeFileSync(path.join(afDir, 'transcript.json'), JSON.stringify([{ text: 'Hello', start: 0, end: 0.5 }, { text: 'world.', start: 0.5, end: 1 }]));
fs.writeFileSync(path.join(afDir, 'moments.json'), JSON.stringify({ total: 3, moments: [{ id: 'm01', start: 0, end: 2 }] }));

const store = await import('./store.mjs');
const { createStudioServer } = await import('../server.mjs');
const { createServer: createOldBoard } = await import('../../visuals-flow/lib/board.mjs');

const readFb = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'feedback.json'), 'utf8'));

async function listen(server) {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${server.address().port}`;
}
const post = (base, p, body) => fetch(base + p, { method: 'POST', body: JSON.stringify(body) });

const studio = createStudioServer();
const oldBoard = createOldBoard(vfDir);
const S = await listen(studio);
const B = await listen(oldBoard);
test.after(() => { studio.close(); oldBoard.close(); });

test('a studio comment uses the old board key scheme and keeps why', async () => {
  const res = await post(S, `/api/videos/visuals-flow/${SLUG}/comments`, { label: 'v1', t: 1.234, text: ' too fast ', why: 'lists need a beat' });
  const body = await res.json();
  assert.equal(body.key, 'final-v1:0');
  const item = readFb(vfDir).items['final-v1:0'];
  assert.equal(item.text, 'too fast');
  assert.equal(item.why, 'lists need a beat');
  assert.equal(item.context, 'final@00:01');
  assert.equal(item.t, 1.234);
});

test('the old board numbers after the studio, and the studio sees its comment', async () => {
  const res = await post(B, '/feedback-final', { label: 'v1', item: { text: 'from old board', t: 2, context: 'final@00:02' } });
  assert.equal((await res.json()).key, 'final-v1:1');
  const d = store.videoDetail('visuals-flow', SLUG);
  assert.deepEqual(Object.keys(d.items).sort(), ['final-v1:0', 'final-v1:1']);
  assert.equal(d.items['final-v1:1'].text, 'from old board');
});

test('an old board edit keeps the studio why field', async () => {
  const res = await post(B, '/feedback-edit', { key: 'final-v1:0', text: 'still too fast' });
  assert.equal(res.status, 200);
  const item = readFb(vfDir).items['final-v1:0'];
  assert.equal(item.text, 'still too fast');
  assert.equal(item.why, 'lists need a beat');
});

test('the studio edits and deletes old board comments, never folded ones', async () => {
  let res = await post(S, `/api/videos/visuals-flow/${SLUG}/comments-edit`, { key: 'final-v1:1', text: 'edited here', why: 'because' });
  assert.equal(res.status, 200);
  assert.equal(readFb(vfDir).items['final-v1:1'].why, 'because');
  const fb = readFb(vfDir);
  fb.items['final-v1:1'].folded = '2026-10-17';
  fs.writeFileSync(path.join(vfDir, 'feedback.json'), JSON.stringify(fb));
  res = await post(S, `/api/videos/visuals-flow/${SLUG}/comments-delete`, { key: 'final-v1:1' });
  assert.equal(res.status, 409);
  res = await post(S, `/api/videos/visuals-flow/${SLUG}/comments-delete`, { key: 'final-v1:0' });
  assert.equal(res.status, 200);
  assert.equal(readFb(vfDir).items['final-v1:0'], undefined);
});

test('a screenshot is saved where the old board serves it from', async () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const { key } = await (await post(S, `/api/videos/visuals-flow/${SLUG}/comments`, { label: 'v1', t: 0.5, text: 'see this', images: [png] })).json();
  const fromOld = await fetch(`${B}/feedback-image/${encodeURIComponent(key)}`);
  assert.equal(fromOld.status, 200);
  const fromStudio = await fetch(`${S}/api/image/visuals-flow/${SLUG}?key=${encodeURIComponent(key)}&n=0`);
  assert.equal(fromStudio.status, 200);
});

test('video notes are the old board _global box, both ways', async () => {
  await post(S, `/api/videos/visuals-flow/${SLUG}/notes`, { text: 'pacing is slow overall' });
  assert.equal(readFb(vfDir).items._global.text, 'pacing is slow overall');
  await post(B, '/feedback', { feedback: { _global: 'changed on old board' } });
  assert.equal(store.videoDetail('visuals-flow', SLUG).notes, 'changed on old board');
  assert.equal(store.videoDetail('visuals-flow', SLUG).items._global, undefined);
});

test('animate-flow comments use its own writer and moment', async () => {
  const res = await post(S, '/api/videos/animate-flow/anim-demo/comments', { label: 'v2', t: 1.5, text: 'slower', why: 'reads too fast' });
  assert.equal((await res.json()).key, 'final-v2:0');
  const item = readFb(afDir).items['final-v2:0'];
  assert.equal(item.moment, 'm01');
  assert.equal(item.context, 'final@00:01.5');
  assert.equal(item.why, 'reads too fast');
  const notes = await post(S, '/api/videos/animate-flow/anim-demo/notes', { text: 'x' });
  assert.equal(notes.status, 400);
});

test('the list has both recipes and the detail has parts, cards and words', async () => {
  const { videos } = await (await fetch(`${S}/api/videos`)).json();
  assert.deepEqual(videos.map((v) => v.recipe).sort(), ['animate-flow', 'visuals-flow']);
  const vf = videos.find((v) => v.slug === SLUG);
  assert.deepEqual(vf.versions, ['v1']);
  const d = await (await fetch(`${S}/api/videos/visuals-flow/${SLUG}`)).json();
  assert.ok(d.cards.length > 0);
  assert.ok(d.words.length > 0);
  assert.equal(d.parts[0].name, 'Intro');
});

test('media streams with ranges; thumbnails and peaks render', async () => {
  const r = await fetch(`${S}/api/media/visuals-flow/${SLUG}/v1`, { headers: { range: 'bytes=0-99' } });
  assert.equal(r.status, 206);
  assert.equal((await r.arrayBuffer()).byteLength, 100);
  const t = await fetch(`${S}/api/thumb/visuals-flow/${SLUG}/v1?t=1`);
  assert.equal(t.headers.get('content-type'), 'image/jpeg');
  const p = await (await fetch(`${S}/api/peaks/visuals-flow/${SLUG}/v1`)).json();
  assert.ok(p.data.length >= 25);
});

test('bad input is refused', async () => {
  assert.equal((await fetch(`${S}/api/videos/visuals-flow/..%2F..%2Fetc`)).status, 404);
  assert.equal((await fetch(`${S}/api/media/visuals-flow/${SLUG}/v9`)).status, 404);
  assert.equal((await post(S, `/api/videos/visuals-flow/${SLUG}/comments`, { label: 'v1', t: 1, text: '  ' })).status, 400);
  assert.equal((await post(S, `/api/videos/visuals-flow/${SLUG}/comments`, { label: 'x', t: 1, text: 'a' })).status, 400);
  assert.equal((await post(S, `/api/videos/visuals-flow/${SLUG}/comments-edit`, { key: '_global', text: 'a' })).status, 400);
});
