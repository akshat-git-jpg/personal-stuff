import test from 'node:test';
import assert from 'node:assert/strict';
import { editDelta, formatDelta } from './edit-delta.mjs';

test('editDelta: identical files yield zero totals', () => {
  const llm = {
    cues: [
      { id: 'c01', card: 'a', anchor: 'hello', beats: [{ anchor: 'b', reveal: { text: 't1' } }] }
    ]
  };
  const app = {
    cues: [
      { id: 'c01', card: 'a', anchor: 'hello', beats: [{ anchor: 'b', reveal: { text: 't1' } }] }
    ]
  };
  const delta = editDelta(llm, app);
  assert.equal(delta.edited.length, 0);
  assert.equal(delta.added.length, 0);
  assert.equal(delta.removed.length, 0);
  assert.equal(delta.totals.edited, 0);
  assert.equal(delta.totals.revealTextsChanged, 0);
});

test('editDelta: detects changes correctly', () => {
  const llm = {
    cues: [
      { id: 'c01', card: 'a', anchor: 'hello', hold: 1, beats: [{ anchor: 'b', reveal: { text: 't1' } }] },
      { id: 'c02', card: 'b', anchor: 'world' }
    ]
  };
  const app = {
    cues: [
      { id: 'c01', card: 'a', anchor: 'hello', hold: 2, beats: [{ anchor: 'b', reveal: { text: 't2' } }] },
      { id: 'c03', card: 'c', anchor: 'new' }
    ]
  };
  const delta = editDelta(llm, app);
  
  assert.equal(delta.totals.edited, 1);
  assert.equal(delta.totals.added, 1);
  assert.equal(delta.totals.removed, 1);
  assert.equal(delta.totals.revealTextsChanged, 1);

  assert.equal(delta.added[0].id, 'c03');
  assert.equal(delta.removed[0].id, 'c02');
  
  const c01 = delta.edited.find(e => e.id === 'c01');
  assert.ok(c01);
  assert.ok(c01.changes.find(c => c.field === 'hold' && c.from === 1 && c.to === 2));
  assert.ok(c01.changes.find(c => c.field === 'beats[0].reveal.text' && c.from === 't1' && c.to === 't2'));
  
  const formatted = formatDelta(delta);
  assert.match(formatted, /2 cues from LLM, 2 approved, 1 edited, 1 added, 1 removed, 1 reveal texts changed/);
});
