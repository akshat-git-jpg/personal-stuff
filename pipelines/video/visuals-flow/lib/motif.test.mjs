import test from 'node:test';
import assert from 'node:assert';
import * as motifMod from './effects/motif.mjs';

test('plan() produces no instances if zero motif cues', () => {
  const ctx = {
    resolved: [
      { id: 'c1', start: 10, duration: 5 }
    ]
  };
  const out = motifMod.plan(ctx);
  assert.strictEqual(out.length, 0);
});

test('plan() produces ONE instance spanning from first to last motif cue', () => {
  const ctx = {
    resolved: [
      { id: 'c1', start: 10, duration: 5, motif: true, variables: { beats: [{ at: 2 }] } },
      { id: 'c2', start: 20, duration: 5 }, // not motif
      { id: 'c3', start: 30, duration: 5, motif: true }
    ]
  };
  const out = motifMod.plan(ctx);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].start, 12); // c1 start (10) + first beat (2)
  assert.strictEqual(out[0].end, 35); // c3 start (30) + duration (5)
});

test('contribute() renders 3% white with 1s fades', () => {
  const ctx = { startTrim: 0, w: 1920, h: 1080, dur: 10 };
  const instances = [{ id: 'motif-overlay', start: 10, end: 20 }];
  
  // Test segment that fully overlaps
  const seg1 = { id: 's1', start: 12, end: 15 };
  const out1 = motifMod.contribute(seg1, instances, ctx);
  assert.ok(out1);
  const chain1 = out1.chainFragments[0]('in_v', { idx: 0 }).chain;
  assert.ok(chain1.includes('color=c=white:s=1x1:d=10,format=rgba'));
  assert.ok(chain1.includes("a='255*0.03*clip(t+12-10,0,1)*clip(20-(t+12),0,1)'"));
  
  // Test segment before
  const seg2 = { id: 's2', start: 0, end: 5 };
  const out2 = motifMod.contribute(seg2, instances, ctx);
  assert.strictEqual(out2, null);
  
  // Test segment after
  const seg3 = { id: 's3', start: 25, end: 30 };
  const out3 = motifMod.contribute(seg3, instances, ctx);
  assert.strictEqual(out3, null);
});
