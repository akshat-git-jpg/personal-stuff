import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { planSegments, assemblyMd, runAssembly, planSegmentOverlays, encoderArgs, detectEncoder, planTransitions } from './assemble.mjs';

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

test('planSegmentOverlays: pure mapping', () => {
  const segments = [{ start: 0, end: 2 }, { start: 2, end: 4 }];
  const overlays = [
    { id: 'o1', start: 0.5, end: 1.5, file: '1.mov' },
    { id: 'o2', start: 1.5, end: 2.5, file: '2.mov' },
    { id: 'o3', start: 4.5, end: 5.5, file: '3.mov' },
    { id: 'o4', start: 1.995, end: 2.0, file: '4.mov' }
  ];
  const planned = planSegmentOverlays(segments, overlays);
  assert.equal(planned.length, 2);
  assert.deepEqual(planned[0], [
    { id: 'o1', file: '1.mov', trimStart: 0, at: 0.5, until: 1.5 },
    { id: 'o2', file: '2.mov', trimStart: 0, at: 1.5, until: 2 }
  ]);
  assert.deepEqual(planned[1], [
    { id: 'o2', file: '2.mov', trimStart: 0.5, at: 0, until: 0.5 }
  ]);
});

test('planTransitions: screen<->avatar directions', () => {
  const segments = [
    { kind: 'screen', start: 0, end: 5 },
    { kind: 'avatar', start: 5, end: 10 },
    { kind: 'screen', start: 10, end: 15 }
  ];
  const out = planTransitions(segments, []);
  assert.deepEqual(out, [
    { at: 5, direction: 'left', fromIdx: 0, toIdx: 1 },
    { at: 10, direction: 'right', fromIdx: 1, toIdx: 2 }
  ]);
});

test('planTransitions: graphic boundaries produce nothing', () => {
  const segments = [
    { kind: 'screen', start: 0, end: 5 },
    { kind: 'graphic', start: 5, end: 10 },
    { kind: 'screen', start: 10, end: 15 }
  ];
  assert.deepEqual(planTransitions(segments, []), []);
});

test('planTransitions: short neighbor skipped', () => {
  const segments = [
    { kind: 'screen', start: 0, end: 5 },
    { kind: 'avatar', start: 5, end: 5.5 }, // < 1.0s
    { kind: 'screen', start: 5.5, end: 10 }
  ];
  assert.deepEqual(planTransitions(segments, []), []);
});

test('planTransitions: overlay straddle skipped', () => {
  const segments = [
    { kind: 'screen', start: 0, end: 5 },
    { kind: 'avatar', start: 5, end: 10 }
  ];
  const overlays = [{ start: 4.9, end: 5.5 }]; // straddles 5
  assert.deepEqual(planTransitions(segments, overlays), []);
  // doesn't straddle 5
  assert.equal(planTransitions(segments, [{ start: 2, end: 4.5 }]).length, 1);
});

test('planTransitions: edge skip at t=0 and t=total', () => {
  const segments = [
    { kind: 'avatar', start: 0, end: 5 },
    { kind: 'screen', start: 5, end: 10 },
    { kind: 'avatar', start: 10, end: 15 }
  ];
  // Outer boundaries don't exist since there are no adjacent segments.
  // The test plan says "an avatar span starting at t=0 or ending at total produces no transition on that outer edge".
  // `planTransitions` only iterates i < segments.length - 1, so it only finds the boundaries between segments.
  const out = planTransitions(segments, []);
  assert.deepEqual(out, [
    { at: 5, direction: 'right', fromIdx: 0, toIdx: 1 },
    { at: 10, direction: 'left', fromIdx: 1, toIdx: 2 }
  ]);
});

test('encoderArgs', () => {
  assert.ok(encoderArgs({ encoder: 'x264', draft: false }).includes('veryfast'));
  assert.ok(encoderArgs({ encoder: 'x264', draft: true }).includes('ultrafast'));
  assert.ok(encoderArgs({ encoder: 'videotoolbox', draft: false }).includes('h264_videotoolbox'));
  assert.ok(encoderArgs({ encoder: 'videotoolbox', draft: false }).includes('12M'));
  assert.ok(encoderArgs({ encoder: 'videotoolbox', draft: true }).includes('4M'));
  const enc = detectEncoder();
  assert.ok(enc === 'x264' || enc === 'videotoolbox');
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

  const ovFile = path.join(testTmp, 'renders', '0004-o1-black.mov');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=black@0.0:s=1920x1080:r=30,format=yuva420p', '-t', '1', '-c:v', 'qtrle', ovFile]);

  const resolved = [
    { id: 'c1', placement: 'fullframe', start: 2, duration: 2, card: 'green' },
    { id: 'o1', placement: 'overlay', start: 4.5, duration: 1, card: 'black' }
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
      encoder: 'x264',
      keepTemp: true
    });
  });

  const tmpDir = path.join(testTmp, 'assembly-tmp');
  assert.ok(!fs.existsSync(path.join(tmpDir, 'base.mp4')), 'base.mp4 should not exist in single-pass');
  const tsFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith('.ts'));
  assert.equal(tsFiles.length, 5, 'should have 5 segments including transition');
  
  const transFiles = tsFiles.filter(f => f.includes('-trans-'));
  assert.equal(transFiles.length, 1, 'should have 1 transition file');
  
  for (const tFile of transFiles) {
    const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(tmpDir, tFile)], { encoding: 'utf8' });
    const d = parseFloat(p.stdout);
    assert.ok(Math.abs(d - 0.4) <= 0.05, `transition duration ${d} not near 0.4`);
  }
  
  fs.rmSync(tmpDir, { recursive: true, force: true });

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
  assert.equal((mdFile.match(/0004-o1-black.mov/g) || []).length, 1); // 1 overlay row
});

test('Integration: ffmpeg draft runAssembly', { skip: spawnSync('ffmpeg', ['-version']).error ? 'ffmpeg not found' : false }, () => {
  const outDraft = path.join(testTmp, 'final-draft.mp4');
  if (fs.existsSync(outDraft)) fs.unlinkSync(outDraft);

  const resolved = [
    { id: 'c1', placement: 'fullframe', start: 2, duration: 2, card: 'green' },
    { id: 'o1', placement: 'overlay', start: 4.5, duration: 1, card: 'black' }
  ];
  const avatarJobs = [
    { kind: 'avatar-full', id: 's01', start: 6, end: 8, file: path.join(testTmp, 'media', 's01.mp4') }
  ];

  runAssembly({
    workdir: testTmp,
    video: 'it',
    resolved,
    avatarJobs,
    total: 8,
    screen: path.join(testTmp, 'screen.mp4'),
    out: outDraft,
    draft: true,
    encoder: 'x264',
    keepTemp: false
  });

  assert.ok(fs.existsSync(outDraft));
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', outDraft], { encoding: 'utf8' });
  const dur = parseFloat(probe.stdout);
  assert.ok(Math.abs(dur - 8) <= 0.5);

  const streamProbe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', outDraft], { encoding: 'utf8' });
  assert.equal(streamProbe.stdout.trim(), '1280x720');

  const audioProbe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', outDraft], { encoding: 'utf8' });
  assert.match(audioProbe.stdout, /audio/);
});
