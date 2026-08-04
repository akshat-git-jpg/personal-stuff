import test from 'node:test';
import assert from 'node:assert';
import { followsDefaultArc, normaliseClause } from './screenplay-schema.mjs';

test('followsDefaultArc', () => {
  // in-order subset -> true
  assert.strictEqual(followsDefaultArc(['hook', 'turn', 'stakes']), true);
  // reordered -> false
  assert.strictEqual(followsDefaultArc(['turn', 'hook']), false);
  // repeated intent -> false
  assert.strictEqual(followsDefaultArc(['hook', 'hook']), false);
  // empty -> true
  assert.strictEqual(followsDefaultArc([]), true);
});

test('normaliseClause', () => {
  // punctuation stripped, case folded, whitespace collapsed
  assert.strictEqual(normaliseClause('Hello, World!  This is a TEST.'), 'hello world this is a test');
});
