import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as whipMod from './effects/whip.mjs';
import * as beatsMod from './effects/beats.mjs';
import { whipFlashEnvelope, beatEnvelope, envelopeExpr, planFx, fxRenderArgs } from './render-fx.mjs';

test('whipFlashEnvelope', () => {
  const env = whipFlashEnvelope();
  assert.strictEqual(env.length, 6);
  assert.strictEqual(env[0], env[5]);
  assert.strictEqual(env[1], env[4]);
  const peak = +(whipMod.CONSTANTS.FLASH_GAIN * (2.5 / 3)).toFixed(3);
  assert.strictEqual(env[2], peak);
});

test('beatEnvelope', () => {
  const env = beatEnvelope();
  const expected = [...beatsMod.CONSTANTS.FLASH_OUT_OPACITIES, ...beatsMod.CONSTANTS.FLASH_IN_OPACITIES, ...beatsMod.CONSTANTS.FLASH_BAND_OPACITIES];
  assert.deepStrictEqual(env, expected);
});

test('envelopeExpr', () => {
  assert.strictEqual(envelopeExpr([1, 0.5]), 'if(lt(N,1),255,if(lt(N,2),128,0))');
});

test('planFx', () => {
  const instances = [
    { id: 'w1', type: 'whip', style: 'flash', at: 10, enabled: true },
    { id: 'w2', type: 'whip', style: 'flash', at: 15, enabled: false },
    { id: 'w3', type: 'whip', style: 'blur', at: 20, enabled: true },
    { id: 'b1', type: 'beat', at: 30, punch: 1.08, enabled: true },
    { id: 'd1', type: 'drift', at: 40, enabled: true },
    { id: 'bu1', type: 'bubble', at: 50, enabled: true },
    { id: 'c1', type: 'captions', enabled: true }
  ];
  const { rendered, dropped } = planFx(instances);

  // w1: rendered, timelineStart = 9.9
  assert.ok(rendered.find(r => r.id === 'w1' && r.type === 'whip-flash' && r.timelineStart === 9.9));
  
  // w2: disabled, absent
  assert.ok(!rendered.find(r => r.id === 'w2'));
  assert.ok(!dropped.find(d => d.id === 'w2'));
  
  // w3: dropped as whip-blur
  assert.ok(dropped.find(d => d.id === 'w3' && d.type === 'whip-blur'));
  
  // b1: rendered as beat-flash AND dropped as beat-punch
  assert.ok(rendered.find(r => r.id === 'b1' && r.type === 'beat-flash' && r.timelineStart === 29.9));
  assert.ok(dropped.find(d => d.id === 'b1-punch' && d.type === 'beat-punch'));
  
  // d1: dropped as drift
  assert.ok(dropped.find(d => d.id === 'd1' && d.type === 'drift'));
  
  // bu1: dropped as bubble
  assert.ok(dropped.find(d => d.id === 'bu1' && d.type === 'bubble'));
  
  // c1: absent
  assert.ok(!rendered.find(r => r.id === 'c1'));
  assert.ok(!dropped.find(d => d.id === 'c1'));
});

test('fxRenderArgs', () => {
  const args = fxRenderArgs({ envelope: Array(6).fill(1), outFile: 'out.mov' });
  assert.ok(args.includes('prores_ks'));
  assert.ok(args.includes('yuva444p10le'));
  const framesIdx = args.indexOf('-frames:v');
  assert.strictEqual(args[framesIdx + 1], '6');
  
  const lavfiIdx = args.indexOf('-i');
  assert.ok(args[lavfiIdx + 1].includes(`c0=${beatsMod.CONSTANTS.FLASH_COLOR}`));
});

test('Integration: ffmpeg fx clip', { skip: spawnSync('ffmpeg', ['-version']).error ? 'ffmpeg not found' : false }, async () => {
  const outDir = path.join(process.cwd(), 'lib', '.test-tmp', 'render-fx');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'flash.mov');

  const args = fxRenderArgs({ envelope: whipFlashEnvelope(), outFile });
  const res = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  assert.strictEqual(res.status, 0, 'ffmpeg render failed');

  const formatProbe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,pix_fmt', '-of', 'csv=p=0', outFile], { encoding: 'utf8' });
  assert.strictEqual(formatProbe.stdout.trim(), 'prores,yuva444p12le');

  const framesProbe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=nb_frames', '-of', 'csv=p=0', outFile], { encoding: 'utf8' });
  assert.strictEqual(framesProbe.stdout.trim(), '6');

  const alphaProbe = spawnSync('ffprobe', ['-v', 'error', '-f', 'lavfi', '-i', `movie=${outFile},alphaextract,signalstats`, '-show_entries', 'frame_tags=lavfi.signalstats.YAVG', '-of', 'csv=p=0'], { encoding: 'utf8' });
  const lines = alphaProbe.stdout.trim().split('\n').filter(Boolean).map(parseFloat);
  assert.strictEqual(lines.length, 6);
  assert.ok(lines[2] > lines[0], 'alpha peak should be > start');

  fs.rmSync(outDir, { recursive: true, force: true });
});
