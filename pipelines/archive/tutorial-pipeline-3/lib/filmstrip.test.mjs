import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { filmstrip } from './filmstrip.mjs';

test('filmstrip runs ffmpeg for received demo clips', async () => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'filmstrip-'));
  
  await fs.mkdir(path.join(tmpdir, 'videos', 'test-slug', 'recordings'), { recursive: true });
  await fs.writeFile(path.join(tmpdir, 'videos', 'test-slug', 'script.json'), JSON.stringify({
    sections: [
      { id: 's01', demo: true, recording: { status: 'received' } },
      { id: 's02', demo: false, recording: { status: 'none' } },
      { id: 's03', demo: true, recording: { status: 're-record' } }
    ]
  }));
  await fs.writeFile(path.join(tmpdir, 'videos', 'test-slug', 'recordings', 's01.mp4'), '');

  const calls = [];
  const runner = async (cmd, args) => {
    calls.push({ cmd, args });
    return { stdout: '' };
  };

  await filmstrip('test-slug', { root: tmpdir, runner });

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].cmd, 'ffmpeg');
  assert.deepStrictEqual(calls[0].args, [
    '-y',
    '-i', path.join(tmpdir, 'videos', 'test-slug', 'recordings', 's01.mp4'),
    '-vf', 'fps=1/8,scale=320:-1,tile=5x4',
    '-frames:v', '1',
    path.join(tmpdir, 'videos', 'test-slug', 'qc', 's01.png')
  ]);
});
