import test from 'node:test';
import assert from 'node:assert';
import { proposeSegments } from './segments.mjs';

test('segments: dense run of demo cues yields one demo run covering it', () => {
  const transcript = [];
  // word every 1s.
  for (let i = 0; i < 40; i++) {
    let text = "word";
    if (i % 10 === 0) text = "click";
    if (i % 10 === 1) text = "on";
    if (i % 10 === 5) text = "go";
    if (i % 10 === 6) text = "over";
    if (i % 10 === 7) text = "to";
    
    transcript.push({
      text,
      start: i,
      end: i + 0.9
    });
  }
  const runs = proposeSegments(transcript);
  
  // with "click on" hitting every 5 seconds, it should be highly dense.
  assert(runs.some(r => r.kind === 'demo'));
  
  // Contiguous, ordered, covering [0, lastWordEnd]
  assert.equal(runs[0].start, 0);
  assert.equal(runs[runs.length - 1].end, transcript[transcript.length - 1].end);
  for (let i = 1; i < runs.length; i++) {
    assert.equal(runs[i].start, runs[i - 1].end);
  }
});

test('segments: a run shorter than MIN_SEG is merged, not emitted', () => {
  const transcript = [];
  // 90 seconds total
  for (let i = 0; i < 90; i++) {
    let text = "word";
    // First hits around t=20 -> demo windows from t=0 to t=20. Run [0, 25] demo
    if (i === 20) text = "click";
    if (i === 21) text = "on";
    if (i === 22) text = "go";
    if (i === 23) text = "over";
    if (i === 24) text = "to";
    
    // Second hits around t=60 -> demo windows from t=35 to t=60. Run [35, 65] demo
    // The narration gap is [25, 35], which is 10s (< MIN_SEG 20s).
    // So the gap should be merged, resulting in one big demo run!
    if (i === 60) text = "click";
    if (i === 61) text = "on";
    if (i === 62) text = "go";
    if (i === 63) text = "over";
    if (i === 64) text = "to";
    
    transcript.push({ text, start: i, end: i + 0.9 });
  }
  
  const runs = proposeSegments(transcript);
  
  // We expect no narration gap, everything should be one demo run up to 65, then narration.
  // Actually, wait, the first window t=0 [0, 30] contains the hits at 20-24. So demo starts at 0!
  // So the runs should be [0, 65] demo, [65, 90] narration.
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    if (i > 0 && i < runs.length - 1) {
      assert(r.end - r.start >= 20, `Run too short: ${r.end - r.start}s`);
    }
  }
  // specifically check that there's no short narration run
  assert.equal(runs.length, 2);
  assert.equal(runs[0].kind, 'demo');
  assert.equal(runs[1].kind, 'narration');
});
