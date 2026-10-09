import test from 'node:test';
import assert from 'node:assert';
import { checkSection, buildReport } from './intake-qc.mjs';

test('checkSection passes valid clip', () => {
  const result = checkSection({
    id: 's01', demo: true, audioDur: 10,
    clip: { path: 's01.mp4', videoDur: 12, height: 1080 }
  });
  assert.strictEqual(result.verdict, 'pass');
  assert.deepStrictEqual(result.issues, []);
});

test('checkSection fails on missing clip', () => {
  const result = checkSection({ id: 's01', demo: true, audioDur: 10, clip: null });
  assert.strictEqual(result.verdict, 'fail');
  assert.ok(result.issues.some(i => i.includes('missing')));
});

test('checkSection fails on duplicate extensions', () => {
  const result = checkSection({ id: 's01', demo: true, audioDur: 10, clip: 'duplicate' });
  assert.strictEqual(result.verdict, 'fail');
  assert.ok(result.issues.some(i => i.includes('duplicate')));
});

test('checkSection fails if too short', () => {
  const result = checkSection({
    id: 's01', demo: true, audioDur: 10,
    clip: { path: 's01.mp4', videoDur: 9, height: 1080 }
  });
  assert.strictEqual(result.verdict, 'fail');
  assert.ok(result.issues.some(i => i.includes('< audio duration')));
});

test('checkSection fails if too long', () => {
  const result = checkSection({
    id: 's01', demo: true, audioDur: 10,
    clip: { path: 's01.mp4', videoDur: 31, height: 1080 }
  });
  assert.strictEqual(result.verdict, 'fail');
  assert.ok(result.issues.some(i => i.includes('> audio duration + 20s')));
});

test('checkSection fails on 720p', () => {
  const result = checkSection({
    id: 's01', demo: true, audioDur: 10,
    clip: { path: 's01.mp4', videoDur: 12, height: 720 }
  });
  assert.strictEqual(result.verdict, 'fail');
  assert.ok(result.issues.some(i => i.includes('video height (720) < 1080')));
});

test('checkSection skips non-demo', () => {
  const result = checkSection({ id: 's01', demo: false });
  assert.strictEqual(result.verdict, 'skip');
});

test('buildReport format', () => {
  const rows = [
    { id: 's01', clipPath: 's01.mp4', videoDur: 12.0, audioDur: 10.0, height: 1080, verdict: 'pass', issues: [] },
    { id: 's02', clipPath: null, videoDur: undefined, audioDur: 10.0, height: undefined, verdict: 'fail', issues: ['missing'] }
  ];
  const md = buildReport('test-slug', rows, '2026-07-23');
  const lines = md.split('\n');
  assert.strictEqual(lines[0], '# Intake QC — test-slug — 2026-07-23');
  assert.ok(md.includes('| s01 | s01.mp4 | 12.00 | 10.00 | 1080 | pass | - |'));
  assert.ok(md.includes('| s02 | - | - | 10.00 | - | fail | missing |'));
  assert.strictEqual(lines[lines.length - 2], 'RESULT: FAIL (1 sections)');
});
