import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { planSegments, assemblyMd, runAssembly, planSegmentOverlays, encoderArgs, detectEncoder, planTransitions, planAvatarBeats, splitAvatarSegments, driftVF, absorbSlivers } from './assemble.mjs';

const testTmp = path.resolve(import.meta.dirname, '.test-tmp', 'assemble-it');


test('absorbSlivers: 1.4s sliver between avatar and graphic -> graphic absorbs with padStart', () => {
  const segments = [
    { kind: 'avatar', start: 0, end: 10, id: 'a1' },
    { kind: 'screen', start: 10, end: 11.4, id: 's1' },
    { kind: 'graphic', start: 11.4, end: 20, id: 'g1' }
  ];
  const out = absorbSlivers(segments);
  assert.equal(out.length, 2);
  assert.equal(out[0].kind, 'avatar');
  assert.equal(out[0].end, 10);
  assert.equal(out[1].kind, 'graphic');
  assert.equal(out[1].start, 10);
  assert.equal(out[1].padStart, 1.4);
});

test('absorbSlivers: 0.4s sliver at t=0 before avatar -> avatar absorbs with padStart', () => {
  const segments = [
    { kind: 'screen', start: 0, end: 0.4, id: 's1' },
    { kind: 'avatar', start: 0.4, end: 10, id: 'a1' }
  ];
  const out = absorbSlivers(segments);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'avatar');
  assert.equal(out[0].start, 0);
  assert.equal(out[0].padStart, 0.4);
});

test('absorbSlivers: 2s sliver between two avatars -> NOT absorbed (over avatarMax)', () => {
  const segments = [
    { kind: 'avatar', start: 0, end: 10, id: 'a1' },
    { kind: 'screen', start: 10, end: 12.0, id: 's1' },
    { kind: 'avatar', start: 12.0, end: 20, id: 'a2' }
  ];
  const out = absorbSlivers(segments);
  assert.equal(out.length, 3);
  assert.equal(out[1].kind, 'screen');
});

test('absorbSlivers: 6s screen segment untouched', () => {
  const segments = [
    { kind: 'graphic', start: 0, end: 10, id: 'g1' },
    { kind: 'screen', start: 10, end: 16, id: 's1' },
    { kind: 'graphic', start: 16, end: 20, id: 'g2' }
  ];
  const out = absorbSlivers(segments);
  assert.equal(out.length, 3);
  assert.equal(out[1].kind, 'screen');
});

test('absorbSlivers: output remains contiguous 0->total', () => {
  const segments = [
    { kind: 'screen', start: 0, end: 1, id: 's1' },
    { kind: 'avatar', start: 1, end: 5, id: 'a1' },
    { kind: 'screen', start: 5, end: 5.5, id: 's2' },
    { kind: 'graphic', start: 5.5, end: 10, id: 'g1' },
    { kind: 'screen', start: 10, end: 10.5, id: 's3' }
  ];
  const out = absorbSlivers(segments);
  assert.equal(out[0].start, 0);
  for (let i = 1; i < out.length; i++) {
    assert.equal(out[i-1].end, out[i].start);
  }
  assert.equal(out[out.length - 1].end, 10.5);
});

test('driftVF: short segment -> empty string', () => {
  assert.equal(driftVF(0, 3.9, 1920, 1080), '');
});

test('driftVF: even ordinal pushes in over min(dur, period) then holds', () => {
  const vf = driftVF(0, 15, 1920, 1080, { max: 0.05, period: 30, minSeg: 4 });
  assert.ok(vf.includes("scale=w='trunc(iw*(1+0.05*min(t/15.000,1))/2)*2'"), vf);
  assert.ok(vf.includes(':eval=frame,crop=1920:1080'), vf);
});

test('driftVF: odd ordinal releases; long segment ramps over period only', () => {
  const vf = driftVF(1, 40, 1920, 1080, { max: 0.05, period: 30, minSeg: 4 });
  assert.ok(vf.includes("scale=w='trunc(iw*(1+0.05*max(1-t/30.000,0))/2)*2'"), vf);
});

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

test('planTransitions: avatar>screen direction', () => {
  const segments = [
    { kind: 'screen', start: 0, end: 5 },
    { kind: 'avatar', start: 5, end: 10 },
    { kind: 'screen', start: 10, end: 15 }
  ];
  const out = planTransitions(segments, []);
  assert.deepEqual(out, [
    { at: 10, direction: 'right', fromIdx: 1, toIdx: 2 }
  ]);
});

test('planTransitions: graphic boundaries produce flash on in, nothing on out', () => {
  const segments = [
    { kind: 'screen', start: 0, end: 5 },
    { kind: 'graphic', start: 5, end: 10 },
    { kind: 'screen', start: 10, end: 15 }
  ];
  assert.deepEqual(planTransitions(segments, []), [
    { at: 5, direction: 'right', fromIdx: 0, toIdx: 1 }
  ]);
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
    { kind: 'avatar', start: 0, end: 5 },
    { kind: 'screen', start: 5, end: 10 }
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
    { at: 5, direction: 'right', fromIdx: 0, toIdx: 1 }
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

test('planAvatarBeats: short span (<45s) -> []', () => {
  const seg = { start: 0, end: 30 };
  const words = [
    { start: 0, end: 19 },
    { start: 20, end: 30 }
  ];
  const beats = planAvatarBeats(seg, words);
  assert.deepEqual(beats, []);
});

test('planAvatarBeats: beats respect the 8s edges', () => {
  const seg = { start: 0, end: 48 }; // hi=40. targets 20, 40
  const words = [
    { start: 0, end: 40 },
    { start: 42, end: 48 } // gap at 41 (too high, > hi)
  ];
  const beats = planAvatarBeats(seg, words);
  // at target 20 there are no gaps within +-3s (17-23). 
  // at target 40, gap is at 41, but 41 > hi (40).
  assert.deepEqual(beats, []);
});

test('planAvatarBeats: cue within window wins over closer gap', () => {
  const seg = { start: 0, end: 60 }; // target 20
  const words = [
    { start: 0, end: 19.5 },
    { start: 20.5, end: 60 } // gap at 20.0
  ];
  // cue at 22 is in window (20 +- 3), gap is at 20. Cue should win.
  const beats = planAvatarBeats(seg, words, { cueTimes: [22] });
  assert.deepEqual(beats, [22]);
});

test('planAvatarBeats: no in-window cue -> gap fallback unchanged', () => {
  const seg = { start: 0, end: 60 }; // target 20
  const words = [
    { start: 0, end: 19.5 },
    { start: 20.5, end: 60 } // gap at 20.0
  ];
  // cue at 24 is outside window (20 +- 3), so gap at 20 should win.
  const beats = planAvatarBeats(seg, words, { cueTimes: [24] });
  assert.deepEqual(beats, [20]);
});

test('planAvatarBeats: cue outside [lo, hi] is ignored', () => {
  const seg = { start: 0, end: 48 }; // hi is 40. targets 20, 40
  const words = [
    { start: 0, end: 19.5 },
    { start: 20.5, end: 39 }, // gap at 20.0
    { start: 40, end: 48 } // gap at 39.5
  ];
  // cue at 41 is inside window (40 +- 3) but > hi (40). Should be ignored, fallback to gap 39.5.
  const beats = planAvatarBeats(seg, words, { cueTimes: [41] });
  assert.deepEqual(beats, [20, 39.5]);
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
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=1920x1080:r=30,drawgrid=width=100:height=100:thickness=2:color=red', '-t', '68', '-pix_fmt', 'yuv420p', screenMp4]);

  const avatarFile = path.join(testTmp, 'media', 's01.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=red:s=1920x1080:r=30', '-t', '62', '-pix_fmt', 'yuv420p', avatarFile]);

  const ffFile = path.join(testTmp, 'renders', '0003-c1-green.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=green:s=1920x1080:r=30', '-t', '2', '-pix_fmt', 'yuv420p', ffFile]);

  const ovFile = path.join(testTmp, 'renders', '0005-o1-black.mov');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=black@0.0:s=1920x1080:r=30,format=yuva420p', '-t', '1', '-c:v', 'qtrle', ovFile]);

  const resolved = [
    { id: 'c1', placement: 'fullframe', start: 3, duration: 2, card: 'green' },
    { id: 'o1', placement: 'overlay', start: 5.5, duration: 1, card: 'black' }
  ];
  const avatarJobs = [
    { kind: 'avatar-full', id: 's01', start: 6, end: 66, file: avatarFile } // restored back to 6 from 6 to 5 to make the screen between c1 (ends 4) and s01 (starts 5) exactly 1.0s, which gets absorbed
  ];
  const words = [
    { start: 0, end: 5, word: 'hello_world' },
    { start: 6, end: 25, word: 'something_else' },
    { start: 26, end: 45, word: 'third_chunk' },
    { start: 46, end: 68, word: 'final_words' }
  ];
  // gaps at 5.5, 25.5, 45.5. Beats inside [6, 66] are 25.5, 45.5
  // sub-segment durations before trim: 19.5, 20.0, 20.5
  
  const outMp4 = path.join(testTmp, 'final.mp4');
  if (fs.existsSync(outMp4)) fs.unlinkSync(outMp4);

  const tmpDir = path.join(testTmp, 'assembly-tmp');
  fs.rmSync(tmpDir, { recursive: true, force: true });

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

  assert.ok(!fs.existsSync(path.join(tmpDir, 'base.mp4')), 'base.mp4 should not exist in single-pass');
  const tsFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith('.ts'));
  assert.equal(tsFiles.length, 10, 'should have 10 segments including transitions');
  
  const transFiles = tsFiles.filter(f => f.includes('-trans-'));
  assert.equal(transFiles.length, 4, 'should have 4 transition files');
  
  for (const tFile of transFiles) {
    const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(tmpDir, tFile)], { encoding: 'utf8' });
    const d = parseFloat(p.stdout);
    assert.ok(Math.abs(d - 0.1) <= 0.04, `transition duration ${d} not near 0.1`);
  }
  
  // check avatar sub-segments
  const avatarSubFiles = tsFiles.filter(f => f.includes('s01') && !f.includes('-trans-')).sort();
  assert.equal(avatarSubFiles.length, 3, 'should have 3 avatar sub-segments');
  
  const subDurations = [19.5, 20.0, 20.4]; // trimmed 0.1 off first and last
  for (let i = 0; i < 3; i++) {
    const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(tmpDir, avatarSubFiles[i])], { encoding: 'utf8' });
    const d = parseFloat(p.stdout);
    assert.ok(Math.abs(d - subDurations[i]) <= 0.05, `sub ${i} dur ${d} not near ${subDurations[i]}`);
  }
  
  // Check captions
  const capDir = path.join(tmpDir, 'captions');
  assert.ok(fs.existsSync(capDir), 'captions dir should exist');
  const caps = fs.readdirSync(capDir).filter(f => f.endsWith('.png'));
  assert.ok(caps.length > 0, 'captions generated');
  
  fs.rmSync(tmpDir, { recursive: true, force: true });

  const capFrame = path.join(testTmp, 'cap-frame.png');
  spawnSync('ffmpeg', ['-y', '-ss', '1', '-i', outMp4, '-frames:v', '1', '-pix_fmt', 'gray', capFrame]);
  
  const avFrame = path.join(testTmp, 'av-frame.png');
  spawnSync('ffmpeg', ['-y', '-ss', '10', '-i', outMp4, '-frames:v', '1', '-pix_fmt', 'gray', avFrame]);
  
  const getMean = (file) => {
    const cropStr = 'crop=in_w:in_h*0.2:0:in_h*0.8';
    const p = spawnSync('ffprobe', ['-v', 'error', '-f', 'lavfi', '-i', `movie=${file},${cropStr},signalstats`, '-show_entries', 'frame_tags=lavfi.signalstats.YAVG', '-of', 'csv=p=0'], { encoding: 'utf8' });
    return parseFloat(p.stdout);
  };
  
  const meanCap = getMean(capFrame);
  const meanAv = getMean(avFrame);
  assert.ok(Math.abs(meanCap - meanAv) >= 2, `luma diff too small: cap=${meanCap}, av=${meanAv}`);


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
    { id: 'c1', placement: 'fullframe', start: 3, duration: 2, card: 'green' },
    { id: 'o1', placement: 'overlay', start: 5.5, duration: 1, card: 'black' }
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
  const tmpDirNone = path.join(testTmp, 'assembly-tmp');
  fs.rmSync(tmpDirNone, { recursive: true, force: true });
  const outNone = path.join(testTmp, 'final-none.mp4');
  if (fs.existsSync(outNone)) fs.unlinkSync(outNone);

  const resolved = [
    { id: 'c1', placement: 'fullframe', start: 3, duration: 2, card: 'green' },
    { id: 'o1', placement: 'overlay', start: 5.5, duration: 1, card: 'black' }
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
  assert.equal(tsFiles.length, 6, 'should have 6 base segments, no transitions');
  const transFiles = tsFiles.filter(f => f.includes('-trans-'));
  assert.equal(transFiles.length, 0, 'should have 0 transition files');
  
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Integration: ffmpeg runAssembly captions off', { skip: spawnSync('ffmpeg', ['-version']).error ? 'ffmpeg not found' : false }, () => {
  const tmpDirOff = path.join(testTmp, 'assembly-tmp');
  fs.rmSync(tmpDirOff, { recursive: true, force: true });
  const outOff = path.join(testTmp, 'final-cap-off.mp4');
  if (fs.existsSync(outOff)) fs.unlinkSync(outOff);

  const resolved = [
    { id: 'c1', placement: 'fullframe', start: 3, duration: 2, card: 'green' }
  ];
  const avatarJobs = [];
  
  const words = [
    { start: 0, end: 5, word: 'hello_world' }
  ];

  runAssembly({
    workdir: testTmp,
    video: 'it',
    resolved,
    avatarJobs,
    total: 10,
    screen: path.join(testTmp, 'screen.mp4'),
    out: outOff,
    encoder: 'x264',
    keepTemp: true,
    transitions: 'none',
    beats: 'on',
    captions: 'off',
    words
  });

  const tmpDir2 = path.join(testTmp, 'assembly-tmp');
  const capDir = path.join(tmpDir2, 'captions');
  assert.ok(!fs.existsSync(capDir), 'captions dir should NOT exist');
  
  const tsFiles2 = fs.readdirSync(tmpDir2).filter(f => f.endsWith('.ts'));
  // 1 screen, 1 graphic, 1 screen = 3 segments
  assert.equal(tsFiles2.length, 3, 'segment count unchanged when captions off');
  
  fs.rmSync(tmpDir2, { recursive: true, force: true });
});

test('Integration: drift on vs off', { skip: spawnSync('ffmpeg', ['-version']).error ? 'ffmpeg not found' : false }, () => {
  const tmpDir = path.join(testTmp, 'assembly-tmp');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  const outDriftOn = path.join(testTmp, 'final-drift-on.mp4');
  const outDriftOff = path.join(testTmp, 'final-drift-off.mp4');

  // A STATIC but textured screen source: smptehdbars' uniform blocks defeat
  // the zoom probe (a solid corner has the same luma at any zoom), and live
  // testsrc2 animates (breaking the drift-off identity check) — so freeze one
  // textured testsrc2 frame and loop it.
  const screenStill = path.join(testTmp, 'screen-still.png');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30', '-frames:v', '1', screenStill]);
  const screenDriftMp4 = path.join(testTmp, 'screen-drift.mp4');
  spawnSync('ffmpeg', ['-y', '-loop', '1', '-i', screenStill, '-t', '6', '-r', '30', '-pix_fmt', 'yuv420p', screenDriftMp4]);

  runAssembly({
    workdir: testTmp,
    video: 'it',
    resolved: [],
    avatarJobs: [],
    total: 6,
    screen: screenDriftMp4,
    out: outDriftOn,
    encoder: 'x264',
    keepTemp: true,
    transitions: 'none',
    beats: 'off',
    captions: 'off',
    drift: 'on',
    words: []
  });

  runAssembly({
    workdir: testTmp,
    video: 'it',
    resolved: [],
    avatarJobs: [],
    total: 6,
    screen: screenDriftMp4,
    out: outDriftOff,
    encoder: 'x264',
    keepTemp: false,
    transitions: 'none',
    beats: 'off',
    captions: 'off',
    drift: 'off',
    words: []
  });

  const getMean = (file, time) => {
    // Check edge region (crossing the first bar boundary in smptehdbars) to easily spot zoom diffs
    const cropStr = 'crop=in_w*0.2:in_h*0.1:0:0';
    const p = spawnSync('ffprobe', ['-v', 'error', '-f', 'lavfi', '-i', `movie=${file},trim=start=${time}:end=${time+0.1},${cropStr},signalstats`, '-show_entries', 'frame_tags=lavfi.signalstats.YAVG', '-of', 'csv=p=0'], { encoding: 'utf8' });
    return parseFloat(p.stdout.split('\n')[0]);
  };

  // With drift on, frame at t=0 and t=5 should differ because it zooms in
  const onMean0 = getMean(outDriftOn, 0.5);
  const onMean5 = getMean(outDriftOn, 5.5);
  assert.ok(Math.abs(onMean0 - onMean5) >= 0.5, `drift ON frames should differ, got ${onMean0} vs ${onMean5}`);

  // With drift off, frame at t=0 and t=5 should be exactly the same
  const offMean0 = getMean(outDriftOff, 0.5);
  const offMean5 = getMean(outDriftOff, 5.5);
  assert.ok(Math.abs(offMean0 - offMean5) < 0.1, `drift OFF frames should match, got ${offMean0} vs ${offMean5}`);
});

