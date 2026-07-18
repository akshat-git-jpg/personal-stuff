import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { planSegments, assemblyMd, runAssembly, planSegmentOverlays, encoderArgs, detectEncoder, planTransitions, planAvatarBeats, splitAvatarSegments } from './assemble.mjs';

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
  const md = assemblyMd('test-vid', [{ kind: 'screen', start: 0, end: 10, id: 'screen-01' }, { kind: 'avatar', start: 10, end: 20, id: 's01', sub: 0 }], [{ start: 2, end: 4, file: 'ov.mov' }], 20.5, 'out.mp4');
  assert.match(md, /# test-vid — assembly/);
  assert.match(md, /20.5s starts at/);
  assert.match(md, /Hard cuts\./);
  assert.match(md, /\| 00:00.0 \| 00:10.0 \| screen \| screen-01 \|/);
  assert.match(md, /\| 00:10.0 \| 00:20.0 \| avatar \| s01.1 \|/);
  assert.match(md, /\| 00:02.0 \| 00:04.0 \| ov.mov \|/);
});

test('assemblyMd: transitions table', () => {
  const segments = [{ id: 'screen-01' }, { id: 's01' }];
  const md = assemblyMd('vid', segments, [], 10.0, 'out.mp4', [{ at: 5, direction: 'left', fromIdx: 0, toIdx: 1 }]);
  assert.match(md, /Whip transitions at the listed boundaries/);
  assert.match(md, /## Transitions/);
  assert.match(md, /\| 00:05\.0 \| left \| screen-01 \| s01 \|/);
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

test('planAvatarBeats: 60s span snapped to seeded gaps', () => {
  const seg = { start: 0, end: 60 };
  const words = [
    { start: 0, end: 5 },
    { start: 5.5, end: 19 },
    { start: 20, end: 25 },
    { start: 25.5, end: 39 },
    { start: 40, end: 45 },
    { start: 45.5, end: 60 }
  ];
  const beats = planAvatarBeats(seg, words);
  assert.deepEqual(beats, [19.5, 39.5]);
});

test('planAvatarBeats: beat moved to nearest gap, not raw target', () => {
  const seg = { start: 10, end: 70 }; // 60s, targets at 30, 50
  const words = [
    { start: 10, end: 28 },
    { start: 29, end: 35 }, // gap at 28.5 (size 1) - closer to 30
    { start: 36, end: 48 }, // gap at 35.5 - further
    { start: 51, end: 60 } // gap at 49.5 - closer to 50
  ];
  const beats = planAvatarBeats(seg, words);
  assert.deepEqual(beats, [28.5, 49.5]);
});

test('planAvatarBeats: no gap within +-3s -> beat dropped', () => {
  const seg = { start: 0, end: 60 };
  const words = [
    { start: 0, end: 15 },
    { start: 15.5, end: 25 }, // gap at 15.25 (distance 4.75 from 20)
    { start: 25.5, end: 39 },
    { start: 40, end: 60 } // gap at 39.5 (distance 0.5 from 40)
  ];
  const beats = planAvatarBeats(seg, words);
  assert.deepEqual(beats, [39.5]); // 20 is dropped
});

test('planAvatarBeats: short span -> []', () => {
  const seg = { start: 0, end: 25 };
  const words = [
    { start: 0, end: 19 },
    { start: 20, end: 25 }
  ];
  const beats = planAvatarBeats(seg, words);
  assert.deepEqual(beats, []);
});

test('planAvatarBeats: beats respect the 8s edges', () => {
  const seg = { start: 0, end: 30 }; // targets at 20
  const words = [
    { start: 0, end: 22 },
    { start: 23, end: 30 } // gap at 22.5
  ];
  const beats = planAvatarBeats(seg, words);
  assert.deepEqual(beats, []);
});

test('splitAvatarSegments: alternating punch and passes others', () => {
  const segments = [
    { kind: 'screen', id: 'screen-01', start: 0, end: 10 },
    { kind: 'avatar', id: 'a1', start: 10, end: 70 },
    { kind: 'graphic', id: 'g1', start: 70, end: 80 }
  ];
  const words = [
    { start: 0, end: 29 },
    { start: 30, end: 49 },
    { start: 50, end: 70 }
  ];
  const out = splitAvatarSegments(segments, words);
  assert.equal(out.length, 5);
  assert.equal(out[0].kind, 'screen');
  assert.equal(out[1].sub, 0);
  assert.equal(out[1].start, 10);
  assert.equal(out[1].end, 29.5);
  assert.equal(out[1].punch, 1.0);
  assert.equal(out[1].flashOut, true);
  assert.equal(out[1].flashIn, undefined);
  
  assert.equal(out[2].sub, 1);
  assert.equal(out[2].start, 29.5);
  assert.equal(out[2].end, 49.5);
  assert.equal(out[2].punch, 1.08);
  assert.equal(out[2].flashIn, true);
  assert.equal(out[2].flashOut, true);
  
  assert.equal(out[3].sub, 2);
  assert.equal(out[3].start, 49.5);
  assert.equal(out[3].end, 70);
  assert.equal(out[3].punch, 1.0);
  assert.equal(out[3].flashIn, true);
  assert.equal(out[3].flashOut, undefined);
  
  assert.equal(out[4].kind, 'graphic');
});

test('Integration: ffmpeg runAssembly', { skip: spawnSync('ffmpeg', ['-version']).error ? 'ffmpeg not found' : false }, () => {
  fs.mkdirSync(path.join(testTmp, 'media'), { recursive: true });
  fs.mkdirSync(path.join(testTmp, 'renders'), { recursive: true });

  const voMp3 = path.join(testTmp, 'vo.mp3');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '68', '-q:a', '9', voMp3]);

  const screenMp4 = path.join(testTmp, 'screen.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=1920x1080:r=30', '-t', '68', '-pix_fmt', 'yuv420p', screenMp4]);

  const avatarFile = path.join(testTmp, 'media', 's01.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=red:s=1920x1080:r=30', '-t', '60', '-pix_fmt', 'yuv420p', avatarFile]);

  const ffFile = path.join(testTmp, 'renders', '0002-c1-green.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=green:s=1920x1080:r=30', '-t', '2', '-pix_fmt', 'yuv420p', ffFile]);

  const ovFile = path.join(testTmp, 'renders', '0004-o1-black.mov');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=black@0.0:s=1920x1080:r=30,format=yuva420p', '-t', '1', '-c:v', 'qtrle', ovFile]);

  const resolved = [
    { id: 'c1', placement: 'fullframe', start: 2, duration: 2, card: 'green' },
    { id: 'o1', placement: 'overlay', start: 4.5, duration: 1, card: 'black' }
  ];
  const avatarJobs = [
    { kind: 'avatar-full', id: 's01', start: 6, end: 66, file: avatarFile }
  ];
  const words = [
    { start: 0, end: 5 },
    { start: 6, end: 25 },
    { start: 26, end: 45 },
    { start: 46, end: 68 }
  ];
  // gaps at 5.5, 25.5, 45.5. Beats inside [6, 66] are 25.5, 45.5
  // sub-segment durations before trim: 19.5, 20.0, 20.5
  
  const outMp4 = path.join(testTmp, 'final.mp4');
  if (fs.existsSync(outMp4)) fs.unlinkSync(outMp4);

  assert.doesNotThrow(() => {
    runAssembly({
      workdir: testTmp,
      video: 'it',
      resolved,
      avatarJobs,
      total: 68,
      screen: screenMp4,
      out: outMp4,
      encoder: 'x264',
      keepTemp: true,
      beats: 'on',
      words
    });
  });

  const tmpDir = path.join(testTmp, 'assembly-tmp');
  assert.ok(!fs.existsSync(path.join(tmpDir, 'base.mp4')), 'base.mp4 should not exist in single-pass');
  const tsFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith('.ts'));
  assert.equal(tsFiles.length, 9, 'should have 9 segments including transition');
  
  const transFiles = tsFiles.filter(f => f.includes('-trans-'));
  assert.equal(transFiles.length, 2, 'should have 2 transition files');
  
  for (const tFile of transFiles) {
    const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(tmpDir, tFile)], { encoding: 'utf8' });
    const d = parseFloat(p.stdout);
    assert.ok(Math.abs(d - 0.4) <= 0.05, `transition duration ${d} not near 0.4`);
  }
  
  // check avatar sub-segments
  const avatarSubFiles = tsFiles.filter(f => f.includes('s01') && !f.includes('-trans-')).sort();
  assert.equal(avatarSubFiles.length, 3, 'should have 3 avatar sub-segments');
  
  const subDurations = [19.3, 20.0, 20.3]; // trimmed 0.2 off first and last
  for (let i = 0; i < 3; i++) {
    const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(tmpDir, avatarSubFiles[i])], { encoding: 'utf8' });
    const d = parseFloat(p.stdout);
    assert.ok(Math.abs(d - subDurations[i]) <= 0.05, `sub ${i} dur ${d} not near ${subDurations[i]}`);
  }
  
  fs.rmSync(tmpDir, { recursive: true, force: true });

  assert.ok(fs.existsSync(outMp4));
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', outMp4], { encoding: 'utf8' });
  const dur = parseFloat(probe.stdout);
  assert.ok(Math.abs(dur - 68) <= 0.5);

  const streamProbe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', outMp4], { encoding: 'utf8' });
  assert.equal(streamProbe.stdout.trim(), '1920x1080');

  const audioProbe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', outMp4], { encoding: 'utf8' });
  assert.match(audioProbe.stdout, /audio/);
});

test('Integration: ffmpeg draft runAssembly', { skip: spawnSync('ffmpeg', ['-version']).error ? 'ffmpeg not found' : false }, () => {
  const outDraft = path.join(testTmp, 'final-draft.mp4');
  if (fs.existsSync(outDraft)) fs.unlinkSync(outDraft);

  const resolved = [
    { id: 'c1', placement: 'fullframe', start: 2, duration: 2, card: 'green' },
    { id: 'o1', placement: 'overlay', start: 4.5, duration: 1, card: 'black' }
  ];
  const avatarJobs = [
    { kind: 'avatar-full', id: 's01', start: 6, end: 66, file: path.join(testTmp, 'media', 's01.mp4') }
  ];

  runAssembly({
    workdir: testTmp,
    video: 'it',
    resolved,
    avatarJobs,
    total: 68,
    screen: path.join(testTmp, 'screen.mp4'),
    out: outDraft,
    draft: true,
    encoder: 'x264',
    keepTemp: false,
    beats: 'off'
  });

  assert.ok(fs.existsSync(outDraft));
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', outDraft], { encoding: 'utf8' });
  const dur = parseFloat(probe.stdout);
  assert.ok(Math.abs(dur - 68) <= 0.5);

  const streamProbe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', outDraft], { encoding: 'utf8' });
  assert.equal(streamProbe.stdout.trim(), '1280x720');

  const audioProbe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', outDraft], { encoding: 'utf8' });
  assert.match(audioProbe.stdout, /audio/);
});

test('Integration: ffmpeg runAssembly none transitions', { skip: spawnSync('ffmpeg', ['-version']).error ? 'ffmpeg not found' : false }, () => {
  const outNone = path.join(testTmp, 'final-none.mp4');
  if (fs.existsSync(outNone)) fs.unlinkSync(outNone);

  const resolved = [
    { id: 'c1', placement: 'fullframe', start: 2, duration: 2, card: 'green' },
    { id: 'o1', placement: 'overlay', start: 4.5, duration: 1, card: 'black' }
  ];
  const avatarJobs = [
    { kind: 'avatar-full', id: 's01', start: 6, end: 66, file: path.join(testTmp, 'media', 's01.mp4') }
  ];
  
  const words = [
    { start: 0, end: 5 },
    { start: 6, end: 25 },
    { start: 26, end: 45 },
    { start: 46, end: 68 }
  ];

  runAssembly({
    workdir: testTmp,
    video: 'it',
    resolved,
    avatarJobs,
    total: 68,
    screen: path.join(testTmp, 'screen.mp4'),
    out: outNone,
    encoder: 'x264',
    keepTemp: true,
    transitions: 'none',
    beats: 'on',
    words
  });

  const tmpDir = path.join(testTmp, 'assembly-tmp');
  const tsFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith('.ts'));
  assert.equal(tsFiles.length, 7, 'should have 7 base segments, no transitions');
  const transFiles = tsFiles.filter(f => f.includes('-trans-'));
  assert.equal(transFiles.length, 0, 'should have 0 transition files');
  
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
