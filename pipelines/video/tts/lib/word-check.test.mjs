import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addWords, pendingWords, wordGate, approveWord, synthMissing, loadQueue, saveQueue, audioRel, promote, reopenWord } from './word-check.mjs';

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'word-check-'));
  const respellPath = path.join(dir, 'respell.json');
  fs.writeFileSync(respellPath, JSON.stringify({ HeyGen: 'hay-jen' }));
  return { dir, respellPath };
}

test('addWords skips approved words and puts "as written" first', () => {
  const q = addWords({ jobs: {} }, 'vid', [
    { word: 'HeyGen', options: ['hey-gen'] },
    { word: 'Descript', options: ['dee-script', 'Descript'] },
  ], { HeyGen: 'hay-jen' });
  assert.deepStrictEqual(q.jobs.vid.words.map((w) => w.word), ['Descript']);
  assert.deepStrictEqual(q.jobs.vid.words[0].options.map((o) => o.spelling), ['Descript', 'dee-script']);
  assert.strictEqual(q.jobs.vid.words[0].options[1].audio, 'audio/descript/dee-script.wav');
});

test('adding options to a pending word keeps the old ones', () => {
  let q = addWords({ jobs: {} }, 'vid', [{ word: 'n8n', options: ['N eight N'] }], {});
  q = addWords(q, 'vid', [{ word: 'n8n', options: ['nate-n'] }], {});
  assert.deepStrictEqual(q.jobs.vid.words[0].options.map((o) => o.spelling), ['n8n', 'N eight N', 'nate-n']);
});

test('the gate needs a job, then every word approved; approval lands in the shared map', () => {
  const { dir, respellPath } = tmp();
  const o = { dir, respellPath };
  assert.match(wordGate('vid', o).reason, /no word check yet/);

  saveQueue(addWords({ jobs: {} }, 'vid', [{ word: 'Descript', options: ['dee-script'] }], {}), dir);
  const g = wordGate('vid', o);
  assert.strictEqual(g.ok, false);
  assert.deepStrictEqual(g.pending, ['Descript']);

  approveWord('Descript', 'dee-script', o);
  assert.strictEqual(wordGate('vid', o).ok, true);
  // approval sits outside git until promoted
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(dir, 'approved.json'), 'utf8')), { Descript: 'dee-script' });
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(respellPath, 'utf8')), { HeyGen: 'hay-jen' });
  assert.strictEqual(loadQueue(dir).jobs.vid.words[0].approved, 'dee-script');

  assert.deepStrictEqual(promote(respellPath, o), ['Descript']);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(respellPath, 'utf8')), { HeyGen: 'hay-jen', Descript: 'dee-script' });
  assert.deepStrictEqual(promote(respellPath, o), []);
});

test('a job with no risky words passes; a word approved in another job is not asked again', () => {
  const { dir, respellPath } = tmp();
  saveQueue({ jobs: { empty: { words: [] } } }, dir);
  assert.strictEqual(wordGate('empty', { dir, respellPath }).ok, true);
  const q = addWords({ jobs: {} }, 'b', [{ word: 'Notion', options: [] }], {});
  assert.strictEqual(pendingWords(q, 'b', { Notion: 'Notion' }).length, 0);
});

test('synthMissing makes one audio file per option and skips existing ones', async () => {
  const { dir } = tmp();
  const q = addWords({ jobs: {} }, 'vid', [{ word: 'Descript', options: ['dee-script'] }], {});
  fs.mkdirSync(path.join(dir, 'audio', 'descript'), { recursive: true });
  fs.writeFileSync(path.join(dir, audioRel('Descript', 'Descript')), 'old');
  const texts = [];
  const fetchImpl = async (_u, o) => {
    texts.push(JSON.parse(o.body).text);
    return { ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer };
  };
  const written = await synthMissing(q, 'vid', { url: 'https://x', token: 't' }, fetchImpl, dir);
  assert.deepStrictEqual(written, ['audio/descript/dee-script.wav']);
  assert.deepStrictEqual(texts, ['dee-script.']);
});

test('more reopens an approved word until the owner picks again', () => {
  const { dir, respellPath } = tmp();
  const o = { dir, respellPath };
  saveQueue({ jobs: { vid: { words: [] } } }, dir);
  // HeyGen is in the shared map, so it is approved
  assert.strictEqual(wordGate('vid', o).ok, true);
  saveQueue(reopenWord(loadQueue(dir), 'vid', 'HeyGen', ['hay-gen'], dir), dir);
  assert.deepStrictEqual(wordGate('vid', o).pending, ['HeyGen']);
  assert.deepStrictEqual(loadQueue(dir).jobs.vid.words[0].options.map((x) => x.spelling), ['HeyGen', 'hay-gen']);
  approveWord('HeyGen', 'hay-gen', o);
  assert.strictEqual(wordGate('vid', o).ok, true);
});
