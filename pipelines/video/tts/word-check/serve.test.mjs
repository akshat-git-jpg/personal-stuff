import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from './serve.mjs';
import { addWords, saveQueue } from '../lib/word-check.mjs';

async function withApp(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-serve-'));
  const respellPath = path.join(dir, 'respell.json');
  fs.writeFileSync(respellPath, '{}');
  saveQueue(addWords({ jobs: {} }, 'vid', [{ word: 'Descript', options: ['dee-script'] }], {}), dir);
  fs.mkdirSync(path.join(dir, 'audio', 'descript'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'audio', 'descript', 'dee-script.wav'), 'RIFF');
  const server = createApp({ dir, respellPath }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base, dir);
  } finally {
    server.close();
  }
}

test('queue lists pending words with which audio exists', async () => {
  await withApp(async (base) => {
    const view = await (await fetch(`${base}/api/queue`)).json();
    assert.strictEqual(view.pending, 1);
    assert.deepStrictEqual(view.jobs[0].words[0].options.map((o) => [o.spelling, o.ready]), [['Descript', false], ['dee-script', true]]);
  });
});

test('approve records the pick; unknown options are refused', async () => {
  await withApp(async (base, dir) => {
    const bad = await fetch(`${base}/api/approve`, { method: 'POST', body: JSON.stringify({ word: 'Descript', spelling: 'nope' }) });
    assert.strictEqual(bad.status, 400);
    const ok = await (await fetch(`${base}/api/approve`, { method: 'POST', body: JSON.stringify({ word: 'Descript', spelling: 'dee-script' }) })).json();
    assert.strictEqual(ok.pending, 0);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'approved.json'), 'utf8')), { Descript: 'dee-script' });
  });
});

test('audio is served, and paths outside the folder are refused', async () => {
  await withApp(async (base) => {
    const a = await fetch(`${base}/audio/descript/dee-script.wav`);
    assert.strictEqual(a.status, 200);
    assert.strictEqual(a.headers.get('content-type'), 'audio/wav');
    const escape = await fetch(`${base}/audio/..%2f..%2fqueue.json`);
    assert.strictEqual(escape.status, 404);
  });
});
