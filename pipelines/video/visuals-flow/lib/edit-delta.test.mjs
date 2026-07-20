import test from 'node:test';
import assert from 'node:assert/strict';
import { editDelta, formatDelta, shotsDelta, formatShotsDelta } from './edit-delta.mjs';

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

test('shotsDelta detects edited/added/removed spans', () => {
  const llm = {
    spans: [
      { id: 's01', kind: 'avatar-full', from_anchor: 'a', to_anchor: 'b', note: 'n', flagged: false },
      { id: 's02', kind: 'avatar-full', from_anchor: 'c', to_anchor: 'd', flagged: false }
    ]
  };
  const app = {
    spans: [
      { id: 's01', kind: 'avatar-full', from_anchor: 'a', to_anchor: 'bb', note: 'n', flagged: false },
      { id: 's03', kind: 'avatar-full', from_anchor: 'e', to_anchor: 'f', flagged: false }
    ]
  };
  const delta = shotsDelta(llm, app);
  
  assert.equal(delta.totals.edited, 1);
  assert.equal(delta.totals.added, 1);
  assert.equal(delta.totals.removed, 1);
  
  const s01 = delta.edited.find(e => e.id === 's01');
  assert.ok(s01);
  assert.ok(s01.changes.find(c => c.field === 'to_anchor' && c.from === 'b' && c.to === 'bb'));
});

test('formatShotsDelta prints the totals line', () => {
  const summary = {
    added: [{id: 's03'}],
    removed: [{id: 's02'}],
    edited: [{id: 's01', changes: [{field: 'to_anchor', from: 'b', to: 'bb'}]}],
    totals: { llmSpans: 2, approvedSpans: 2, edited: 1, added: 1, removed: 1 }
  };
  const formatted = formatShotsDelta(summary);
  assert.match(formatted, /1 edited, 1 added, 1 removed/);
});
