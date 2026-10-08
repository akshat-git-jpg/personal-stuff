import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFinalItem, deleteItem, pendingItems } from './feedback.mjs';

test('final-cut items use the shared key scheme and item shape', () => {
  let { fb, key } = appendFinalItem({}, 'v1', { text: '  too busy ', t: 41.333, moment: 'm03', today: '2026-10-08' });
  assert.equal(key, 'final-v1:0');
  assert.deepEqual(fb.items[key], { text: 'too busy', t: 41.33, context: 'final@00:41.3', added: '2026-10-08', moment: 'm03' });
  ({ fb, key } = appendFinalItem(fb, 'v1', { text: 'again', t: 0, today: '2026-10-08' }));
  assert.equal(key, 'final-v1:1');
  assert.equal(appendFinalItem(fb, 'v2', { text: 'x', t: 1 }).key, 'final-v2:0');
});

test('bad input is refused', () => {
  assert.throws(() => appendFinalItem({}, 'latest', { text: 'x', t: 1 }), /version label/);
  assert.throws(() => appendFinalItem({}, 'v1', { text: ' ', t: 1 }), /empty comment/);
  assert.throws(() => appendFinalItem({}, 'v1', { text: 'x', t: -1 }), /t must be/);
});

test('folded items cannot be deleted; pending skips applied, folded and deferred', () => {
  const fb = { items: { a: { text: 'a' }, b: { text: 'b', applied: 'x' }, c: { text: 'c', folded: 'x' }, d: { text: 'd', deferred: true } } };
  assert.deepEqual(pendingItems(fb).map((i) => i.key), ['a']);
  assert.throws(() => deleteItem(fb, 'c'), /read-only/);
  assert.deepEqual(Object.keys(deleteItem(fb, 'a').items), ['b', 'c', 'd']);
});
