import test from 'node:test';
import assert from 'node:assert/strict';
import { runConfigErrors, canvasOf, modelsOf } from './run-config.mjs';

const good = { template: 'animate', video: 'my-video', designSystem: 'default', source: { audio: 'audio.wav', screen: null }, total: 10 };

test('a well-formed config passes and fills canvas and model defaults', () => {
  assert.deepEqual(runConfigErrors(good), []);
  assert.deepEqual(canvasOf(good), { w: 1920, h: 1080, fps: 30 });
  assert.deepEqual(canvasOf({ ...good, canvas: { w: 1080, h: 1920 } }), { w: 1080, h: 1920, fps: 30 });
  assert.equal(modelsOf({ ...good, models: { author: 'sonnet' } }).author, 'sonnet');
});

test('another recipe\'s workdir is refused by name', () => {
  assert.match(runConfigErrors({ ...good, template: undefined }).join(), /template must be "animate" \(got undefined\)/);
  assert.match(runConfigErrors({ ...good, template: 'coupon' }).join(), /got "coupon"/);
});

test('bad canvas, design system and source are reported', () => {
  const errs = runConfigErrors({ ...good, designSystem: 'My System', canvas: { w: 1081, fps: 0 }, source: {} }).join('\n');
  assert.match(errs, /designSystem/);
  assert.match(errs, /canvas.w must be a positive even integer/);
  assert.match(errs, /canvas.fps/);
  assert.match(errs, /source.audio is required/);
});
