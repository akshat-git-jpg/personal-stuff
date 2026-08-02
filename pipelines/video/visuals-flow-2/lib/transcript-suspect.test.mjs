import test from 'node:test';
import assert from 'node:assert/strict';
import { findSuspects, isAcknowledged } from './transcript-suspect.mjs';

test('findSuspects', () => {
  const WORDS = [
    { text: 'comparing', start: 8.0, end: 8.4 }, { text: 'them', start: 8.4, end: 8.6 },
    { text: 'is', start: 8.6, end: 8.8 }, { text: 'not', start: 8.8, end: 9.6 },
    { text: 'straight', start: 9.755, end: 10.1 }, { text: 'forward', start: 10.1, end: 10.5 },
    { text: 'like', start: 1519.0, end: 1519.4 }, { text: 'SCORM', start: 1519.72, end: 1520.2 },
    { text: 'export', start: 1520.2, end: 1520.6 }, { text: 'and', start: 1520.6, end: 1520.7 },
    { text: 'one', start: 1520.72, end: 1520.9 }, { text: 'clip', start: 1520.9, end: 1521.3 },
    { text: 'translation', start: 1521.3, end: 1521.9 },
    { text: 'videos,', start: 1554.0, end: 1554.4 }, { text: '10', start: 1554.49, end: 1554.7 },
    { text: 'ATP', start: 1554.88, end: 1555.2 }, { text: 'exports,', start: 1555.2, end: 1555.8 },
    { text: 'with', start: 1673.89, end: 1674.4 }, { text: 'Harrison', start: 1675.17, end: 1675.4 },
    { text: 'covers', start: 1675.4, end: 1675.8 },
  ];

  const lexicon = {
    terms: ['SCORM'],
    confusables: {
      'straight forward': 'straightforward',
      'one clip': 'one-click'
    }
  };

  const suspects = findSuspects(WORDS, lexicon);

  const straightForward = suspects.find(s => s.at === 9.755);
  assert.equal(straightForward?.kind, 'confusable');
  assert.equal(straightForward?.suggestion, 'straightforward');

  const oneClip = suspects.find(s => s.at === 1520.72);
  assert.equal(oneClip?.kind, 'confusable');
  assert.equal(oneClip?.suggestion, 'one-click');

  const tenAtp = suspects.find(s => s.at === 1554.49);
  assert.equal(tenAtp?.kind, 'digit-letter');

  const harrison = suspects.find(s => s.at === 1675.17);
  assert.equal(harrison?.kind, 'once-only-proper-noun');

  const scorm = suspects.find(s => s.text === 'SCORM');
  assert.equal(scorm, undefined);

  // A reviewed entry with an empty why does not clear a suspect, and one with a real why does
  assert.equal(isAcknowledged(harrison, []), false);
  assert.equal(isAcknowledged(harrison, [{ at: 1675.17, why: '' }]), false);
  assert.equal(isAcknowledged(harrison, [{ at: 1675.17, why: ' ' }]), false);
  assert.equal(isAcknowledged(harrison, [{ at: 1675.17, why: 'valid name' }]), true);
});
