import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { mmss, rewriteDuration, manifestMd, planRender, manifestCues } from './render.mjs';

const TMP_ROOT = path.join(import.meta.dirname, '.test-tmp', 'render');
test.before(() => {
  if (fs.existsSync(TMP_ROOT)) {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  }
});
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

test('manifestMd applies timeline offset to place-at column only', () => {
  const cues = [
    { id: 'c01', card: 'pros-cons/pros-cons', placement: 'fullframe', start: 10, duration: 8 },
  ];
  const md = manifestMd('vid', cues, 62.5);
  assert.match(md, /\| 01:12\.5 \|/);
  assert.match(md, /offset 62\.5s/);
  const noOffset = manifestMd('vid', cues);
  assert.match(noOffset, /\| 00:10\.0 \|/);
  assert.match(noOffset, /starts at 00:00\.0/);
});

test('manifestCues returns only cues whose outFile exists', () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const renderDir = fs.mkdtempSync(path.join(TMP_ROOT, 'manifest-cues-'));
  
  const cues = [
    { id: 'c01', card: 'overlay/callout', placement: 'overlay', start: 10, duration: 3 },
    { id: 'c02', card: 'pros-cons/pros-cons', placement: 'fullframe', start: 0, duration: 24.5 },
    { id: 'c03', card: 'overlay/callout', placement: 'overlay', start: 20, duration: 3 },
  ];

  // Create dummy files for c01 and c03
  fs.writeFileSync(path.join(renderDir, planRender(cues[0]).outFile), 'dummy');
  fs.writeFileSync(path.join(renderDir, planRender(cues[2]).outFile), 'dummy');

  const filtered = manifestCues(cues, renderDir);
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].id, 'c01');
  assert.equal(filtered[1].id, 'c03');
});

test('CLI: approval gate exits 1 and mentions approved', () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const workdir = fs.mkdtempSync(path.join(TMP_ROOT, 'approval-'));
  
  // cues-ok.json has approved: false
  fs.copyFileSync(path.join(import.meta.dirname, 'fixtures', 'cues-ok.json'), path.join(workdir, 'cues.json'));
  fs.copyFileSync(path.join(import.meta.dirname, 'fixtures', 'transcript.json'), path.join(workdir, 'transcript.json'));
  
  // Create a resolved.json (we can just run resolveCues or just copy a dummy)
  // Let's run resolve.mjs to create a clean resolved.json
  spawnSync(process.execPath, [path.join(import.meta.dirname, 'resolve.mjs'), workdir]);

  const result = spawnSync(process.execPath, [path.join(import.meta.dirname, 'render.mjs'), workdir], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /approved=false/);
});

test('CLI: staleness gate exits 1 and mentions stale', () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const workdir = fs.mkdtempSync(path.join(TMP_ROOT, 'stale-'));
  
  const cuesJson = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures', 'cues-ok.json'), 'utf8'));
  cuesJson.approved = true;
  fs.writeFileSync(path.join(workdir, 'cues.json'), JSON.stringify(cuesJson));
  fs.copyFileSync(path.join(import.meta.dirname, 'fixtures', 'transcript.json'), path.join(workdir, 'transcript.json'));
  
  spawnSync(process.execPath, [path.join(import.meta.dirname, 'resolve.mjs'), workdir]);
  
  // Perturb resolved.json
  const resolvedPath = path.join(workdir, 'resolved.json');
  const resolvedData = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  resolvedData.resolved[0].start += 1;
  fs.writeFileSync(resolvedPath, JSON.stringify(resolvedData));

  const result = spawnSync(process.execPath, [path.join(import.meta.dirname, 'render.mjs'), workdir], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /stale/);
});
