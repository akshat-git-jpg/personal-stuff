import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { run } from './exec.mjs';
import { durationOf, heightOf } from './ffmeta.mjs';
import { handoff } from './handoff.mjs';

test('integration handoff REAL ffmpeg', async () => {
  const tmpdir = await fs.mkdtemp(path.join(os.tmpdir(), 'handoff-int-'));
  
  const root = path.join(tmpdir, 'root');
  const slug = 'test-slug';
  const slugDir = path.join(root, 'videos', slug);
  await fs.mkdir(path.join(slugDir, 'audio'), { recursive: true });
  await fs.mkdir(path.join(slugDir, 'recordings'), { recursive: true });

  await fs.writeFile(path.join(slugDir, 'intake-report.md'), 'RESULT: PASS\n');
  await fs.writeFile(path.join(slugDir, 'script.json'), JSON.stringify({
    sections: [
      { id: 's01', demo: false },
      { id: 's02', demo: true },
      { id: 's03', demo: true }
    ]
  }));

  await run('ffmpeg', ['-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '2', path.join(slugDir, 'audio', 's01.wav')]);
  await run('ffmpeg', ['-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '1.5', path.join(slugDir, 'audio', 's02.wav')]);
  await run('ffmpeg', ['-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '2', path.join(slugDir, 'audio', 's03.wav')]);

  await run('ffmpeg', ['-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30', '-t', '3', path.join(slugDir, 'recordings', 's02.mp4')]);
  await run('ffmpeg', ['-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30', '-t', '3', path.join(slugDir, 'recordings', 's03.mp4')]);

  const outDir = path.join(tmpdir, 'out');
  await handoff(slug, { root, out: outDir });

  const voMp3 = path.join(outDir, 'vo.mp3');
  const screenMp4 = path.join(outDir, 'screen.mp4');

  const EXPECTED_DUR = 2 + 0.35 + 1.5 + 0.35 + 2;

  const aDur = await durationOf(voMp3);
  assert.ok(Math.abs(aDur - EXPECTED_DUR) <= 0.15, `vo.mp3 duration ${aDur} != ${EXPECTED_DUR}`);

  const vDur = await durationOf(screenMp4);
  assert.ok(Math.abs(vDur - EXPECTED_DUR) <= 0.25, `screen.mp4 duration ${vDur} != ${EXPECTED_DUR}`);

  const h = await heightOf(screenMp4);
  assert.strictEqual(h, 1080);

  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_streams', '-select_streams', 'a', screenMp4]);
  assert.strictEqual(stdout.trim(), '', 'screen.mp4 should have no audio streams');

  await fs.rm(tmpdir, { recursive: true, force: true });
});
