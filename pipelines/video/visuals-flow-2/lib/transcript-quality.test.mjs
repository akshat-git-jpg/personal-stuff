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
