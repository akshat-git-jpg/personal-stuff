import test from 'node:test';
import assert from 'node:assert';
import { audioExtractArgs, screenNormaliseArgs } from './intake.mjs';

test('audioExtractArgs', () => {
  const args = audioExtractArgs('in.mp4', 'out.mp3');
  assert.strictEqual(args[2], 'in.mp4');
  assert.strictEqual(args[args.length - 1], 'out.mp3');
  assert.ok(args.includes('-vn'), 'has -vn');
  assert.ok(args.includes('-ac'), 'has -ac');
  assert.strictEqual(args[args.indexOf('-ac') + 1], '1', 'mono audio');
  assert.ok(args.includes('-ar'), 'has -ar');
  assert.strictEqual(args[args.indexOf('-ar') + 1], '16000', '16kHz sample rate');
});

test('screenNormaliseArgs', () => {
  const args = screenNormaliseArgs('in.mp4', 'out.mp4');
  assert.strictEqual(args[2], 'in.mp4');
  assert.strictEqual(args[args.length - 1], 'out.mp4');
  assert.ok(args.includes('-an'), 'has -an');
  assert.ok(args.includes('-vf'), 'has -vf');
  
  const vfIndex = args.indexOf('-vf');
  const vfArg = args[vfIndex + 1];
  assert.ok(vfArg.includes('scale=1920:1080:force_original_aspect_ratio=decrease'), 'has scale filter');
  assert.ok(vfArg.includes('pad=1920:1080:(ow-iw)/2:(oh-ih)/2'), 'has pad filter');
  assert.ok(vfArg.includes('fps=30'), 'has fps filter');
});
