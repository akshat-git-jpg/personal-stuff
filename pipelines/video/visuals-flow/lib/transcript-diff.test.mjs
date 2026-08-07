import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { transcriptDiff, writeTranscriptDiff } from './transcript-diff.mjs';

const raw =   [{ text: 'Open',  start: 0 }, { text: 'Art', start: 1 }, { text: 'is', start: 2 }];
const clean = [{ text: 'OpenArt', start: 0 }, { text: 'Art', start: 1 }, { text: 'is', start: 2 }];

test('a changed word appears in the diff', () => {
  const d = transcriptDiff(raw, clean);
  assert.equal(d.total, 1,
    'TRANSCRIPT-DIFF-INVISIBLE: a cleanup that changed a word must show exactly one change');
  assert.deepEqual(d.changes[0], { i: 0, start: 0, before: 'Open', after: 'OpenArt' },
    'TRANSCRIPT-DIFF-INVISIBLE: the change must carry index, time, before and after');
});

test('an unchanged transcript diffs to nothing', () => {
  assert.equal(transcriptDiff(raw, raw).total, 0);
});

// The original fixture spelled a merge as a same-length substitution
// ("Open"+"Art" -> "OpenArt" while still returning 3 words), which no real
// cleanup produces — a merge SHRINKS the list. That is why the gate stayed
// green while the step could not run on its first real video. A merge must
// diff, not throw.
test('a merged pair diffs against both raw words it consumed', () => {
  const rawM   = [{ text: 'open', start: 10.0, end: 10.2 }, { text: 'art', start: 10.3, end: 10.5 }, { text: 'is', start: 10.8, end: 11.0 }];
  const cleanM = [{ text: 'OpenArt', start: 10.0, end: 10.5 }, { text: 'is', start: 10.8, end: 11.0 }];
  const d = transcriptDiff(rawM, cleanM);
  assert.equal(d.total, 1,
    'TRANSCRIPT-DIFF-INVISIBLE: a merge must appear as one change, not throw the whole diff away');
  assert.deepEqual(d.changes[0], { i: 0, start: 10.0, before: 'open art', after: 'OpenArt', merged: 2 },
    'TRANSCRIPT-DIFF-INVISIBLE: a merge must show BOTH raw words it consumed, or the reviewer cannot see what was folded');
  assert.equal(d.changes.some(c => c.after === 'is'), false);
});

test('a dropped word is attributed to the clean word that absorbed its time', () => {
  const d = transcriptDiff(raw, clean.slice(0, 2));
  assert.equal(d.total, 2);
  assert.deepEqual(d.changes[1], { i: 1, start: 1, before: 'Art is', after: 'Art', merged: 2 },
    'TRANSCRIPT-DIFF-INVISIBLE: a dropped word must still be visible as text that left');
});

test('an invented word throws rather than guessing', () => {
  const grown = [...clean, { text: 'extra', start: 3 }];
  assert.throws(() => transcriptDiff(raw, grown), /TRANSCRIPT-DIFF-INVISIBLE/,
    'a cleanup may merge or drop but never invent — growth means the diff cannot be trusted');
});

test('suspects ride on the same artifact as the changes', () => {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-tdiff-'));
  writeTranscriptDiff(w, { rawWords: raw, cleanWords: clean, suspects: [{ i: 2, text: 'is', why: 'low confidence' }] });
  const r = JSON.parse(fs.readFileSync(path.join(w, 'transcript.diff.json'), 'utf8'));
  assert.equal(r.total, 1);
  assert.equal(r.suspects.length, 1,
    'TRANSCRIPT-DIFF-INVISIBLE: words the cleanup did NOT change but a second pass doubts must survive onto the artifact — a diff alone cannot show them');
  fs.rmSync(w, { recursive: true, force: true });
});
