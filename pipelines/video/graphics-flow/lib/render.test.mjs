import test from 'node:test';
import assert from 'node:assert/strict';
import { mmss, rewriteDuration, manifestMd, planRender } from './render.mjs';

test('rewriteDuration: uniform data-duration values all get replaced', () => {
  const html = '<div data-duration="6"></div><div data-duration="6"></div><div data-duration="6"></div>';
  const { html: out, error } = rewriteDuration(html, 24.5);
  assert.equal(error, null);
  assert.equal(out, '<div data-duration="24.5"></div><div data-duration="24.5"></div><div data-duration="24.5"></div>');
});

test('rewriteDuration: mixed data-duration values error, html unchanged', () => {
  const html = '<div data-duration="6"></div><div data-duration="3"></div>';
  const { html: out, error } = rewriteDuration(html, 24.5);
  assert.ok(error);
  assert.equal(out, html);
});

test('mmss formats minutes:seconds.decisecond', () => {
  assert.equal(mmss(272.03), '04:32.0');
  assert.equal(mmss(0), '00:00.0');
});

test('manifestMd sorts cues by start and formats columns', () => {
  const cues = [
    { id: 'c02', card: 'overlay/callout', placement: 'overlay', start: 10, duration: 3 },
    { id: 'c01', card: 'pros-cons/pros-cons', placement: 'fullframe', start: 0, duration: 24.5 },
  ];
  const md = manifestMd('notion-vs-asana', cues);
  const lines = md.split('\n');
  assert.equal(lines[0], '# notion-vs-asana — graphics manifest');
  const rowLines = lines.filter((l) => l.startsWith('|') && !l.startsWith('|---'));
  // header row + c01 (start 0) then c02 (start 10)
  assert.equal(rowLines.length, 3);
  assert.match(rowLines[1], /^\| 00:00\.0 \| \S+\.mp4 \| 24\.5s \| fullframe \| pros-cons\/pros-cons \|$/);
  assert.match(rowLines[2], /^\| 00:10\.0 \| \S+\.mov \| 3s \| overlay \| overlay\/callout \|$/);
});

test('planRender: overlay placement renders mov, fullframe renders mp4', () => {
  const overlayCue = { id: 'c01', card: 'overlay/callout', placement: 'overlay', start: 4.0 };
  const fullframeCue = { id: 'c02', card: 'pros-cons/pros-cons', placement: 'fullframe', start: 4.0 };

  const overlayPlan = planRender(overlayCue);
  assert.ok(overlayPlan.args.includes('--format'));
  assert.equal(overlayPlan.args[overlayPlan.args.indexOf('--format') + 1], 'mov');
  assert.ok(overlayPlan.outFile.endsWith('.mov'));

  const fullframePlan = planRender(fullframeCue);
  assert.equal(fullframePlan.args[fullframePlan.args.indexOf('--format') + 1], 'mp4');
  assert.ok(fullframePlan.outFile.endsWith('.mp4'));
});
