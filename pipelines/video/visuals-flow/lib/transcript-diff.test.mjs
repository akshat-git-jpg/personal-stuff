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

test('a length mismatch throws rather than guessing', () => {
  assert.throws(() => transcriptDiff(raw, clean.slice(0, 2)), /TRANSCRIPT-DIFF-INVISIBLE/);
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
