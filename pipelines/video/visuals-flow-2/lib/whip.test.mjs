import test from 'node:test';
import assert from 'node:assert';
import * as whipMod from './effects/whip.mjs';

test('plan() emits style:blur for avatar>screen and style:flash for *>graphic, nothing for graphic>* or screen>avatar', () => {
  const segments = [
    { kind: 'screen', id: 's1', start: 0, end: 10 },
    { kind: 'graphic', id: 'g1', start: 10, end: 16 },
    { kind: 'screen', id: 's2', start: 16, end: 30 },
    { kind: 'avatar', id: 'a1', start: 30, end: 40 },
    { kind: 'screen', id: 's3', start: 40, end: 50 },
  ];
  const out = whipMod.plan({ segments, overlays: [] });
  assert.strictEqual(out.length, 2);
  
  assert.strictEqual(out[0].at, 10);
  assert.strictEqual(out[0].style, 'flash'); // screen>graphic
  
  assert.strictEqual(out[1].at, 40);
  assert.strictEqual(out[1].style, 'blur');
  
  // Note: 16 is graphic>screen, which should be ignored
  // Note: 30 is screen>avatar, which should be ignored
});

test('plan() skips boundaries with an overlapping overlay and <1s segments', () => {
  const segments = [
    { kind: 'screen', id: 's1', start: 0, end: 10 },
    { kind: 'graphic', id: 'g1', start: 10, end: 10.5 }, // < 1s
    { kind: 'screen', id: 's2', start: 10.5, end: 20 },
    { kind: 'graphic', id: 'g2', start: 20, end: 30 } // valid length, but overlay overlaps
  ];
  const overlays = [
    { start: 19.9, end: 20.2 } // overlaps transition at 20 (half duration = 0.1s, window is 19.9 to 20.1)
  ];
  const out = whipMod.plan({ segments, overlays });
  assert.strictEqual(out.length, 0);
});

test('boundarySegments() flash chain shape', () => {
  const segments = [
    { kind: 'screen', id: 's1', start: 0, end: 10 },
    { kind: 'graphic', id: 'g1', start: 10, end: 20 }
  ];
  const instance = { at: 10, style: 'flash' };
  const ctx = {
    segments,
    screenOffset: 0,
    w: 1920, h: 1080, VF: 'dummyVF',
    screen: 'screen.mp4',
    resolved: [{ id: 'g1' }],
    graphicFile: () => '/tmp/g1.mp4'
  };
  const res = whipMod.boundarySegments(instance, ctx);
  assert.strictEqual(res.extraSegments.length, 2);
  
  const [outSeg, inSeg] = res.extraSegments;
  
  // Check chainOut
  assert.ok(outSeg.chain.includes('eq=brightness='), 'chainOut missing eq=brightness=');
  assert.ok(outSeg.chain.includes('colorchannelmixer'), 'chainOut missing colorchannelmixer');
  assert.ok(!outSeg.chain.includes('crop='), 'chainOut should not contain crop=');
  
  // Check chainIn
  assert.ok(inSeg.chain.includes('eq=brightness='), 'chainIn missing eq=brightness=');
  assert.ok(inSeg.chain.includes('colorchannelmixer'), 'chainIn missing colorchannelmixer');
  assert.ok(!inSeg.chain.includes('crop='), 'chainIn should not contain crop=');
});

test('plan() emits style:register for concept span boundaries', () => {
  const segments = [];
  const conceptSpans = [
    { start: 0, end: 10, register: 'dark' },
    { start: 10, end: 20, register: 'light' },
    { start: 20, end: 30, register: 'dark' },
    { start: 30, end: 40, register: 'dark' } // same register, no transition
  ];
  
  const out = whipMod.plan({ segments, overlays: [], conceptSpans });
  assert.strictEqual(out.length, 2);
  
  assert.strictEqual(out[0].at, 10);
  assert.strictEqual(out[0].style, 'register');
  assert.strictEqual(out[0].direction, 'lift');
  
  assert.strictEqual(out[1].at, 20);
  assert.strictEqual(out[1].style, 'register');
  assert.strictEqual(out[1].direction, 'drop');
});

test('boundarySegments() register chain shape', () => {
  const segments = [
    { kind: 'screen', id: 's1', start: 0, end: 10 },
    { kind: 'screen', id: 's2', start: 10, end: 20 }
  ];
  const instance = { at: 10, style: 'register', direction: 'lift' };
  const ctx = {
    segments,
    screenOffset: 0,
    w: 1920, h: 1080, VF: 'dummyVF',
    screen: 'screen.mp4',
    resolved: [],
    graphicFile: () => ''
  };
  const res = whipMod.boundarySegments(instance, ctx);
  assert.strictEqual(res.extraSegments.length, 2);
  
  const [outSeg, inSeg] = res.extraSegments;
  
  assert.strictEqual(outSeg.dur, 0.2); // half duration of 0.4s dip
  assert.ok(outSeg.chain.includes('fade=t=out:st=0:d=0.2'), 'chainOut missing fade=t=out');
  
  assert.strictEqual(inSeg.dur, 0.2); // half duration of 0.4s dip
  assert.ok(inSeg.chain.includes('fade=t=in:st=0:d=0.2'), 'chainIn missing fade=t=in');
});
