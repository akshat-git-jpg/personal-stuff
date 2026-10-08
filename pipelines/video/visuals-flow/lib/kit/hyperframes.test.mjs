import test from 'node:test';
import assert from 'node:assert/strict';
import { HYPERFRAMES, npxArgs, lintArgs, checkArgs, snapshotArgs, renderArgs, extractJsonObject, summariseFindings, lavfiPath } from './index.mjs';
import { FILM_RENDERER } from '../renderer-constants.mjs';

test('review and render share one renderer pin', () => {
  assert.equal(HYPERFRAMES, FILM_RENDERER);
  for (const a of [lintArgs('d'), checkArgs('d'), snapshotArgs('d', [1], 'o'), renderArgs('d', 'o.mp4')]) assert.equal(a[1], HYPERFRAMES);
});

test('argument lists name the directory and an output file', () => {
  assert.deepEqual(checkArgs('/c'), ['-y', HYPERFRAMES, 'check', '/c', '--at-transitions', '--json']);
  assert.deepEqual(snapshotArgs('/c', [1.5, 3], '/o'), ['-y', HYPERFRAMES, 'snapshot', '/c', '--at', '1.5,3', '--no-end', '--describe', 'false', '-o', '/o']);
  assert.deepEqual(renderArgs('/c', '/o/m.mp4', 25).slice(2), ['render', '/c', '--fps', '25', '--format', 'mp4', '--quality', 'high', '-o', '/o/m.mp4']);
});

test('a shell-run npx gets paths with spaces quoted; a direct spawn does not', () => {
  assert.deepEqual(npxArgs(['check', 'C:/My Videos/m1'], true), ['check', '"C:/My Videos/m1"']);
  assert.deepEqual(npxArgs(['check', '/My Videos/m1'], false), ['check', '/My Videos/m1']);
});

test('the check report is found between progress output, braces inside strings included', () => {
  const raw = 'spinner {not json\n{"lint":{"findings":[{"message":"a } in text"}]}}\n done';
  assert.throws(() => extractJsonObject('nothing'), /no JSON object/);
  assert.deepEqual(JSON.parse(extractJsonObject(raw.slice(raw.indexOf('\n') + 1))).lint.findings[0].message, 'a } in text');
});

test('findings: info dropped, errors first, then by time', () => {
  const report = {
    lint: { findings: [{ severity: 'warning', code: 'w', time: 1 }] },
    layout: { findings: [{ severity: 'error', code: 'overflow', firstSeen: 2, lastSeen: 3, selector: '#a' }, { severity: 'info', code: 'i' }] },
    contrast: { findings: [{ severity: 'error', code: 'low', time: 0.5 }] },
  };
  assert.deepEqual(summariseFindings(report).map((f) => [f.severity, f.code, f.from, f.to]), [
    ['error', 'low', 0.5, 0.5], ['error', 'overflow', 2, 3], ['warning', 'w', 1, 1]]);
});

test('a Windows path survives the lavfi parser', () => {
  assert.equal(lavfiPath('C:\\Users\\me\\m.mp4'), 'C\\\\:/Users/me/m.mp4');
  assert.equal(lavfiPath('/tmp/m.mp4'), '/tmp/m.mp4');
});
