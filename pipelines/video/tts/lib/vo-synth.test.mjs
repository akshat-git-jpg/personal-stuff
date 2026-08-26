import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { synthScript, selectSections, spokenFor, takeName } from './vo-synth.mjs';

const OPTS = { url: 'https://modal.test/synth', token: 'secret' };

function section(over = {}) {
  return {
    id: 's01',
    version: 1,
    demo: false,
    display_text: 'Notion and Asana both promise a lot.',
    spoken_text: '',
    flags: [],
    notes: '',
    tts: { regens_used: 0, locked: false, take: null },
    recording: { status: 'none' },
    ...over
  };
}

test('spokenFor derives from display_text and applies the respell map', () => {
  const sec = section();
  assert.strictEqual(spokenFor(sec), 'Notion and Asana both promise a lot.');
  assert.strictEqual(
    spokenFor(sec, { Asana: 'Ah-sah-nah' }),
    'Notion and Ah-sah-nah both promise a lot.'
  );
});

test('spokenFor prefers an explicit spoken_text over display_text', () => {
  const sec = section({ spoken_text: 'Hand written narration.' });
  assert.strictEqual(spokenFor(sec), 'Hand written narration.');
});

test('spokenFor refuses unresolved flags', () => {
  const flagged = section({
    display_text: 'Click [VERIFY: the button label].',
    flags: [{ kind: 'VERIFY', note: 'the button label' }]
  });
  assert.throws(() => spokenFor(flagged), /unresolved flags/);

  // flags array empty but the marker survived in spoken_text
  const leaked = section({ spoken_text: 'Click [FILL: price].' });
  assert.throws(() => spokenFor(leaked), /flag markers/);
});

test('takeName encodes section version and the next take number', () => {
  assert.strictEqual(takeName(section()), 's01-v1-t1.wav');
  assert.strictEqual(
    takeName(section({ version: 3, tts: { regens_used: 2, locked: false, take: null } })),
    's01-v3-t3.wav'
  );
});

test('selectSections skips locked sections unless forced, and honours --only', () => {
  const script = {
    sections: [
      section({ id: 's01', tts: { regens_used: 1, locked: true, take: 's01-v1-t1.wav' } }),
      section({ id: 's02' }),
      section({ id: 's03' })
    ]
  };
  assert.deepStrictEqual(selectSections(script).map(s => s.id), ['s02', 's03']);
  assert.deepStrictEqual(selectSections(script, { force: true }).map(s => s.id), ['s01', 's02', 's03']);
  assert.deepStrictEqual(selectSections(script, { only: 's03' }).map(s => s.id), ['s03']);
  assert.deepStrictEqual(selectSections(script, { only: 's01' }).map(s => s.id), []);
});

test('synthScript writes one wav per section and updates the tts block', async () => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'vo-synth-'));
  const script = { stage: 'tts', sections: [section({ id: 's01' }), section({ id: 's02' })] };

  const seen = [];
  const fetchImpl = async (reqUrl, options) => {
    assert.strictEqual(reqUrl, 'https://modal.test/synth');
    assert.strictEqual(options.headers.Authorization, 'Bearer secret');
    seen.push(JSON.parse(options.body));
    return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  };

  const { script: next, written, skipped } = await synthScript(
    script,
    { ...OPTS, root: tmpdir, slug: 'demo' },
    fetchImpl
  );

  assert.deepStrictEqual(written, ['s01', 's02']);
  assert.deepStrictEqual(skipped, []);
  assert.deepStrictEqual(seen.map(b => b.id), ['s01', 's02']);

  const files = await fs.readdir(path.join(tmpdir, 'videos', 'demo', 'audio'));
  assert.deepStrictEqual(files.sort(), ['s01.wav', 's02.wav']);

  assert.strictEqual(next.sections[0].tts.take, 's01-v1-t1.wav');
  assert.strictEqual(next.sections[0].tts.regens_used, 1);
  assert.strictEqual(next.sections[0].tts.locked, false);
  // spoken_text is materialized so the take is reproducible
  assert.strictEqual(next.sections[0].spoken_text, 'Notion and Asana both promise a lot.');
  // input is not mutated
  assert.strictEqual(script.sections[0].tts.take, null);
});

test('synthScript leaves locked sections untouched and reports them as skipped', async () => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'vo-synth-'));
  const script = {
    stage: 'tts',
    sections: [
      section({ id: 's01', tts: { regens_used: 1, locked: true, take: 's01-v1-t1.wav' } }),
      section({ id: 's02' })
    ]
  };

  const fetchImpl = async () => ({
    ok: true,
    arrayBuffer: async () => new Uint8Array([9]).buffer
  });

  const { script: next, written, skipped } = await synthScript(
    script,
    { ...OPTS, root: tmpdir, slug: 'demo' },
    fetchImpl
  );

  assert.deepStrictEqual(written, ['s02']);
  assert.deepStrictEqual(skipped, ['s01']);
  assert.strictEqual(next.sections[0].tts.regens_used, 1);
  const files = await fs.readdir(path.join(tmpdir, 'videos', 'demo', 'audio'));
  assert.deepStrictEqual(files, ['s02.wav']);
});

test('synthScript surfaces a non-ok response and a missing endpoint config', async () => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'vo-synth-'));
  const script = { stage: 'tts', sections: [section()] };

  await assert.rejects(
    synthScript(script, { ...OPTS, root: tmpdir, slug: 'demo' }, async () => ({
      ok: false,
      status: 401,
      text: async () => 'bad token'
    })),
    /synth s01 failed: 401 bad token/
  );

  await assert.rejects(
    synthScript(script, { root: tmpdir, slug: 'demo', token: 't' }, async () => ({ ok: true })),
    /MODAL_TTS_URL is not set/
  );

  await assert.rejects(
    synthScript(script, { root: tmpdir, slug: 'demo', url: 'https://x' }, async () => ({ ok: true })),
    /MODAL_TTS_TOKEN is not set/
  );
});

test('synthScript forwards emo_text and interval_silence only when given', async () => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'vo-synth-'));
  const bodies = [];
  const fetchImpl = async (_u, o) => {
    bodies.push(JSON.parse(o.body));
    return { ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer };
  };

  await synthScript(
    { stage: 'tts', sections: [section()] },
    { ...OPTS, root: tmpdir, slug: 'demo' },
    fetchImpl
  );
  assert.deepStrictEqual(Object.keys(bodies[0]).sort(), ['id', 'text']);

  await synthScript(
    { stage: 'tts', sections: [section()] },
    { ...OPTS, root: tmpdir, slug: 'demo', emo_text: 'warm', interval_silence: 250 },
    fetchImpl
  );
  assert.strictEqual(bodies[1].emo_text, 'warm');
  assert.strictEqual(bodies[1].interval_silence, 250);
});
