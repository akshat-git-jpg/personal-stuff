import { test } from 'node:test';
import assert from 'node:assert';
import { lintConcept, MIN_NARRATION_COVERAGE, narrationCoverage } from './lint-concept.mjs';

test('lintConcept', async (t) => {
  const words = [
    { start: 0, end: 1, text: 'hello' },
    { start: 1, end: 2, text: 'world' },
    { start: 2, end: 3, text: 'this' },
    { start: 3, end: 4, text: 'is' },
    { start: 4, end: 5, text: 'a' },
    { start: 5, end: 6, text: 'test' },
    { start: 6, end: 7, text: 'of' },
    { start: 7, end: 8, text: 'the' },
    { start: 8, end: 9, text: 'concept' },
    { start: 9, end: 10, text: 'linter' },
  ];

  const validConcept = {
    video: 'test-slug',
    thesis: 'This is a valid thesis with at least six words.',
    frame: 'Like a test suite for ideas.',
    throughline: {
      name: 'the-tester',
      description: 'a small testing icon',
      evolution: 'gets greener over time'
    },
    registers: [
      { from_anchor: 'hello world this', to_anchor: 'is a test', register: 'dark' },
      { from_anchor: 'of the concept', to_anchor: 'the concept linter', register: 'light' }
    ]
  };

  await t.test('clean pass', () => {
    const errs = lintConcept(validConcept, words);
    assert.deepStrictEqual(errs, []);
  });

  await t.test('missing throughline', () => {
    const c = { ...validConcept };
    delete c.throughline;
    const errs = lintConcept(c, words);
    assert.ok(errs.some(e => e.includes('missing required field: throughline')));
  });

  await t.test('bad register', () => {
    const c = { ...validConcept, registers: [{ from_anchor: 'hello world this', to_anchor: 'is a test', register: 'blue' }] };
    const errs = lintConcept(c, words);
    assert.ok(errs.some(e => e.includes('must be dark or light')));
  });

  await t.test('overlapping spans', () => {
    const c = {
      ...validConcept, registers: [
        { from_anchor: 'hello world this', to_anchor: 'a test of', register: 'dark' },
        { from_anchor: 'this is a', to_anchor: 'the concept linter', register: 'light' }
      ]
    };
    const errs = lintConcept(c, words);
    // Overlapping causes the second span's from_anchor search (which starts AFTER 'a test of') to fail
    assert.ok(errs.some(e => e.includes('anchor not found')));
  });

  await t.test('unresolvable anchor', () => {
    const c = { ...validConcept, registers: [{ from_anchor: 'not in transcript', to_anchor: 'is a test', register: 'dark' }] };
    const errs = lintConcept(c, words);
    assert.ok(errs.some(e => e.includes('anchor not found') || e.includes('fewer than 3 words')));
  });

  await t.test('stated count missing items errors', () => {
    const c = { 
      ...validConcept, 
      throughline: { ...validConcept.throughline, description: 'A five-slot candidate roster' }
    };
    const errs = lintConcept(c, words);
    assert.ok(errs.some(e => e.includes('missing required field: throughline.items')));
  });

  await t.test('stated count disagreeing with items.length errors', () => {
    const c = { 
      ...validConcept, 
      throughline: { ...validConcept.throughline, description: 'A five-slot candidate roster', items: ['A', 'B'] }
    };
    const errs = lintConcept(c, words);
    assert.ok(errs.some(e => e.includes('length must be 5')));
  });

  await t.test('stated count agreeing with items.length passes', () => {
    const c = { 
      ...validConcept, 
      throughline: { ...validConcept.throughline, description: 'A five-slot candidate roster', items: ['A', 'B', 'C', 'D', 'E'] }
    };
    const errs = lintConcept(c, words);
    assert.ok(!errs.some(e => e.includes('throughline.items')));
  });
});

// Narration coverage (owner rule 2026-07-30): the dark/light map is what tells
// each card whether to render heavy or bright, and where the video changes gear
// (register flips drive the whip-reg transitions). A cue in an UNCOVERED stretch
// inherits no register, so its card silently falls back to its own default and
// nothing checks it — the exact class of bug found on 2026-07-24, when every
// card rendered its default because register never reached VARS. The 80% floor
// was prose in the step-020 prompt and enforced by nobody until now.
test('narration coverage gate', async (t) => {
  // 20 words, one per second: word i spans [i, i+1].
  const words = Array.from({ length: 20 }, (_, i) => ({ start: i, end: i + 1, text: `w${i}` }));

  // Narration is the first 10s; the rest is demo and must NOT count toward the
  // denominator — during a demo only overlay pills are legal and a pill carries
  // no full-frame mood, so requiring a register there would be meaningless.
  const segments = [
    { kind: 'narration', start: 0, end: 10 },
    { kind: 'demo', start: 10, end: 20 },
  ];

  const base = {
    video: 'test-slug',
    thesis: 'This is a valid thesis with at least six words.',
    frame: 'Like a test suite for ideas.',
    throughline: { name: 'the-tester', description: 'a small testing icon', evolution: 'gets greener over time' },
  };

  // spansFromRegisters ends a span at the to_anchor's FIRST word + 1.0s, matching
  // concept-spans.mjs so the gate measures the same spans the effects render.
  const covers8s = [{ from_anchor: 'w0 w1 w2', to_anchor: 'w7 w8 w9', register: 'dark' }];  // [0, 8]
  const covers6s = [{ from_anchor: 'w0 w1 w2', to_anchor: 'w5 w6 w7', register: 'dark' }];  // [0, 6]

  await t.test('exactly at the floor passes', () => {
    const errs = lintConcept({ ...base, registers: covers8s }, words, segments);
    assert.deepStrictEqual(errs, [], '8s of 10s narration is 80% and must pass');
  });

  await t.test('below the floor is an error', () => {
    const errs = lintConcept({ ...base, registers: covers6s }, words, segments);
    assert.ok(
      errs.some(e => e.includes('narration coverage')),
      `expected a narration-coverage error, got: ${JSON.stringify(errs)}`,
    );
  });

  await t.test('the error names both the actual and the required figure', () => {
    const errs = lintConcept({ ...base, registers: covers6s }, words, segments);
    const err = errs.find(e => e.includes('narration coverage'));
    assert.ok(/60(\.0)?%/.test(err), `error should state the actual 60%: ${err}`);
    assert.ok(/80%/.test(err), `error should state the required 80%: ${err}`);
  });

  await t.test('demo time is excluded from the denominator', () => {
    // Same spans, but now the whole 20s is narration: 8s of 20s is 40% and fails.
    const allNarration = [{ kind: 'narration', start: 0, end: 20 }];
    const errs = lintConcept({ ...base, registers: covers8s }, words, allNarration);
    assert.ok(
      errs.some(e => e.includes('narration coverage')),
      'widening narration must lower coverage, proving the denominator is narration-only',
    );
  });

  await t.test('skipped when segments are not supplied', () => {
    // Keeps the 2-arg call sites and older workdirs working; the CLI supplies
    // segments itself, so the gate is still firm where it counts.
    const errs = lintConcept({ ...base, registers: covers6s }, words);
    assert.deepStrictEqual(errs, [], 'no segments means no coverage claim to check');
  });

  await t.test('skipped when there is no narration at all', () => {
    const noNarration = [{ kind: 'demo', start: 0, end: 20 }];
    const errs = lintConcept({ ...base, registers: covers6s }, words, noNarration);
    assert.deepStrictEqual(errs, [], 'a zero denominator is not a failure');
  });

  await t.test('narrationCoverage reports the ratio it gated on', () => {
    const cov = narrationCoverage({ ...base, registers: covers6s }, words, segments);
    assert.strictEqual(cov.total, 10);
    assert.strictEqual(cov.covered, 6);
    assert.ok(Math.abs(cov.ratio - 0.6) < 1e-9);
  });

  await t.test('coverage clips spans that overrun narration', () => {
    // Span [0,8] against narration 0-4 plus 12-16: only the 0-4 part counts.
    const split = [
      { kind: 'narration', start: 0, end: 4 },
      { kind: 'demo', start: 4, end: 12 },
      { kind: 'narration', start: 12, end: 16 },
    ];
    const cov = narrationCoverage({ ...base, registers: covers8s }, words, split);
    assert.strictEqual(cov.total, 8);
    assert.strictEqual(cov.covered, 4, 'the 4s-8s part of the span lies in demo and must not count');
  });

  await t.test('the floor is 0.8', () => {
    assert.strictEqual(MIN_NARRATION_COVERAGE, 0.8);
  });
});
