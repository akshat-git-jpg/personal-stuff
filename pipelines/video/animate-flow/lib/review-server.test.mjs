import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createReviewServer } from './review-server.mjs';
import { ROOT, MEDIA_ROOT } from './paths.mjs';

test('the review page serves state and writes comments in the shared schema', async () => {
  const slug = `zz-review-test-${process.pid}`;
  const wd = path.join(ROOT, 'videos', slug);
  const media = path.join(MEDIA_ROOT, slug);
  fs.mkdirSync(wd, { recursive: true });
  fs.mkdirSync(media, { recursive: true });
  fs.writeFileSync(path.join(wd, 'run-config.json'), JSON.stringify({ template: 'animate', video: slug, designSystem: 'default', source: { audio: 'audio.wav', screen: null }, total: 10 }));
  fs.writeFileSync(path.join(wd, 'moments.json'), JSON.stringify({ moments: [{ id: 'm01', start: 1, end: 5, idea: 'x' }] }));
  fs.writeFileSync(path.join(media, 'versions.json'), JSON.stringify({ versions: [{ label: 'v1', file: 'versions/v1.mp4', draft: true }] }));
  const server = createReviewServer(slug);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.match(await (await fetch(`${base}/`)).text(), /Animate review/);
    const post = (u, b) => fetch(`${base}${u}`, { method: 'POST', body: JSON.stringify(b) }).then((r) => r.json());
    const r = await post('/api/feedback', { label: 'v1', text: 'too fast', t: 2.5 });
    assert.equal(r.key, 'final-v1:0');
    assert.equal(r.item.moment, 'm01');
    const state = await (await fetch(`${base}/api/state`)).json();
    assert.equal(state.items['final-v1:0'].text, 'too fast');
    assert.equal(state.versions[0].label, 'v1');
    assert.equal((await post('/api/feedback', { label: 'v1', text: '', t: 1 })).ok, false);
    assert.equal((await fetch(`${base}/video/v9`)).status, 404);
    await post('/api/feedback-delete', { key: 'final-v1:0' });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(wd, 'feedback.json'), 'utf8')).items, {});
  } finally {
    server.close();
    fs.rmSync(wd, { recursive: true, force: true });
    fs.rmSync(media, { recursive: true, force: true });
  }
});

test('a workdir from another recipe is refused', () => {
  const slug = `zz-review-test-other-${process.pid}`;
  const wd = path.join(ROOT, 'videos', slug);
  fs.mkdirSync(wd, { recursive: true });
  try {
    fs.writeFileSync(path.join(wd, 'run-config.json'), JSON.stringify({ intro: 'film' }));
    assert.throws(() => createReviewServer(slug), /not an animate run/);
  } finally { fs.rmSync(wd, { recursive: true, force: true }); }
});
