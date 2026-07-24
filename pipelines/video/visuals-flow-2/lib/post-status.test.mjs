import test from 'node:test';
import assert from 'node:assert';
import { mergeStatus } from './post-status.mjs';

test('post-status merge semantics', () => {
  const prev = {
    updated: '2026-01-01T00:00:00.000Z',
    items: {
      'final-v1:0': { status: 'fixed', message: 'done' }
    }
  };

  const updates = {
    'final-v1:1': { status: 'question', message: 'what?' },
    'final-v1:0': { status: 'skipped', message: 'nevermind' }
  };

  const next = mergeStatus(prev, updates);

  assert.ok(next.updated > prev.updated, 'updated timestamp bumps');
  assert.strictEqual(next.items['final-v1:0'].status, 'skipped');
  assert.strictEqual(next.items['final-v1:1'].status, 'question');
  
  assert.throws(() => {
    mergeStatus(prev, { 'final-v1:2': { status: 'invalid' } });
  }, /Invalid status: invalid/);
});
