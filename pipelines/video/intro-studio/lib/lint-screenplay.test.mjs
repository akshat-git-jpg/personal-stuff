import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { lintScreenplay } from './lint-screenplay.mjs';

const goodScreenplay = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/screenplay-good.json'), 'utf8'));
const goodTranscript = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/transcript-good.json'), 'utf8'));

// E6 mutation requires a duration matching the end beat if we don't want E7 to fire. 
// However, the test only checks presence/absence of specific codes.
const introDuration = 8.4;

function runLint(sp, dur = introDuration) {
  return lintScreenplay({ screenplay: sp, words: goodTranscript, introDuration: dur });
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

test('good fixture is clean', () => {
  const res = runLint(goodScreenplay);
  assert.deepStrictEqual(res.errors, []);
  assert.deepStrictEqual(res.warnings, []);
});

test('E1: word not in transcript', () => {
  const sp = clone(goodScreenplay);
  sp.beats[1].clause = "I tested all six across the same brief";
  const res = runLint(sp);
  assert.ok(res.errors.some(e => e.code === 'E1'), 'Expected E1 on mutated');
  assert.ok(!runLint(goodScreenplay).errors.some(e => e.code === 'E1'), 'Expected no E1 on good');
});

test('E2: word time mismatch', () => {
  const sp = clone(goodScreenplay);
  sp.beats[1].t_start = 1.0;
  sp.beats[0].t_end = 1.0;
  const res = runLint(sp);
  assert.ok(res.errors.some(e => e.code === 'E2'), 'Expected E2 on mutated');
  assert.ok(!runLint(goodScreenplay).errors.some(e => e.code === 'E2'), 'Expected no E2 on good');
});

test('E3: gap in beats', () => {
  const sp = clone(goodScreenplay);
  sp.beats[1].t_start = 3.4;
  const res = runLint(sp);
  assert.ok(res.errors.some(e => e.code === 'E3'), 'Expected E3 on mutated');
  assert.ok(!runLint(goodScreenplay).errors.some(e => e.code === 'E3'), 'Expected no E3 on good');
});

test('E4: forward reference in carries', () => {
  const sp = clone(goodScreenplay);
  sp.beats[1].carries.from = "b03";
  const res = runLint(sp);
  assert.ok(res.errors.some(e => e.code === 'E4'), 'Expected E4 on mutated');
  assert.ok(!runLint(goodScreenplay).errors.some(e => e.code === 'E4'), 'Expected no E4 on good');
});

test('E5: enum violation', () => {
  const sp = clone(goodScreenplay);
  sp.beats[0].register = "moody";
  const res = runLint(sp);
  assert.ok(res.errors.some(e => e.code === 'E5'), 'Expected E5 on mutated');
  assert.ok(!runLint(goodScreenplay).errors.some(e => e.code === 'E5'), 'Expected no E5 on good');
});

test('E6: missing deviation reason', () => {
  const sp = clone(goodScreenplay);
  const b01 = sp.beats[0];
  const b02 = sp.beats[1];
  const b03 = sp.beats[2];
  
  sp.beats = [b02, b01, b03];
  
  sp.beats[0].t_start = 0.0;
  sp.beats[0].t_end = 2.8;
  sp.beats[1].t_start = 2.8;
  sp.beats[1].t_end = 5.6;
  sp.beats[2].t_start = 5.6;
  sp.beats[2].t_end = 8.4;

  const res = runLint(sp);
  assert.ok(res.errors.some(e => e.code === 'E6'), 'Expected E6 on mutated');
  assert.ok(!runLint(goodScreenplay).errors.some(e => e.code === 'E6'), 'Expected no E6 on good');
});

test('E6: deviation with reason is allowed', () => {
  const sp = clone(goodScreenplay);
  const b01 = sp.beats[0];
  const b02 = sp.beats[1];
  const b03 = sp.beats[2];
  
  sp.beats = [b02, b01, b03];
  sp.beats[0].t_start = 0.0;
  sp.beats[0].t_end = 2.8;
  sp.beats[1].t_start = 2.8;
  sp.beats[1].t_end = 5.6;
  sp.beats[2].t_start = 5.6;
  sp.beats[2].t_end = 8.4;
  
  sp.beats[0].deviation_reason = "started with the turn";
  sp.beats[1].deviation_reason = "late hook";
  sp.beats[2].deviation_reason = "stakes stay same";

  const res = runLint(sp);
  assert.ok(!res.errors.some(e => e.code === 'E6'), 'Expected no E6 if reasons provided');
});

test('E7: short intro duration match', () => {
  const sp = clone(goodScreenplay);
  sp.beats[2].t_end = 7.0;
  const res = runLint(sp);
  assert.ok(res.errors.some(e => e.code === 'E7'), 'Expected E7 on mutated');
  assert.ok(!runLint(goodScreenplay).errors.some(e => e.code === 'E7'), 'Expected no E7 on good');
});

test('W1: lack of carries', () => {
  const sp = clone(goodScreenplay);
  sp.beats[1].carries = null;
  sp.beats[2].carries = null;
  const res = runLint(sp);
  assert.ok(res.warnings.some(w => w.code === 'W1'), 'Expected W1 on mutated');
  assert.ok(!runLint(goodScreenplay).warnings.some(w => w.code === 'W1'), 'Expected no W1 on good');
});

test('W2: no register change', () => {
  const sp = clone(goodScreenplay);
  sp.beats.forEach(b => b.register = "dark");
  const res = runLint(sp);
  assert.ok(res.warnings.some(w => w.code === 'W2'), 'Expected W2 on mutated');
  assert.ok(!runLint(goodScreenplay).warnings.some(w => w.code === 'W2'), 'Expected no W2 on good');
});

test('W3: no face early', () => {
  const sp = clone(goodScreenplay);
  sp.beats[0].face = "none";
  sp.beats[1].face = "none";
  const res = runLint(sp);
  assert.ok(res.warnings.some(w => w.code === 'W3'), 'Expected W3 on mutated');
  assert.ok(!runLint(goodScreenplay).warnings.some(w => w.code === 'W3'), 'Expected no W3 on good');
});

test('W4: beat too long', () => {
  const sp = clone(goodScreenplay);
  sp.beats[2].t_end = 21.0;
  const res = runLint(sp, 21.0);
  assert.ok(res.warnings.some(w => w.code === 'W4'), 'Expected W4 on mutated');
  assert.ok(!runLint(goodScreenplay).warnings.some(w => w.code === 'W4'), 'Expected no W4 on good');
});

// --- regressions found authoring the first real screenplay (poc-01) ---

// A transcript token can normalise into several words. Matching token-to-word
// made every clause containing "side-by-side", "five-way" or "let's" unmatchable.
test('E1 matches clauses containing multi-word tokens', () => {
  const words = [
    { text: 'a', start: 0.0, end: 0.2 },
    { text: 'side-by-side', start: 0.2, end: 0.9 },
    { text: "let's", start: 0.9, end: 1.4 },
    { text: 'go', start: 1.4, end: 1.8 },
  ];
  const sp = {
    slug: 'x',
    beats: [{
      id: 'b01', intent: 'hook', clause: "a side-by-side let's go",
      t_start: 0, t_end: 1.8, register: 'dark', face: 'full',
      stage: 's', carries: null, transition_out: 'cut', deviation_reason: null,
    }],
  };
  const res = lintScreenplay({ screenplay: sp, words, introDuration: 1.8 });
  assert.ok(!res.errors.some(e => e.code === 'E1'), JSON.stringify(res.errors));
  assert.ok(!res.errors.some(e => e.code === 'E2'), JSON.stringify(res.errors));
});

// E3 pins the first beat to 0; the first word almost never starts at 0. Both
// rules must be satisfiable at once, exactly as they are for the last beat.
test('E2 does not fire on a first beat pinned to 0 by E3', () => {
  const words = [
    { text: 'hello', start: 0.43, end: 0.9 },
    { text: 'there', start: 0.9, end: 1.5 },
  ];
  const sp = {
    slug: 'x',
    beats: [{
      id: 'b01', intent: 'hook', clause: 'hello there',
      t_start: 0, t_end: 1.5, register: 'dark', face: 'full',
      stage: 's', carries: null, transition_out: 'cut', deviation_reason: null,
    }],
  };
  const res = lintScreenplay({ screenplay: sp, words, introDuration: 1.5 });
  assert.deepStrictEqual(res.errors, []);
});

// ...but a first beat that is NOT pinned to 0 still gets checked against the words.
test('E2 still fires on a first beat that is neither 0 nor the word time', () => {
  const words = [
    { text: 'hello', start: 0.43, end: 0.9 },
    { text: 'there', start: 0.9, end: 1.5 },
  ];
  const sp = {
    slug: 'x',
    beats: [{
      id: 'b01', intent: 'hook', clause: 'hello there',
      t_start: 3.0, t_end: 1.5, register: 'dark', face: 'full',
      stage: 's', carries: null, transition_out: 'cut', deviation_reason: null,
    }],
  };
  const res = lintScreenplay({ screenplay: sp, words, introDuration: 1.5 });
  assert.ok(res.errors.some(e => e.code === 'E2'));
});
