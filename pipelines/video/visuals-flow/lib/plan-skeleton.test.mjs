import test from 'node:test';
import assert from 'node:assert';
import { buildSlots, buildBudget } from './plan-skeleton.mjs';
import { CUE_CONSTANTS } from './cue-constants.mjs';

test('W1 holds by construction', () => {
  for (let total = 120; total <= 3600; total += 60) {
    const segments = [{ kind: 'narration', start: 0, end: total }];
    const slots = buildSlots(segments, total, CUE_CONSTANTS);
    for (let i = 1; i < slots.length; i++) {
      const gap = slots[i].at - slots[i-1].at;
      assert.ok(gap >= CUE_CONSTANTS.GAP_FULLFRAME_MIN.value);
      assert.ok(gap <= CUE_CONSTANTS.GAP_FULLFRAME_MAX.value);
    }
  }
});

test('End zone respected', () => {
  const total = 600;
  const segments = [{ kind: 'narration', start: 0, end: total }];
  const slots = buildSlots(segments, total, CUE_CONSTANTS);
  const endZoneTime = total - CUE_CONSTANTS.ZONE_END.value;
  for (const s of slots) {
    assert.ok(s.at <= endZoneTime);
  }
});

test('Demo skipped', () => {
  const total = 900;
  const segments = [
    { kind: 'narration', start: 0, end: 300 },
    { kind: 'demo', start: 300, end: 600 },
    { kind: 'narration', start: 600, end: 900 }
  ];
  const slots = buildSlots(segments, total, CUE_CONSTANTS);
  
  // No slot falls inside demo
  for (const s of slots) {
    assert.ok(s.at <= 300 || s.at >= 600);
  }

  // W1 bounds over narration time
  for (let i = 1; i < slots.length; i++) {
    const prev = slots[i-1];
    const curr = slots[i];
    let gap = curr.at - prev.at;
    if (prev.at <= 300 && curr.at >= 600) {
      // Gap in narration time subtracts the demo length
      gap -= 300;
    }
    // Using small epsilon for floating point comparison if necessary
    assert.ok(gap >= CUE_CONSTANTS.GAP_FULLFRAME_MIN.value - 0.1);
    assert.ok(gap <= CUE_CONSTANTS.GAP_FULLFRAME_MAX.value + 0.1);
  }
});

test('Count plausible', () => {
  const total = 600;
  const segments = [{ kind: 'narration', start: 0, end: total }];
  const slots = buildSlots(segments, total, CUE_CONSTANTS);
  const budget = buildBudget(total, CUE_CONSTANTS);
  assert.ok(slots.length <= budget.maxCues);
});

test('Degenerate input', () => {
  const shortTotal = 60;
  const shortSegments = [{ kind: 'narration', start: 0, end: shortTotal }];
  assert.deepEqual(buildSlots(shortSegments, shortTotal, CUE_CONSTANTS), []);
  
  const demoTotal = 600;
  const demoSegments = [{ kind: 'demo', start: 0, end: demoTotal }];
  assert.deepEqual(buildSlots(demoSegments, demoTotal, CUE_CONSTANTS), []);
});
