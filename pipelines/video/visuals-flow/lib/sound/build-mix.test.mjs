import test from 'node:test';
import assert from 'node:assert';
import { buildMixArgs } from './build-mix.mjs';

test('buildMixArgs no music', () => {
  const instances = [
    { at: 1.5, sample: 'pop', semi: 0, gainDb: -16 },
    { at: 2.0, sample: 'thock', semi: 4, gainDb: -14 }
  ];
  
  const args = buildMixArgs({
    voPath: 'vo.mp3',
    instances,
    musicPath: null,
    total: 10,
    outPath: 'master.wav',
    workdir: '/tmp'
  });
  
  const filterStr = args[args.indexOf('-filter_complex') + 1];
  
  // No music
  assert.ok(!filterStr.includes('sidechaincompress'));
  
  // Adelay
  assert.ok(filterStr.includes('adelay=delays=1500:all=1'));
  assert.ok(filterStr.includes('adelay=delays=2000:all=1'));
  
  // Pitch chain only when semi != 0
  const assetrates = filterStr.match(/asetrate/g) || [];
  assert.strictEqual(assetrates.length, 1);
  
  // Loudnorm once
  const loudnorms = filterStr.match(/loudnorm/g) || [];
  assert.strictEqual(loudnorms.length, 1);
});

test('buildMixArgs with music', () => {
  const instances = [
    { at: 1.0, sample: 'whoosh-up', semi: 0, gainDb: -14 }
  ];
  
  const args = buildMixArgs({
    voPath: 'vo.mp3',
    instances,
    musicPath: 'music.mp3',
    total: 10,
    outPath: 'master.wav',
    workdir: '/tmp'
  });
  
  const filterStr = args[args.indexOf('-filter_complex') + 1];
  
  assert.ok(filterStr.includes('sidechaincompress'));
  assert.ok(args.includes('-stream_loop'));
});

test('the master is pinned to the voiceover length regardless of late effects', () => {
  // amix defaults to duration=longest, so an effect whose tail runs past the
  // VO used to lengthen the master and fail the frame-exact gate at 460.
  const args = buildMixArgs({
    voPath: 'vo.mp3',
    instances: [{ at: 9.9, sample: 'success', semi: 0, gainDb: -14 }],
    musicPath: null,
    total: 10,
    outPath: 'master.wav',
    workdir: '/tmp',
  });
  const fc = args[args.indexOf('-filter_complex') + 1];
  assert.match(fc, /atrim=0:10/, 'master is trimmed to the voiceover length');
  assert.match(fc, /apad=whole_dur=10/, 'master is padded to the voiceover length');
  const master = fc.split(';').find((c) => c.includes('[master]'));
  assert.ok(master.indexOf('loudnorm') < master.indexOf('atrim'),
    'the length pin runs AFTER loudnorm, which can itself shift duration');
});
