import { test } from 'node:test';
import assert from 'node:assert';
import { lintConcept } from './lint-concept.mjs';

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
});
