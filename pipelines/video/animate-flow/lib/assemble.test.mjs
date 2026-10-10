import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { animateEditPlan, backgroundColour, bandBedArgs } from './assemble.mjs';
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

test('an overlay moment is a keyed overlay clip, so the recording keeps playing under it', () => {
  const plan = animateEditPlan({ cfg, moments: [{ id: 'm01', start: 2, end: 8 }, { id: 'm02', kind: 'overlay', start: 10, end: 14 }], media: '/m', clipOf: (id) => `/m/${id}.mp4`, bed: '/b' });
  assert.equal(validateEditPlan(plan), plan);
  assert.deepEqual(plan.clips[2], { kind: 'card', layer: 'overlay', id: 'm02', start: 10, end: 14, src: '/m/m02.mp4', chroma: '0x00FF00' });
  assert.equal(plan.clips[1].kind, 'composition');
});

test('a tall format lays the recording in its band on the background, never a crop', () => {
  const args = bandBedArgs('/m/screen.mp4', '9:16', '#0a0805', '/m/bed-9x16.mp4').join(' ');
  assert.match(args, /scale=1080:608,pad=1080:1920:0:656:color=0x0a0805/);
  const plan = animateEditPlan({ cfg, moments, media: '/m', clipOf: (id) => id, bed: '/b', canvas: { w: 1080, h: 1920, fps: 30 } });
  assert.deepEqual(plan.canvas, { w: 1080, h: 1920, fps: 30 });
});

test('the plain bed takes the design system background', () => {
  assert.equal(backgroundColour('default'), '#0a0805');
});
