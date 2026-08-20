// Offline tests only. Never make a live HeyGen call from a test — it bills.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { arg, pickAudioVar } from '../heygen-api.mjs';
import { audioVariable, mimeFor } from '../src/client.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(HERE, '../heygen-api.mjs');

test('arg reads a flag value and falls back', () => {
  const a = ['--template', 'abc', '--title', 'hello'];
  assert.equal(arg(a, '--template'), 'abc');
  assert.equal(arg(a, '--title'), 'hello');
  assert.equal(arg(a, '--missing'), null);
  assert.equal(arg(a, '--missing', 15), 15);
});

test('pickAudioVar finds the sole audio slot', () => {
  const vars = {
    headline: { type: 'text', content: 'hi' },
    vo: { type: 'audio', asset: { type: 'url', url: 'x' } },
    face: { type: 'character', character_id: 'a' },
  };
  assert.equal(pickAudioVar(vars, null), 'vo');
});

test('pickAudioVar honours an explicit slot name', () => {
  const vars = { a1: { type: 'audio' }, a2: { type: 'audio' } };
  assert.equal(pickAudioVar(vars, 'a2'), 'a2');
});

test('audioVariable builds the v3 asset_id shape', () => {
  assert.deepEqual(audioVariable('asset_123'), {
    type: 'audio',
    asset: { type: 'asset_id', asset_id: 'asset_123' },
  });
});

test('mimeFor maps the audio types we actually upload', () => {
  assert.equal(mimeFor('a/b/vo.mp3'), 'audio/mpeg');
  assert.equal(mimeFor('vo.wav'), 'audio/wav');
  assert.equal(mimeFor('clip.mp4'), 'video/mp4');
  assert.equal(mimeFor('weird.xyz'), 'application/octet-stream');
});

// `help` must work with no key present — otherwise a fresh machine cannot even
// discover the commands. Run it with the key file pointed at nowhere to prove
// auth is not touched on this path.
test('help prints without any credentials', () => {
  const r = spawnSync(process.execPath, [CLI, 'help'], {
    encoding: 'utf8',
    env: { ...process.env, HEYGEN_API_KEY: '', HEYGEN_API_KEY_FILE: path.join(HERE, 'no-such-key.env') },
  });
  assert.equal(r.status, 0, r.stderr);
  for (const cmd of ['auth-check', 'list-templates', 'get-template', 'upload', 'generate', 'status', 'download', 'render']) {
    assert.match(r.stdout, new RegExp(`\\b${cmd}\\b`), `help is missing "${cmd}"`);
  }
});

test('a command without a key fails loudly instead of hanging', () => {
  const r = spawnSync(process.execPath, [CLI, 'auth-check'], {
    encoding: 'utf8',
    env: { ...process.env, HEYGEN_API_KEY: '', HEYGEN_API_KEY_FILE: path.join(HERE, 'no-such-key.env') },
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no API key/);
});
