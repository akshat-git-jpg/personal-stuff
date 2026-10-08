import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { animateEditPlan, backgroundColour } from './assemble.mjs';
import { validateEditPlan, editPlanErrors } from './kit.mjs';

const cfg = { template: 'animate', video: 'v', designSystem: 'default', total: 30, source: { audio: 'audio.wav', screen: 'screen.mp4' } };
const moments = [{ id: 'm01', start: 2, end: 8 }, { id: 'm02', start: 8, end: 12 }, { id: 'm03', start: 20, end: 26.5 }];

test('moments become base-layer compositions over the bed, with the voiceover as plan audio', () => {
  const plan = animateEditPlan({ cfg, moments, media: '/m', clipOf: (id) => `/m/moments/${id}.mp4`, bed: '/m/screen.mp4' });
  assert.equal(validateEditPlan(plan), plan);
  assert.deepEqual(plan.audio, { src: path.join('/m', 'audio.wav') });
  assert.deepEqual(plan.canvas, { w: 1920, h: 1080, fps: 30 });
  assert.deepEqual(plan.clips.map((c) => [c.kind, c.id, c.start, c.end]), [
    ['footage', 'bed', undefined, undefined], ['composition', 'm01', 2, 8], ['composition', 'm02', 8, 12], ['composition', 'm03', 20, 26.5]]);
});

test('the kit refuses moments that overlap', () => {
  const plan = animateEditPlan({ cfg, moments: [{ id: 'm01', start: 2, end: 9 }, { id: 'm02', start: 8, end: 12 }], media: '/m', clipOf: (id) => id, bed: '/b' });
  assert.match(editPlanErrors(plan).join(), /overlapping base clips: m01 ends 9, m02 starts 8/);
});

test('the plain bed takes the design system background', () => {
  assert.equal(backgroundColour('default'), '#0a0805');
});
