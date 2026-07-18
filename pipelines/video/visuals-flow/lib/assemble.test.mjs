import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { planSegments, assemblyMd, runAssembly } from './assemble.mjs';

const testTmp = path.resolve(import.meta.dirname, '.test-tmp', 'assemble-it');

test('planSegments: contiguity and edge placement', () => {
  const resolved = [{ placement: 'fullframe', id: 'c1', start: 10, duration: 5 }];
  const avatarJobs = [{ kind: 'avatar-full', id: 'j1', start: 40, end: 60 }];
  const segments = planSegments({ resolved, avatarJobs, total: 100 });
  assert.deepEqual(segments, [
    { kind: 'screen', id: 'screen-01', start: 0, end: 10 },
    { kind: 'graphic', id: 'c1', start: 10, end: 15 },
    { kind: 'screen', id: 'screen-02', start: 15, end: 40 },
    { kind: 'avatar', id: 'j1', start: 40, end: 60 },
    { kind: 'screen', id: 'screen-03', start: 60, end: 100 }
  ]);
});

test('planSegments: replacement at t=0', () => {
  const avatarJobs = [{ kind: 'avatar-full', id: 'j1', start: 0, end: 20 }];
  const segments = planSegments({ resolved: [], avatarJobs, total: 100 });
  assert.equal(segments[0].kind, 'avatar');
  assert.equal(segments[0].start, 0);
});

test('planSegments: replacement ending at total', () => {
  const avatarJobs = [{ kind: 'avatar-full', id: 'j1', start: 80, end: 100 }];
  const segments = planSegments({ resolved: [], avatarJobs, total: 100 });
  assert.equal(segments[segments.length - 1].kind, 'avatar');
  assert.equal(segments[segments.length - 1].end, 100);
});

test('planSegments: overlapping replacements throw', () => {
  const resolved = [{ placement: 'fullframe', id: 'c1', start: 10, duration: 10 }];
  const avatarJobs = [{ kind: 'avatar-full', id: 'j1', start: 15, end: 30 }];
  assert.throws(() => planSegments({ resolved, avatarJobs, total: 100 }), /overlapping base segments/);
});

test('planSegments: sub-EPS underlap clamped', () => {
  const resolved = [{ placement: 'fullframe', id: 'c1', start: 10, duration: 10 }];
  const avatarJobs = [{ kind: 'avatar-full', id: 'j1', start: 19.98, end: 30 }];
  const segments = planSegments({ resolved, avatarJobs, total: 100 });
  assert.equal(segments.find(s => s.id === 'j1').start, 20); // clamped to previous end
});

test('planSegments: empty avatar list and ignored corner jobs', () => {
  const resolved = [{ placement: 'fullframe', id: 'c1', start: 10, duration: 5 }];
  const avatarJobs = [{ kind: 'corner', id: 'j1', start: 40, end: 60 }];
  const segments = planSegments({ resolved, avatarJobs, total: 100 });
  assert.deepEqual(segments.filter(s => s.kind !== 'screen'), [
    { kind: 'graphic', id: 'c1', start: 10, end: 15 }
  ]);
});

test('assemblyMd: format', () => {
  const md = assemblyMd('test-vid', [{ kind: 'screen', start: 0, end: 10, id: 'screen-01' }], [{ start: 2, end: 4, file: 'ov.mov' }], 10.5, 'out.mp4');
  assert.match(md, /# test-vid — assembly/);
  assert.match(md, /10.5s starts at/);
  assert.match(md, /\| 00:00.0 \| 00:10.0 \| screen \| screen-01 \|/);
  assert.match(md, /\| 00:02.0 \| 00:04.0 \| ov.mov \|/);
});

test('Integration: ffmpeg runAssembly', { skip: spawnSync('ffmpeg', ['-version']).error ? 'ffmpeg not found' : false }, () => {
  fs.mkdirSync(path.join(testTmp, 'media'), { recursive: true });
  fs.mkdirSync(path.join(testTmp, 'renders'), { recursive: true });

  const voMp3 = path.join(testTmp, 'vo.mp3');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '8', '-q:a', '9', voMp3]);

  const screenMp4 = path.join(testTmp, 'screen.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=1920x1080:r=30', '-t', '8', '-pix_fmt', 'yuv420p', screenMp4]);

  const avatarFile = path.join(testTmp, 'media', 's01.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=red:s=1920x1080:r=30', '-t', '2', '-pix_fmt', 'yuv420p', avatarFile]);

  const ffFile = path.join(testTmp, 'renders', '0002-c1-green.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=green:s=1920x1080:r=30', '-t', '2', '-pix_fmt', 'yuv420p', ffFile]);

  const ovFile = path.join(testTmp, 'renders', '0005-o1-black.mov');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=black@0.0:s=1920x1080:r=30,format=yuva420p', '-t', '1', '-c:v', 'qtrle', ovFile]);

  const resolved = [
    { id: 'c1', placement: 'fullframe', start: 2, duration: 2, card: 'green' },
    { id: 'o1', placement: 'overlay', start: 5, duration: 1, card: 'black' }
  ];
  const avatarJobs = [
    { kind: 'avatar-full', id: 's01', start: 6, end: 8, file: avatarFile }
  ];
  
  const outMp4 = path.join(testTmp, 'final.mp4');
  if (fs.existsSync(outMp4)) fs.unlinkSync(outMp4);

  assert.doesNotThrow(() => {
    runAssembly({
      workdir: testTmp,
      video: 'it',
      resolved,
      avatarJobs,
      total: 8,
      screen: screenMp4,
      out: outMp4,
      keepTemp: false
    });
  });

  assert.ok(fs.existsSync(outMp4));
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', outMp4], { encoding: 'utf8' });
  const dur = parseFloat(probe.stdout);
  assert.ok(Math.abs(dur - 8) <= 0.5);

  const streamProbe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', outMp4], { encoding: 'utf8' });
  assert.equal(streamProbe.stdout.trim(), '1920x1080');

  const audioProbe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', outMp4], { encoding: 'utf8' });
  assert.match(audioProbe.stdout, /audio/);

  const mdFile = fs.readFileSync(path.join(testTmp, 'assembly.md'), 'utf8');
  assert.equal((mdFile.match(/screen-|avatar|graphic/g) || []).length, 5); // 5 base rows
  assert.equal((mdFile.match(/0005-o1-black.mov/g) || []).length, 1); // 1 overlay row
});
