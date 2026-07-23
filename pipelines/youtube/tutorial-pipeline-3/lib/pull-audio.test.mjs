import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pullAudio } from './pull-audio.mjs';

test('pullAudio downloads wavs for locked sections and fails if any unlocked', async () => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'pull-audio-'));
  const script = {
    sections: [
      { id: 's01', tts: { locked: true } },
      { id: 's02', tts: { locked: true } }
    ]
  };

  process.env.VO_UI_URL = 'http://localhost';
  process.env.VO_UI_ADMIN_TOKEN = 'secret';

  const fetchImpl = async (reqUrl, options) => {
    assert.match(reqUrl, /http:\/\/localhost\/api\/admin\/audio\/test-slug\/(s01|s02)/);
    assert.strictEqual(options.headers.Authorization, 'Bearer secret');
    return {
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
    };
  };

  await pullAudio(script, { root: tmpdir, slug: 'test-slug' }, fetchImpl);

  const audioDir = path.join(tmpdir, 'videos', 'test-slug', 'audio');
  const files = await fs.readdir(audioDir);
  assert.deepStrictEqual(files.sort(), ['s01.wav', 's02.wav']);

  const scriptWithUnlocked = {
    sections: [
      { id: 's01', tts: { locked: true } },
      { id: 's02', tts: { locked: false } }
    ]
  };

  await assert.rejects(
    pullAudio(scriptWithUnlocked, { root: tmpdir, slug: 'test-slug' }, fetchImpl),
    /Section s02 is not locked/
  );
});
