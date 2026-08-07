import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { mmss, rewriteDuration, rewriteCanvas, manifestMd, planRender, manifestCues, hashRenderInputs, pruneCache, runPool, DEFAULT_JOBS } from './render.mjs';

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

test('rewriteCanvas: no data-width attribute errors', () => {
  const html = '<div data-duration="6"></div>';
  const { html: out, error } = rewriteCanvas(html, 1200);
  assert.ok(error);
  assert.equal(out, html);
});

test('rewriteCanvas: mixed data-width values error, html unchanged', () => {
  const html = '<div data-width="1920"></div><div data-width="960"></div>';
  const { html: out, error } = rewriteCanvas(html, 1200);
  assert.ok(error);
  assert.equal(out, html);
});

test('rewriteCanvas: single data-width value is rewritten to 1200', () => {
  const html = '<div id="root" data-width="1920"></div>';
  const { html: out, error } = rewriteCanvas(html, 1200);
  assert.equal(error, null);
  assert.equal(out, '<div id="root" data-width="1200"></div>');
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

// ---- cache + pool ---------------------------------------------------------
// 090 was a sequential loop with no cache at all: every `cut` re-rendered all
// 39 cards even when one word of copy had changed. Measured on test-01's 14
// renderable cues, M2 Pro: jobs=1 118.5s, jobs=3 68.2s, warm cache 0.2s.

test('hashRenderInputs changes when ANY staged input changes', () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const a = fs.mkdtempSync(path.join(TMP_ROOT, 'hash-a-'));
  fs.mkdirSync(path.join(a, 'card'));
  fs.writeFileSync(path.join(a, 'card', 'index.html'), '<div data-duration="6"></div>');
  fs.writeFileSync(path.join(a, 'vars.json'), '{"title":"one"}');
  const args = ['hyperframes', 'render', '--format', 'mp4'];

  const base = hashRenderInputs(a, args);
  assert.equal(hashRenderInputs(a, args), base, 'stable for identical inputs');

  // a variables-only change must bust the key — this is exactly what an
  // mtime-based cache would miss, serving a stale clip silently
  fs.writeFileSync(path.join(a, 'vars.json'), '{"title":"two"}');
  assert.notEqual(hashRenderInputs(a, args), base, 'variables must be in the key');

  fs.writeFileSync(path.join(a, 'vars.json'), '{"title":"one"}');
  assert.equal(hashRenderInputs(a, args), base, 'and back again');

  // card markup
  fs.writeFileSync(path.join(a, 'card', 'index.html'), '<div data-duration="9"></div>');
  assert.notEqual(hashRenderInputs(a, args), base, 'card html must be in the key');

  // a new file anywhere in the tree
  fs.writeFileSync(path.join(a, 'card', 'index.html'), '<div data-duration="6"></div>');
  fs.writeFileSync(path.join(a, 'card', 'extra.css'), 'body{}');
  assert.notEqual(hashRenderInputs(a, args), base, 'an added file must be in the key');
});

test('hashRenderInputs separates quality and format', () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const d = fs.mkdtempSync(path.join(TMP_ROOT, 'hash-args-'));
  fs.writeFileSync(path.join(d, 'vars.json'), '{}');
  assert.notEqual(
    hashRenderInputs(d, ['hf', '--format', 'mp4']),
    hashRenderInputs(d, ['hf', '--format', 'mov']),
    'a draft mp4 and an overlay mov are not interchangeable',
  );
});

test('pruneCache drops only entries past the TTL', () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'prune-'));
  const fresh = path.join(dir, 'fresh.mp4');
  const stale = path.join(dir, 'stale.mp4');
  fs.writeFileSync(fresh, 'x');
  fs.writeFileSync(stale, 'x');
  const old = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
  fs.utimesSync(stale, old, old);

  assert.equal(pruneCache(dir), 1);
  assert.ok(fs.existsSync(fresh));
  assert.ok(!fs.existsSync(stale));
  assert.equal(pruneCache(path.join(dir, 'nope')), 0, 'a missing cache dir is not an error');
});

test('runPool runs every item and bounds concurrency', async () => {
  const items = Array.from({ length: 12 }, (_, i) => i);
  const seen = [];
  let inFlight = 0;
  let peak = 0;
  await runPool(items, 3, async (n) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    seen.push(n);
    inFlight--;
  });
  assert.equal(seen.length, 12, 'every item must run exactly once');
  assert.deepEqual([...seen].sort((a, b) => a - b), items);
  assert.ok(peak <= 3, `concurrency must stay bounded, saw ${peak}`);
  assert.ok(peak > 1, 'and must actually overlap');
});

test('runPool with one worker is plain sequential order', async () => {
  const seen = [];
  await runPool([1, 2, 3], 1, async (n) => { seen.push(n); });
  assert.deepEqual(seen, [1, 2, 3]);
});
