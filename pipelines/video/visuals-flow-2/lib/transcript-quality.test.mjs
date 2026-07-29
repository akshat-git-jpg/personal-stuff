import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  checkTimingIntegrity,
  applyCleanup,
  alignScriptToWords,
  checkScriptAlignmentIntegrity,
} from './transcript-quality.mjs';

const TMP_ROOT = path.join(import.meta.dirname, '.test-tmp', 'transcript-quality');

test.before(() => {
  if (fs.existsSync(TMP_ROOT)) fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TMP_ROOT, { recursive: true });
});

function words(...specs) {
  return specs.map(([text, start, end]) => ({ text, start, end }));
}

test('checkTimingIntegrity: identical input has no errors', () => {
  const w = words(['Hi,', 0, 0.5], ['there.', 0.5, 1]);
  assert.deepEqual(checkTimingIntegrity(w, w), []);
});

test('checkTimingIntegrity: empty text is an error', () => {
  const before = words(['Hi,', 0, 0.5], ['there.', 0.5, 1]);
  const after = words(['Hi,', 0, 0.5], ['', 0.5, 1]);
  const errors = checkTimingIntegrity(before, after);
  assert.ok(errors.some(e => e.includes('empty text')), errors.join('\n'));
});

test('checkTimingIntegrity: backwards start names "timeline went backwards"', () => {
  const before = words(['Hi,', 0, 0.5], ['there.', 0.5, 1]);
  const after = words(['Hi,', 0.5, 0.9], ['there.', 0.2, 1]);
  const errors = checkTimingIntegrity(before, after);
  assert.ok(errors.some(e => e.includes('timeline went backwards')), errors.join('\n'));
});

test('checkTimingIntegrity: more words out than in is an error', () => {
  const before = words(['Hi,', 0, 0.5]);
  const after = words(['Hi,', 0, 0.3], ['there.', 0.3, 0.5]);
  const errors = checkTimingIntegrity(before, after);
  assert.ok(errors.some(e => e.includes('MORE words')), errors.join('\n'));
});

test('checkTimingIntegrity: a span outside the source is an error', () => {
  const before = words(['Hi,', 0, 0.5], ['there.', 0.5, 1]);
  const after = words(['Hi,', -1, 0.5], ['there.', 0.5, 1]);
  const errors = checkTimingIntegrity(before, after);
  assert.ok(errors.some(e => e.includes('outside the source')), errors.join('\n'));
});

test('applyCleanup: merges "Higgs"+"Field" and drops a leading "Now,"', () => {
  const before = words(
    ['Now,', 0, 0.4],
    ['Higgs', 0.4, 0.8],
    ['Field', 0.8, 1.3],
    ['is', 1.3, 1.5],
    ['great.', 1.5, 2.0],
  );
  const cleaned = words(
    ['Higgsfield', 0.4, 1.3],
    ['is', 1.3, 1.5],
    ['great.', 1.5, 2.0],
  );
  const result = applyCleanup(before, cleaned);
  assert.equal(result[0].text, 'Higgsfield');
  assert.equal(result[0].start, 0.4);
  assert.equal(result[0].end, 1.3);
  assert.deepEqual(checkTimingIntegrity(before, result), []);
});

test('applyCleanup: throws rather than write a desynced transcript', () => {
  const before = words(['Hi,', 0, 0.5], ['there.', 0.5, 1]);
  const broken = words(['Hi,', 0.5, 0.4], ['there.', 0.5, 1]);
  assert.throws(() => applyCleanup(before, broken), /timing integrity failed/);
});

test('alignScriptToWords: identical text produces identical timings', () => {
  const asr = words(['If', 0, 0.2], ['you', 0.2, 0.4], ['are', 0.4, 0.6], ['ready.', 0.6, 1.0]);
  const aligned = alignScriptToWords(['If', 'you', 'are', 'ready.'], asr);
  assert.equal(aligned.length, asr.length);
  for (let i = 0; i < asr.length; i++) {
    assert.equal(aligned[i].start, asr[i].start);
    assert.equal(aligned[i].end, asr[i].end);
  }
  assert.deepEqual(checkScriptAlignmentIntegrity(asr, aligned), []);
});

test('alignScriptToWords: a script with one extra word stays monotonic and in-span', () => {
  const asr = words(['If', 0, 0.2], ['you', 0.2, 0.4], ['are', 0.4, 0.6], ['ready.', 0.6, 1.0]);
  const scriptTokens = ['If', 'you', 'truly', 'are', 'ready.'];
  const aligned = alignScriptToWords(scriptTokens, asr);
  assert.equal(aligned.length, scriptTokens.length);
  for (let i = 1; i < aligned.length; i++) {
    assert.ok(aligned[i].start >= aligned[i - 1].start, `word ${i} went backwards`);
  }
  assert.ok(aligned[0].start >= asr[0].start - 0.01);
  assert.ok(aligned[aligned.length - 1].end <= asr[asr.length - 1].end + 0.01);
  assert.deepEqual(checkScriptAlignmentIntegrity(asr, aligned), []);
});

function setupWorkdir(slug, transcript, { scriptTxt } = {}) {
  const wd = path.join(TMP_ROOT, slug);
  fs.mkdirSync(wd, { recursive: true });
  fs.writeFileSync(path.join(wd, 'transcript.json'), JSON.stringify(transcript));
  if (scriptTxt !== undefined) fs.writeFileSync(path.join(wd, 'script.txt'), scriptTxt);
  return wd;
}

const CLI = path.join(import.meta.dirname, 'transcript-quality.mjs');

test('CLI align: writes the aligned transcript on success', () => {
  const asr = words(['If', 0, 0.2], ['you', 0.2, 0.4], ['are', 0.4, 0.6], ['ready.', 0.6, 1.0]);
  const wd = setupWorkdir('cli-align-ok', asr, { scriptTxt: 'If you are ready.' });
  const result = spawnSync('node', [CLI, 'align', wd], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const out = JSON.parse(fs.readFileSync(path.join(wd, 'transcript.json'), 'utf8'));
  assert.equal(out.length, 4);
  assert.equal(out[0].text, 'If');
});

test('CLI apply: fails loudly and leaves transcript.json untouched on a desynced cleanup', () => {
  const asr = words(['Hi,', 0, 0.5], ['there.', 0.5, 1]);
  const wd = setupWorkdir('cli-apply-bad', asr);
  const cleanedPath = path.join(wd, 'transcript.cleaned.json');
  fs.writeFileSync(cleanedPath, JSON.stringify(words(['Hi,', 0.5, 0.4], ['there.', 0.5, 1])));

  const result = spawnSync('node', [CLI, 'apply', wd, cleanedPath], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /timing integrity failed/);

  const stillRaw = JSON.parse(fs.readFileSync(path.join(wd, 'transcript.json'), 'utf8'));
  assert.deepEqual(stillRaw, asr);
});

// Regression for a real cleanup pass over test-03's committed raw transcript
// (plan 149): drop each sentence-opening discourse filler ("Now,"/"Okay,"),
// merge the one ASR brand-split ("Some"+"Magic" -> "Submagic"), and confirm
// the result still clears checkTimingIntegrity with fewer commas than the
// source. The filler indices and merge pair below were found by hand-reading
// the fixture; re-derive them if the fixture ever changes.
// Committed fixture, NOT a live video workdir. This test used to read
// videos/test-03/transcript.groq-raw.bak.json directly and broke the moment
// that video was cleaned up for a fresh run (2026-07-30) — a test must never
// depend on a workdir someone is expected to wipe.
const TEST_03_RAW = path.join(import.meta.dirname, 'fixtures', 'raw-transcript-groq.json');

test('real cleanup run over test-03 raw transcript: comma count drops, zero integrity errors', () => {
  const before = JSON.parse(fs.readFileSync(TEST_03_RAW, 'utf8'));

  const fillerIndices = new Set([33, 91, 119, 185, 242, 263, 273, 286, 326, 382, 494, 535, 621, 693]);
  const mergePair = [34, 35, 'Submagic']; // "Some" + "Magic" -> "Submagic"

  const cleaned = [];
  for (let i = 0; i < before.length; i++) {
    if (fillerIndices.has(i) || i === mergePair[1]) continue;
    if (i === mergePair[0]) {
      cleaned.push({ text: mergePair[2], start: before[i].start, end: before[mergePair[1]].end });
      continue;
    }
    cleaned.push({ ...before[i] });
  }

  const commaCount = (arr) => arr.filter(w => /,/.test(w.text)).length;
  const errors = checkTimingIntegrity(before, cleaned);

  assert.deepEqual(errors, []);
  assert.ok(commaCount(cleaned) < commaCount(before), `comma count did not drop: ${commaCount(before)} -> ${commaCount(cleaned)}`);
  assert.equal(cleaned.length, before.length - fillerIndices.size - 1);
});
