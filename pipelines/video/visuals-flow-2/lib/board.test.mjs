import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer, latestWorkdir, buildSegments, synthCalibrationVars, loadShots, mergeShots, loadEffects, mergeEffects, fxContext, fxEventsAt, appendFinalFeedback, pinFromClick, resolveAndExtend, playthroughView, toggleAuditAccepted } from './board.mjs';

const FIXTURE_DIR = path.join(import.meta.dirname, 'fixtures', 'board');
const TMP_ROOT = path.join(import.meta.dirname, '.test-tmp', 'board');
const CARD_LIBRARY_ROOT = path.resolve(import.meta.dirname, '..', '..', 'card-library');
const CATALOG = JSON.parse(fs.readFileSync(path.join(CARD_LIBRARY_ROOT, 'catalog.json'), 'utf8'));
const BEAT_CARDS = CATALOG.cards.filter((c) => c.kind === 'beat');

function ensureFixtureAudio() {
  const voPath = path.join(FIXTURE_DIR, 'vo.mp3');
  if (fs.existsSync(voPath)) return;
  const result = spawnSync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=30', '-c:a', 'libmp3lame', voPath,
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

function makeWorkdir(withEffects = false) {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'board-'));
  const files = ['cues.json', 'resolved.json', 'transcript.json', 'vo.mp3'];
  if (withEffects) files.push('effects.json');
  for (const f of files) {
    fs.copyFileSync(path.join(FIXTURE_DIR, f), path.join(dir, f));
  }
  return dir;
}

async function startServer(workdir) {
  const server = createServer(workdir);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, base: `http://localhost:${port}` };
}

test.before(() => {
  if (fs.existsSync(TMP_ROOT)) {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  }
  ensureFixtureAudio();
});

test('GET /list lists every cue id and an Approve button', async () => {
  const { server, base } = await startServer(makeWorkdir());
  try {
    const res = await fetch(`${base}/list`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /c01/);
    assert.match(html, /c02/);
    assert.match(html, />Approve graphics</);
  } finally {
    server.close();
  }
});

test('GET / renders the timeline with all four lanes and a link to /list', async () => {
  const { server, base } = await startServer(makeWorkdir());
  try {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /SCREEN/);
    assert.match(html, /GRAPHICS/);
    assert.match(html, /AVATAR/);
    assert.match(html, /EFFECTS/);
    assert.match(html, /c01/);
    assert.match(html, /data-detail="seg-/);
    assert.match(html, /href="\/list"/);
    assert.match(html, />Approve graphics</);
  } finally {
    server.close();
  }
});

test('GET / keeps card previews inert in the detail store (data-src, not eager src)', async () => {
  const { server, base } = await startServer(makeWorkdir());
  try {
    const res = await fetch(`${base}/`);
    const html = await res.text();
    assert.ok(html.includes('data-src="/card/'), 'card iframe uses data-src');
    assert.ok(!html.includes('<iframe loading="lazy" src="/card/'), 'no eager card iframe on the timeline');
  } finally {
    server.close();
  }
});

test('GET / shows effects markers when effects.json is present', async () => {
  const { server, base } = await startServer(makeWorkdir(true));
  try {
    const res = await fetch(`${base}/`);
    const html = await res.text();
    assert.match(html, /tl-mark/);
  } finally {
    server.close();
  }
});

test('GET /card/c01 injects the getVariables shim before the card\'s first original script and includes resolved beat text', async () => {
  const { server, base } = await startServer(makeWorkdir());
  try {
    const res = await fetch(`${base}/card/c01`);
    assert.equal(res.status, 200);
    const html = await res.text();
    const shimIdx = html.indexOf('getVariables');
    const cardScriptIdx = html.indexOf('cdn.jsdelivr.net/npm/gsap');
    assert.ok(shimIdx !== -1, 'shim getVariables present');
    assert.ok(cardScriptIdx !== -1, "card's original script present");
    assert.ok(shimIdx < cardScriptIdx, 'shim is injected before the first original script');
    assert.match(html, /Great support/);
  } finally {
    server.close();
  }
});

test('GET /card/c01 includes the overflow probe (__measureOverflow + probe message handler)', async () => {
  const { server, base } = await startServer(makeWorkdir());
  try {
    const res = await fetch(`${base}/card/c01`);
    const html = await res.text();
    assert.match(html, /__measureOverflow/);
    assert.match(html, /Array\.isArray\(e\.data\.probe\)/);
  } finally {
    server.close();
  }
});

test('GET /slice/c01.mp3 serves a non-empty mp3 generated on start', async () => {
  const { server, base } = await startServer(makeWorkdir());
  try {
    const res = await fetch(`${base}/slice/c01.mp3`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'audio/mpeg');
    const buf = Buffer.from(await res.arrayBuffer());
    assert.ok(buf.length > 0);
  } finally {
    server.close();
  }
});

test('POST /save with a valid edit updates cues.json and regenerates resolved.json', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const cuesFile = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    cuesFile.cues[0].variables.title = 'Edited';
    const res = await fetch(`${base}/save`, { method: 'POST', body: JSON.stringify(cuesFile) });
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.ok(Array.isArray(data.errors));
    assert.ok(Array.isArray(data.warnings));

    const onDisk = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    assert.equal(onDisk.cues[0].variables.title, 'Edited');

    const resolved = JSON.parse(fs.readFileSync(path.join(workdir, 'resolved.json'), 'utf8'));
    assert.equal(resolved.resolved[0].variables.title, 'Edited');
  } finally {
    server.close();
  }
});

test('POST /save with a broken anchor keeps the edit, reports the resolver error, and leaves resolved.json untouched', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const beforeResolved = fs.readFileSync(path.join(workdir, 'resolved.json'), 'utf8');
    const cuesFile = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    cuesFile.cues[1].anchor = 'this phrase is nowhere in the transcript';
    const res = await fetch(`${base}/save`, { method: 'POST', body: JSON.stringify(cuesFile) });
    const data = await res.json();
    assert.equal(data.ok, false);
    assert.ok(data.errors.some((e) => e.startsWith('c02')), `expected a c02 error, got ${JSON.stringify(data.errors)}`);

    const onDisk = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    assert.equal(onDisk.cues[1].anchor, 'this phrase is nowhere in the transcript');

    const afterResolved = fs.readFileSync(path.join(workdir, 'resolved.json'), 'utf8');
    assert.equal(afterResolved, beforeResolved);
  } finally {
    server.close();
  }
});

test('POST /approve sets cues.json approved: true', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/approve`, { method: 'POST' });
    const data = await res.json();
    assert.deepEqual(data, { ok: true });

    const onDisk = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    assert.equal(onDisk.approved, true);
  } finally {
    server.close();
  }
});
test('resolveAndExtend: applies the same post-pass as resolve.mjs main() — a save can\'t drop exposure', () => {
  const words = [
    { text: 'alpha', start: 0.5, end: 0.8 },
    { text: 'bravo', start: 1.0, end: 1.3 },
    { text: 'charlie', start: 1.5, end: 1.8 },
    { text: 'delta', start: 2.0, end: 2.3 },
    { text: 'echo', start: 8.5, end: 8.8 },
    { text: 'foxtrot', start: 9.0, end: 9.3 },
    { text: 'golf', start: 9.5, end: 9.8 },
    { text: 'hotel', start: 10.0, end: 10.3 },
  ];
  const catalog = { cards: [{ slug: 'test/full', kind: 'single', placement: 'fullframe', default_duration: 3, variables: {} }] };
  const cues = [
    { id: 'f1', card: 'test/full', anchor: 'alpha bravo charlie delta', variables: {} },
    { id: 'f2', card: 'test/full', anchor: 'echo foxtrot golf hotel', variables: {} },
  ];
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const workdir = fs.mkdtempSync(path.join(TMP_ROOT, 'extend-'));
  fs.writeFileSync(path.join(workdir, 'video.json'), JSON.stringify({ base: 'none' }));

  const { resolved, errors } = resolveAndExtend(cues, words, catalog, null, workdir);
  assert.deepEqual(errors, []);
  assert.equal(resolved[0].start, 0);
  // unextended duration would be the card default (3s, ending at 3s); the
  // post-pass must extend f1 all the way to f2's start on base:none.
  assert.equal(resolved[0].duration, 8);
  assert.equal(resolved[0].start + resolved[0].duration, resolved[1].start);
});

test('playthroughView: picks the active block and a gap carries the next cue\'s start', () => {
  const blocks = [
    { id: 'seg-0', start: 0, kind: 'cue' },
    { id: 'seg-1', start: 5, kind: 'gap' },
    { id: 'seg-2', start: 12, kind: 'cue' },
  ];
  assert.equal(playthroughView(blocks, -1), null);
  assert.deepEqual(playthroughView(blocks, 0), { kind: 'cue', id: 'seg-0' });
  assert.deepEqual(playthroughView(blocks, 4.9), { kind: 'cue', id: 'seg-0' });
  assert.deepEqual(playthroughView(blocks, 5), { kind: 'gap', id: 'seg-1', nextStart: 12 });
  assert.deepEqual(playthroughView(blocks, 11.9), { kind: 'gap', id: 'seg-1', nextStart: 12 });
  assert.deepEqual(playthroughView(blocks, 12), { kind: 'cue', id: 'seg-2' });
  assert.deepEqual(playthroughView(blocks, 999), { kind: 'cue', id: 'seg-2' });
});

test('playthroughView: a trailing gap (no next cue) reports nextStart null', () => {
  const blocks = [
    { id: 'seg-0', start: 0, kind: 'cue' },
    { id: 'seg-1', start: 5, kind: 'gap' },
  ];
  assert.deepEqual(playthroughView(blocks, 7), { kind: 'gap', id: 'seg-1', nextStart: null });
});

test('buildSegments: words fully covered, no duplication, contiguous order', () => {
  const words = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'transcript.json'), 'utf8'));
  const resolved = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'resolved.json'), 'utf8')).resolved;
  
  const segments = buildSegments(words, resolved);
  
  let wordCount = 0;
  for (const seg of segments) {
    wordCount += seg.words.length;
  }
  assert.equal(wordCount, words.length, 'total words in segments must equal transcript words');
  
  for (let i = 1; i < segments.length; i++) {
    assert.ok(segments[i - 1].start <= segments[i].start, `segment ${i-1} start ${segments[i-1].start} > segment ${i} start ${segments[i].start}`);
  }
});

test('buildSegments: short gap folding', () => {
  const words = [
    { text: "w1", start: 0, end: 1 },
    { text: "w2", start: 1, end: 2 },
    { text: "w3", start: 2, end: 3 },
  ];
  const resolved = [
    { id: "c1", start: -5, duration: 4 },
    { id: "c2", start: 4, duration: 2 },
  ];
  const segments = buildSegments(words, resolved, { gapMinWords: 4 });
  assert.equal(segments.length, 2);
  assert.equal(segments[0].kind, 'cue');
  assert.equal(segments[0].cue.id, 'c1');
  assert.equal(segments[1].kind, 'cue');
  assert.equal(segments[1].cue.id, 'c2');
  assert.equal(segments[1].words.length, 3);
});

test('GET /list contains gap timecode, cues in DOM order, anchor highlighted, minimap matches segment count', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/list`);
    assert.equal(res.status, 200);
    const html = await res.text();
    
    assert.match(html, /gap-block/);
    assert.match(html, /&rarr;/);
    
    const c01Idx = html.indexOf('data-id="c01"');
    const c02Idx = html.indexOf('data-id="c02"');
    assert.ok(c01Idx !== -1 && c02Idx !== -1, 'both cues present');
    assert.ok(c01Idx < c02Idx, 'c01 comes before c02');
    
    assert.match(html, /<mark>let&#39;s<\/mark>\s*<mark>look<\/mark>\s*<mark>at<\/mark>\s*<mark>the<\/mark>\s*<mark>pros<\/mark>\s*<mark>and<\/mark>\s*<mark>cons<\/mark>/);
    
    const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));
    const resolved = JSON.parse(fs.readFileSync(path.join(workdir, 'resolved.json'), 'utf8')).resolved;
    const segs = buildSegments(words, resolved);
    const minimapCount = (html.match(/class="minimap-seg"/g) || []).length;
    assert.equal(minimapCount, segs.length, 'minimap segments must equal buildSegments length');
  } finally {
    server.close();
  }
});

test('save: feedback goes to feedback.json; offset survives; page renders saved feedback', async () => {
  const workdir = makeWorkdir();
  const cuesPath = path.join(workdir, 'cues.json');
  const before = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
  before.offset = 3.5;
  fs.writeFileSync(cuesPath, JSON.stringify(before, null, 2));

  const server = createServer(workdir);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    const body = { video: before.video, approved: false, cues: before.cues, feedback: { c01: 'wrong card here', '_global': 'good pass', empty: '  ' } };
    const res = await fetch(`http://localhost:${port}/save`, { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json();
    assert.equal(data.ok, true);

    const after = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
    assert.equal(after.offset, 3.5); // top-level fields survive saves
    assert.ok(!('feedback' in after)); // feedback never lands in cues.json

    const fb = JSON.parse(fs.readFileSync(path.join(workdir, 'feedback.json'), 'utf8'));
    assert.equal(fb.items.c01.text, 'wrong card here');
    assert.equal(fb.items._global.text, 'good pass');
    assert.ok(!('empty' in fb.items)); // blank entries dropped

    const resolvedOut = JSON.parse(fs.readFileSync(path.join(workdir, 'resolved.json'), 'utf8'));
    assert.equal(resolvedOut.offset, 3.5);

    const page = await (await fetch(`http://localhost:${port}/`)).text();
    assert.ok(page.includes('wrong card here'));
    assert.ok(page.includes('data-ref="_global"'));
  } finally {
    server.close();
  }
});

test('save: folded items survive save intact; other items update', async () => {
  const workdir = makeWorkdir();
  const fbPath = path.join(workdir, 'feedback.json');
  fs.writeFileSync(fbPath, JSON.stringify({
    items: {
      c01: { text: 'old lesson', folded: '2026-07-18 — RULEBOOK' },
      _global: { text: 'still open' }
    }
  }));

  const cuesPath = path.join(workdir, 'cues.json');
  const before = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));

  const server = createServer(workdir);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    const body = { video: before.video, approved: false, cues: before.cues, feedback: { _global: 'updated note', c02: 'new item' } };
    const res = await fetch(`http://localhost:${port}/save`, { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json();
    assert.equal(data.ok, true);

    const fb = JSON.parse(fs.readFileSync(fbPath, 'utf8'));
    assert.equal(fb.items.c01.folded, '2026-07-18 — RULEBOOK');
    assert.equal(fb.items.c01.text, 'old lesson');
    assert.equal(fb.items._global.text, 'updated note');
    assert.equal(fb.items.c02.text, 'new item');
  } finally {
    server.close();
  }
});

test('GET /: folded items are read-only in the page and prefill only unfolded text', async () => {
  const workdir = makeWorkdir();
  const fbPath = path.join(workdir, 'feedback.json');
  fs.writeFileSync(fbPath, JSON.stringify({
    items: {
      c01: { text: 'old lesson', folded: '2026-07-18' }
    }
  }));

  const server = createServer(workdir);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    const page = await (await fetch(`http://localhost:${port}/`)).text();
    // The c01 textarea should NOT contain 'old lesson'
    const c01TextareaMatch = page.match(/<textarea[^>]*data-ref="c01"[^>]*>([^<]*)<\/textarea>/);
    assert.ok(c01TextareaMatch);
    assert.equal(c01TextareaMatch[1], ''); // Should be empty

    // Should contain the folded read-only rendering
    assert.ok(page.includes('folded 2026-07-18'));
    assert.ok(page.includes('old lesson'));
    assert.ok(page.includes('feedback-folded'));
  } finally {
    server.close();
  }
});

test('GET / and save: legacy string upgrade', async () => {
  const workdir = makeWorkdir();
  const fbPath = path.join(workdir, 'feedback.json');
  fs.writeFileSync(fbPath, JSON.stringify({
    items: {
      c01: 'plain old string'
    }
  }));

  const cuesPath = path.join(workdir, 'cues.json');
  const before = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));

  const server = createServer(workdir);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    const page = await (await fetch(`http://localhost:${port}/`)).text();
    assert.ok(page.includes('plain old string')); // Prefilled

    const body = { video: before.video, approved: false, cues: before.cues, feedback: { c01: 'plain old string' } };
    const res = await fetch(`http://localhost:${port}/save`, { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json();
    assert.equal(data.ok, true);

    const fb = JSON.parse(fs.readFileSync(fbPath, 'utf8'));
    assert.equal(typeof fb.items.c01, 'object');
    assert.equal(fb.items.c01.text, 'plain old string');
  } finally {
    server.close();
  }
});

test('save: clearing a feedback box deletes the unfolded item', async () => {
  const workdir = makeWorkdir();
  const fbPath = path.join(workdir, 'feedback.json');
  fs.writeFileSync(fbPath, JSON.stringify({
    items: {
      c01: { text: 'delete me' }
    }
  }));

  const cuesPath = path.join(workdir, 'cues.json');
  const before = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));

  const server = createServer(workdir);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    const body = { video: before.video, approved: false, cues: before.cues, feedback: { c01: '' } };
    const res = await fetch(`http://localhost:${port}/save`, { method: 'POST', body: JSON.stringify(body) });
    const data = await res.json();
    assert.equal(data.ok, true);

    const fb = JSON.parse(fs.readFileSync(fbPath, 'utf8'));
    assert.ok(!('c01' in fb.items));
  } finally {
    server.close();
  }
});

test('save: changing cues resets approved to false; identical save keeps it true', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    // Approve first
    await fetch(`${base}/approve`, { method: 'POST' });
    let onDisk = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    assert.equal(onDisk.approved, true);

    // Save identical cues
    let res = await fetch(`${base}/save`, { method: 'POST', body: JSON.stringify(onDisk) });
    let data = await res.json();
    assert.equal(data.ok, true);
    onDisk = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    assert.equal(onDisk.approved, true);

    // Save with a changed cue
    onDisk.cues[0].hold = (onDisk.cues[0].hold || 3) + 1;
    res = await fetch(`${base}/save`, { method: 'POST', body: JSON.stringify(onDisk) });
    data = await res.json();
    assert.equal(data.ok, true);
    onDisk = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    assert.equal(onDisk.approved, false);
  } finally {
    server.close();
  }
});

test('save: incremental slices only re-encode changed cues', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const cuesFile = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    let res = await fetch(`${base}/save`, { method: 'POST', body: JSON.stringify(cuesFile) });
    assert.equal((await res.json()).ok, true);

    const slicesDir = path.join(workdir, 'slices');
    const c01Path = path.join(slicesDir, 'c01.mp3');
    const c02Path = path.join(slicesDir, 'c02.mp3');
    const c01Stat = fs.statSync(c01Path);
    const c02Stat = fs.statSync(c02Path);

    await new Promise(resolve => setTimeout(resolve, 50));

    // +1 no longer moves the cache key on this fixture: c01 is the sole
    // fullframe cue, so resolveAndExtend's post-pass (plan 144) pads it all
    // the way to the transcript end regardless of hold, for any increment
    // that doesn't push its unextended span past that boundary. Jump hold
    // far enough that the unextended end overtakes the boundary and the
    // post-pass skips extension, so the resolved duration actually changes.
    cuesFile.cues[0].hold = (cuesFile.cues[0].hold || 3) + 6;
    res = await fetch(`${base}/save`, { method: 'POST', body: JSON.stringify(cuesFile) });
    assert.equal((await res.json()).ok, true);

    const c01Stat2 = fs.statSync(c01Path);
    const c02Stat2 = fs.statSync(c02Path);

    assert.notEqual(c01Stat2.mtimeMs, c01Stat.mtimeMs, 'c01 should have been re-encoded');
    assert.equal(c02Stat2.mtimeMs, c02Stat.mtimeMs, 'c02 should not have been re-encoded');
  } finally {
    server.close();
  }
});

test('POST /save with invalid JSON body returns 400 and error', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/save`, { method: 'POST', body: 'not json' });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.ok, false);
    assert.match(data.errors[0], /invalid JSON/);
  } finally {
    server.close();
  }
});

test('GET /calibrate lists one tile per beat card in the catalog', async () => {
  const { server, base } = await startServer(makeWorkdir());
  try {
    const res = await fetch(`${base}/calibrate`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(BEAT_CARDS.length > 0, 'catalog fixture sanity: expected at least one beat card');
    for (const card of BEAT_CARDS) {
      assert.ok(html.includes(card.slug), `expected ${card.slug} tile on /calibrate`);
    }
    const tileCount = (html.match(/class="timeline-block tile"/g) || []).length;
    assert.equal(tileCount, BEAT_CARDS.length);
  } finally {
    server.close();
  }
});

test('GET /calibrate-card/<slug> serves every beat card 200 with getVariables present', async () => {
  const { server, base } = await startServer(makeWorkdir());
  try {
    for (const card of BEAT_CARDS) {
      const res = await fetch(`${base}/calibrate-card/${encodeURIComponent(card.slug)}`);
      assert.equal(res.status, 200, `${card.slug} should respond 200`);
      const html = await res.text();
      assert.match(html, /getVariables/, `${card.slug} should include the shim`);
    }
  } finally {
    server.close();
  }
});

test('GET /calibrate-card/<unknown> returns 404', async () => {
  const { server, base } = await startServer(makeWorkdir());
  try {
    const res = await fetch(`${base}/calibrate-card/${encodeURIComponent('nope/nope')}`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test('synthCalibrationVars: every beat card synthesizes exactly max_beats beats, filling the appropriate structure based on beat_source', () => {
  for (const card of BEAT_CARDS) {
    const { variables, beats } = synthCalibrationVars(card);
    assert.equal(beats.length, card.max_beats, `${card.slug}: expected ${card.max_beats} beats`);
    
    if (card.beat_source === 'variables') {
      const arr = variables[card.beat_var];
      assert.ok(Array.isArray(arr), `${card.slug}: beat_var "${card.beat_var}" must be an array`);
      assert.equal(arr.length, card.max_beats, `${card.slug}: beat_var array must have exactly max_beats entries`);
      
      for (const beat of beats) {
        assert.deepEqual(Object.keys(beat), ['at'], `${card.slug}: variables-driven beats must carry only timing (got keys: ${Object.keys(beat).join(', ')})`);
        assert.equal(typeof beat.at, 'number');
      }
    } else {
      // beat_source === 'beat'
      for (const beat of beats) {
        assert.equal(typeof beat.at, 'number');
        for (const [key, value] of Object.entries(beat)) {
          if (key === 'at' || key === 'color') continue; // color is a CSS value, not reveal text
          if (typeof value === 'string') {
            assert.ok(value.length <= card.max_reveal_chars, `${card.slug} beat.${key} is ${value.length} chars, max ${card.max_reveal_chars}`);
          }
        }
        if (Array.isArray(beat.values) && Array.isArray(variables.products)) {
          assert.equal(beat.values.length, variables.products.length, `${card.slug}: values must match products 1:1`);
        }
      }
    }

    for (const [key, spec] of Object.entries(card.variables ?? {})) {
      const isString = typeof spec === 'string';
      const desc = isString ? spec : (spec.descriptor || spec.type || '');
      if (isString ? /\(optional\)/i.test(desc) : spec.required === false) continue;
      assert.ok(key in variables, `${card.slug}: required variable "${key}" missing from synthesis`);
    }
  }
});

test('save: context snapshot on creation, preserved on edit', async () => {
  const workdir = makeWorkdir();
  // inject a gap at the end
  const transcriptPath = path.join(workdir, 'transcript.json');
  const words = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
  words.push({ text: 'gap', start: 20.0, end: 20.5 });
  words.push({ text: 'time', start: 21.0, end: 21.5 });
  fs.writeFileSync(transcriptPath, JSON.stringify(words));

  const cuesPath = path.join(workdir, 'cues.json');
  const before = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));

  const server = createServer(workdir);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    const body1 = { video: before.video, approved: false, cues: before.cues, feedback: { c01: 'cue feedback', 'gap-00:20.0': 'gap feedback' } };
    let res = await fetch(`http://localhost:${port}/save`, { method: 'POST', body: JSON.stringify(body1) });
    assert.equal((await res.json()).ok, true);

    let fb = JSON.parse(fs.readFileSync(path.join(workdir, 'feedback.json'), 'utf8'));
    assert.ok(fb.items.c01.context, 'c01 context missing');
    assert.equal(fb.items.c01.context.card, 'pros-cons/pros-cons');
    assert.equal(fb.items.c01.context.anchor, "let's look at the pros and cons");
    assert.equal(typeof fb.items.c01.context.start, 'number');

    assert.ok(fb.items['gap-00:20.0'].context, 'gap-00:20.0 context missing');
    assert.equal(fb.items['gap-00:20.0'].context.start, 20);
    assert.equal(typeof fb.items['gap-00:20.0'].context.end, 'number');
    assert.equal(typeof fb.items['gap-00:20.0'].context.excerpt, 'string');

    const body2 = { video: before.video, approved: false, cues: before.cues, feedback: { c01: 'cue edited', 'gap-00:20.0': 'gap edited' } };
    res = await fetch(`http://localhost:${port}/save`, { method: 'POST', body: JSON.stringify(body2) });
    assert.equal((await res.json()).ok, true);

    fb = JSON.parse(fs.readFileSync(path.join(workdir, 'feedback.json'), 'utf8'));
    assert.equal(fb.items.c01.text, 'cue edited');
    assert.equal(fb.items.c01.context.card, 'pros-cons/pros-cons', 'c01 context lost on edit');
    assert.equal(fb.items['gap-00:20.0'].text, 'gap edited');
    assert.equal(fb.items['gap-00:20.0'].context.start, 20, 'gap context lost on edit');
  } finally {
    server.close();
  }
});

test('mergeShots: staleness cascade and order-insensitive comparison', () => {
  const spansA = [{ id: 's1', anchor: 'hello' }];
  const spansA_reordered = [{ anchor: 'hello', id: 's1' }];
  const spansB = [{ id: 's1', anchor: 'world' }];

  const base = { approved: true, engineMode: 'test', spans: spansA };
  
  const resA = mergeShots(base, spansB);
  assert.equal(resA.merged.approved, false);
  
  const resB = mergeShots(base, spansA_reordered);
  assert.equal(resB.merged.approved, true);

  const resC = mergeShots({ ...base, approved: false }, spansB);
  assert.equal(resC.merged.approved, false);
});

test('loadShots: parses, handles missing/corrupt, resolves spans', () => {
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'board-loadshots-'));
  const words = [
    { start: 0, end: 1, text: 'one' }, { start: 1, end: 2, text: 'two' }, { start: 2, end: 3, text: 'three' },
    { start: 3, end: 4, text: 'four' }, { start: 4, end: 5, text: 'five' }, { start: 5, end: 6, text: 'six' }
  ];
  
  assert.equal(loadShots(dir, words), null);

  fs.writeFileSync(path.join(dir, 'shots.json'), JSON.stringify({ engineMode: 'test', spans: [{ id: 's1', from_anchor: 'one two three', to_anchor: 'four five six', kind: 'avatar-full', mode: 'full' }] }));
  const loaded = loadShots(dir, words);
  assert.equal(loaded.spans.length, 1);
  assert.equal(loaded.spans[0].start, 0);

  fs.writeFileSync(path.join(dir, 'shots.json'), 'invalid json');
  const corrupt = loadShots(dir, words);
  assert.equal(corrupt.spans.length, 0);
  assert.match(corrupt.errors[0], /unreadable/i);
});

test('renderBoardPage: no-shots vs shots layout', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/list`);
    const html = await res.text();
    assert.ok(!html.includes('class="minimap minimap-shots"'), 'no shot lane when shots=null');
    assert.ok(!html.includes('class="timeline-block shot-block"'), 'no shot block when shots=null');
    assert.ok(!html.includes('id="approveShotsBtn"'), 'no button when shots=null');
  } finally {
    server.close();
  }

  fs.writeFileSync(path.join(workdir, 'shots.json'), JSON.stringify({
    engineMode: 'test',
    spans: [
      { id: 's01', from_anchor: "let's look at", to_anchor: "pros and cons", kind: 'avatar-full', mode: 'full' },
      { id: 's02', from_anchor: "great support team", to_anchor: "tip in mind", kind: 'avatar-full', mode: 'panel' }
    ]
  }));
  const { server: s2, base: b2 } = await startServer(workdir);
  try {
    const res = await fetch(`${b2}/list`);
    const html = await res.text();
    assert.ok(html.includes('class="minimap minimap-shots"'), 'has shot lane');
    assert.ok(html.includes('engineMode: test'), 'has chip');
    
    const blocks = html.match(/class="[^"]*shot-block[^"]*"/g);
    assert.ok(blocks && blocks.length === 2, 'has two shot blocks');
    assert.match(html, /in-shot/, 'has tint');
    assert.match(html, /s01<\/b>\s*\[A\]/, 's01 is labeled [A]');
    assert.match(html, /s02<\/b>\s*\[P\]/, 's02 is labeled [P]');
  } finally {
    s2.close();
  }
});

test('renderBoardPage: a side span is labeled [S], distinct from a full [A]', async () => {
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'board-side-'));
  fs.writeFileSync(path.join(dir, 'cues.json'), JSON.stringify({ video: 'side-fixture', approved: false, cues: [] }));
  fs.writeFileSync(path.join(dir, 'resolved.json'), JSON.stringify({ video: 'side-fixture', resolved: [] }));
  fs.writeFileSync(path.join(dir, 'transcript.json'), JSON.stringify([
    { text: "let's", start: 0.0, end: 0.3 },
    { text: 'look', start: 0.5, end: 0.8 },
    { text: 'at', start: 1.0, end: 1.2 },
    { text: 'this', start: 1.5, end: 1.7 },
    { text: 'chart', start: 2.0, end: 2.3 },
    { text: 'now', start: 2.5, end: 2.7 },
  ]));
  fs.copyFileSync(path.join(FIXTURE_DIR, 'vo.mp3'), path.join(dir, 'vo.mp3'));
  fs.writeFileSync(path.join(dir, 'shots.json'), JSON.stringify({
    engineMode: 'test',
    spans: [
      { id: 's01', from_anchor: "let's look at", to_anchor: "this chart now", kind: 'avatar-full', mode: 'full' },
    ]
  }));
  const { server, base } = await startServer(dir);
  try {
    const res = await fetch(`${base}/list`);
    const html = await res.text();
    assert.match(html, /s01<\/b>\s*\[A\]/, 's01 (mode full) is labeled [A]');
  } finally {
    server.close();
  }

  fs.writeFileSync(path.join(dir, 'shots.json'), JSON.stringify({
    engineMode: 'test',
    spans: [
      { id: 's01', from_anchor: "let's look at", to_anchor: "this chart now", kind: 'avatar-full', mode: 'side' },
    ]
  }));
  const { server: s2, base: b2 } = await startServer(dir);
  try {
    const res = await fetch(`${b2}/list`);
    const html = await res.text();
    assert.match(html, /s01<\/b>\s*\[S\]/, 's01 (mode side) is labeled [S]');
  } finally {
    s2.close();
  }
});

test('save: cue change with approved shots un-approves shots and warns', async () => {
  const workdir = makeWorkdir();
  fs.writeFileSync(path.join(workdir, 'shots.json'), JSON.stringify({
    approved: true,
    engineMode: 'test',
    spans: [{ id: 's01', from_anchor: "let's look at", to_anchor: "pros and cons", kind: 'avatar-full', mode: 'full' }]
  }));
  const { server, base } = await startServer(workdir);
  try {
    const cuesFile = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    
    // valid change
    cuesFile.cues[0].hold = 99;
    
    const res2 = await fetch(`${base}/save`, { method: 'POST', body: JSON.stringify(cuesFile) });
    const data2 = await res2.json();
    assert.equal(data2.ok, true);
    assert.ok(data2.warnings.some(w => w.includes('cues changed after shot approval')), 'warning emitted');
    
    const diskShots = JSON.parse(fs.readFileSync(path.join(workdir, 'shots.json'), 'utf8'));
    assert.equal(diskShots.approved, false, 'cascade persisted');
  } finally {
    server.close();
  }
});

test('POST /save rejects non-localhost origin with 403', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/save`, { 
      method: 'POST', 
      headers: { 'Origin': 'http://evil.example' },
      body: '{}' 
    });
    assert.equal(res.status, 403);
    assert.equal(await res.text(), 'forbidden origin');
  } finally {
    server.close();
  }
});

test('POST /save allows 127.0.0.1 origin', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const cuesFile = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    const port = new URL(base).port;
    const res = await fetch(`${base}/save`, { 
      method: 'POST', 
      headers: { 'Origin': `http://127.0.0.1:${port}` },
      body: JSON.stringify(cuesFile) 
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
  } finally {
    server.close();
  }
});

test('GET / without effects.json renders no effects lane', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/`);
    const html = await res.text();
    assert.ok(!html.includes('minimap minimap-fx'), 'no effects lane');
    assert.ok(!html.includes('Approve effects'), 'no approve effects button');
  } finally {
    server.close();
  }
});

test('GET /list with effects.json renders lane, chips, approve button, sim stage', async () => {
  const workdir = makeWorkdir(true);
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/list`);
    const html = await res.text();
    assert.ok(html.includes('minimap-fx'), 'lane present');
    assert.ok(html.includes('fx-chip'), 'chips present');
    assert.ok(html.includes('fxStage'), 'sim stage present');
    assert.ok(html.includes('timing preview'), 'preview note present');
    assert.ok(html.includes('capChunks') || html.includes('Great support'), 'caption data present');
  } finally {
    server.close();
  }
});

test('POST /save with an effects toggle writes enabled and resets approval', async () => {
  const workdir = makeWorkdir(true);
  const effectsPath = path.join(workdir, 'effects.json');
  const fxFile = JSON.parse(fs.readFileSync(effectsPath, 'utf8'));
  fxFile.approved = true;
  fs.writeFileSync(effectsPath, JSON.stringify(fxFile));
  const { server, base } = await startServer(workdir);
  try {
    const cuesFile = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    cuesFile.effects = [{ id: 'whip-5.0', enabled: false }];
    const res = await fetch(`${base}/save`, { method: 'POST', body: JSON.stringify(cuesFile) });
    const data = await res.json();
    assert.ok(data.warnings.some(w => w.includes('effects: un-approved')), 'warning emitted');
    const onDisk = JSON.parse(fs.readFileSync(effectsPath, 'utf8'));
    assert.equal(onDisk.instances.find(i => i.id === 'whip-5.0').enabled, false);
    assert.equal(onDisk.approved, false);
  } finally {
    server.close();
  }
});

test('POST /save with unchanged toggles preserves approval', async () => {
  const workdir = makeWorkdir(true);
  const effectsPath = path.join(workdir, 'effects.json');
  const fxFile = JSON.parse(fs.readFileSync(effectsPath, 'utf8'));
  fxFile.approved = true;
  fs.writeFileSync(effectsPath, JSON.stringify(fxFile));
  const { server, base } = await startServer(workdir);
  try {
    const cuesFile = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    cuesFile.effects = fxFile.instances.map(i => ({ id: i.id, enabled: i.enabled }));
    const res = await fetch(`${base}/save`, { method: 'POST', body: JSON.stringify(cuesFile) });
    const data = await res.json();
    assert.ok(!data.warnings?.some(w => w.includes('effects: un-approved')), 'no warning');
    const onDisk = JSON.parse(fs.readFileSync(effectsPath, 'utf8'));
    assert.equal(onDisk.approved, true);
  } finally {
    server.close();
  }
});

test('POST /approve-effects sets approved', async () => {
  const workdir = makeWorkdir(true);
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/approve-effects`, { method: 'POST' });
    const data = await res.json();
    assert.deepEqual(data, { ok: true });
    const onDisk = JSON.parse(fs.readFileSync(path.join(workdir, 'effects.json'), 'utf8'));
    assert.equal(onDisk.approved, true);
    
    const pageRes = await fetch(`${base}/`);
    const html = await pageRes.text();
    assert.ok(html.includes('effects approved — ready for step 090 assemble'));
  } finally {
    server.close();
  }
});

test('mergeEffects only applies enabled', () => {
  const prev = { instances: [{ id: 'b1', punch: 1.05, enabled: true }] };
  const toggles = [{ id: 'b1', enabled: false, punch: 99 }];
  const { merged } = mergeEffects(prev, toggles);
  assert.equal(merged.instances[0].enabled, false);
  assert.equal(merged.instances[0].punch, 1.05);
});

test('toggleAuditAccepted: accepts a verdict, un-accepting drops the field, unknown id is a no-op', () => {
  const audit = { cues: { c01: { verdict: 'labelled', fix: 'wrong card' }, c02: { verdict: 'ok' } } };

  const accepted = toggleAuditAccepted(audit, 'c01', true);
  assert.equal(accepted.cues.c01.accepted, true);
  assert.equal(accepted.cues.c01.verdict, 'labelled');
  assert.equal(accepted.cues.c02.accepted, undefined);

  const unaccepted = toggleAuditAccepted(accepted, 'c01', false);
  assert.ok(!('accepted' in unaccepted.cues.c01));

  const noop = toggleAuditAccepted(audit, 'nope', true);
  assert.ok(!('nope' in noop.cues));
});

test('fxContext / fxEventsAt helpers', () => {
  const fullframes = [{ id: 'f1', start: 10, end: 15 }];
  const spans = [{ id: 's1', start: 5, end: 12 }];

  assert.equal(fxContext(8, fullframes, spans), 'avatar');
  assert.equal(fxContext(11, fullframes, spans), 'graphic');
  assert.equal(fxContext(2, fullframes, spans), 'screen');

  const instances = [
    { type: 'whip', at: 5, enabled: true },
    { type: 'whip', at: 8, enabled: false }
  ];

  const ev1 = fxEventsAt(4, 5, instances);
  assert.equal(ev1.length, 1);
  assert.equal(ev1[0].at, 5);

  const ev2 = fxEventsAt(5, 6, instances);
  assert.equal(ev2.length, 0);
});

test('effects-plan approved carry', () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'board-fxplan-'));
  const boardDir = makeWorkdir(false);
  fs.copyFileSync(path.join(boardDir, 'resolved.json'), path.join(dir, 'resolved.json'));
  fs.copyFileSync(path.join(boardDir, 'transcript.json'), path.join(dir, 'transcript.json'));
  fs.copyFileSync(path.join(boardDir, 'vo.mp3'), path.join(dir, 'vo.mp3'));
  
  const fxPlanPath = path.resolve(import.meta.dirname, 'effects-plan.mjs');
  
  spawnSync('node', [fxPlanPath, dir]);
  let onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'effects.json'), 'utf8'));
  assert.equal(onDisk.approved, true);
  
  onDisk.instances[0].enabled = false;
  fs.writeFileSync(path.join(dir, 'effects.json'), JSON.stringify(onDisk));
  spawnSync('node', [fxPlanPath, dir]);
  onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'effects.json'), 'utf8'));
  assert.equal(onDisk.approved, true, 'approved is always true');
  assert.equal(onDisk.instances[0].enabled, false, 'enabled overrides survive');
});

test('GET /vo.mp3 serves audio', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/vo.mp3`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'audio/mpeg');
    const buf = Buffer.from(await res.arrayBuffer());
    assert.ok(buf.length > 0);
  } finally {
    server.close();
  }
});

test('appendFinalFeedback key naming and shape, folded preserved', () => {
  const fb = { items: { 'c01': { text: 'old', folded: '2026-01-01' } } };
  
  const f2 = appendFinalFeedback(fb, 'v2', { text: 'my feedback', context: 'final@00:01.2', t: 1.2, x: 50, y: 50 });
  assert.equal(f2.items['c01'].folded, '2026-01-01');
  assert.ok(f2.items['final-v2:0'], 'starts at :0');
  assert.equal(f2.items['final-v2:0'].text, 'my feedback');
  assert.equal(f2.items['final-v2:0'].t, 1.2);
  
  const f3 = appendFinalFeedback(f2, 'v2', { text: 'more feedback' });
  assert.ok(f3.items['final-v2:1'], 'increments to :1');
  assert.equal(f3.items['final-v2:1'].text, 'more feedback');
});

test('pinFromClick percentage math bounds', () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };
  
  const p1 = pinFromClick(200, 100, rect);
  assert.equal(p1.x, 50);
  assert.equal(p1.y, 50);
  
  const p2 = pinFromClick(50, 20, rect); // out of bounds left/top
  assert.equal(p2.x, 0);
  assert.equal(p2.y, 0);
  
  const p3 = pinFromClick(400, 300, rect); // out of bounds right/bottom
  assert.equal(p3.x, 100);
  assert.equal(p3.y, 100);
});

// ---- 037 card plan gate ----

function makeCardPlanWorkdir() {
  const dir = makeWorkdir();
  fs.writeFileSync(
    path.join(dir, 'card-plan.json'),
    JSON.stringify({
      video: 'fixture',
      approved: false,
      sections: [
        {
          part: 'intro',
          start: 0,
          end: 10,
          items: [{
            id: 'z01', card: 'title/title-versus', status: 'existing',
            placement: 'fullframe', anchor: 'welcome back everyone',
            flagged: false, proposal: null,
          }],
        },
        {
          part: 'body',
          items: [{
            id: 'c99', card: 'race/cost-race', status: 'new',
            placement: 'fullframe', anchor: 'it really adds up',
            flagged: false,
            proposal: { does: 'bars race as the monthly cost climbs', kind: 'beat', beats: 3, variables: ['title'] },
          }],
        },
      ],
    }),
  );
  return dir;
}

test('Card Plan tab renders NEW chips, the proposal spec, and a note box per card', async () => {
  const { server, base } = await startServer(makeCardPlanWorkdir());
  try {
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, /tab-card-plan/);
    assert.match(html, />Card Plan</);
    // The chip that was dead before 2026-07-30: the old plan read resolved.json,
    // where a not-yet-built card can never appear.
    assert.match(html, /NEW &mdash; to build/);
    assert.match(html, /bars race as the monthly cost climbs/);
    assert.match(html, /kind: beat/);
    // anchors, not timecodes — this gate runs before resolve
    assert.match(html, /welcome back everyone/);
    // one note box per card (2) plus one per section (2)
    assert.equal((html.match(/class="plan-note"/g) ?? []).length, 4);
    // routing is visible to the owner in the placeholder text
    assert.match(html, /folds into the intro\/outro rulebook \(035\)/);
    assert.match(html, /folds into the body rulebook \(030\)/);
  } finally {
    server.close();
  }
});

test('POST /card-feedback keys body and zone notes into different spaces', async () => {
  // The key prefix is what routes the lesson at 130 — a body note that landed
  // in the zone key space would edit the wrong rulebook.
  const dir = makeCardPlanWorkdir();
  const { server, base } = await startServer(dir);
  try {
    const post = (body) => fetch(`${base}/card-feedback`, { method: 'POST', body: JSON.stringify(body) });

    assert.equal((await post({ part: 'body', cue: 'c99', card: 'race/cost-race', text: 'do not build this' })).status, 200);
    assert.equal((await post({ part: 'intro', text: 'opens flat' })).status, 200);
    assert.equal((await post({ part: 'outro', text: 'x' })).status, 400, 'unknown part must be rejected');
    assert.equal((await post({ part: 'body', text: '   ' })).status, 400, 'empty text must be rejected');

    const fb = JSON.parse(fs.readFileSync(path.join(dir, 'feedback.json'), 'utf8'));
    assert.deepEqual(Object.keys(fb.items).sort(), ['card-body:1', 'zone-intro:1']);
    assert.equal(fb.items['card-body:1'].context.cue, 'c99');
    assert.equal(fb.items['zone-intro:1'].zone, 'intro');
  } finally {
    server.close();
  }
});

test('POST /approve-card-plan flips approved and the banner names the next step', async () => {
  const dir = makeCardPlanWorkdir();
  const { server, base } = await startServer(dir);
  try {
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'card-plan.json'), 'utf8')).approved, false);
    assert.equal((await fetch(`${base}/approve-card-plan`, { method: 'POST' })).status, 200);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'card-plan.json'), 'utf8')).approved, true);

    // With a NEW card still unbuilt, the banner must point at 038, not at resolve.
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, /build the NEW cards \(step 038\)/);
  } finally {
    server.close();
  }
});

// ---- Run tab -------------------------------------------------------------
// The Run tab is the page a non-technical person opens instead of reading the
// terminal, so these check the two things that would make it lie: answering for
// a workdir it was not asked about, and showing a step as done with no record.

test('GET /run-log answers for the board\'s own workdir, even outside videos/', async () => {
  // The test workdirs live under lib/.test-tmp, not videos/. A slug-based
  // lookup would 404 here — and so would any board started on an external path.
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/run-log`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.steps.length >= 15, true, 'every step folder should appear');
    assert.equal(data.video, path.basename(workdir));
    assert.ok(data.summary);
  } finally {
    server.close();
  }
});

test('GET /run-log marks an inferred step and never invents a summary for it', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const data = await (await fetch(`${base}/run-log`)).json();
    const resolved = data.steps.find((s) => s.number === '040');
    assert.equal(resolved.status, 'done', 'resolved.json is staged by the fixture');
    assert.equal(resolved.derived, true);
    assert.equal(resolved.did, undefined, 'nothing was recorded, so nothing may be shown');
  } finally {
    server.close();
  }
});

test('GET /run-log prefers a recorded entry over the artifact probe', async () => {
  const workdir = makeWorkdir();
  fs.writeFileSync(
    path.join(workdir, 'run-log.json'),
    JSON.stringify({
      video: 'x',
      steps: { '040-sync-graphics-run': { status: 'blocked', issues: 'anchor c07 not found' } },
    }),
  );
  const { server, base } = await startServer(workdir);
  try {
    const data = await (await fetch(`${base}/run-log`)).json();
    const s = data.steps.find((v) => v.number === '040');
    assert.equal(s.status, 'blocked');
    assert.equal(s.issues, 'anchor c07 not found');
    assert.ok(!s.derived);
    assert.equal(data.summary.blocked, 1);
  } finally {
    server.close();
  }
});

test('GET /run-log refuses a video slug that escapes videos/', async () => {
  const { server, base } = await startServer(makeWorkdir());
  try {
    for (const bad of ['../../etc', '../..', 'nope']) {
      const res = await fetch(`${base}/run-log?video=${encodeURIComponent(bad)}`);
      assert.equal(res.status, 404, `${bad} must not resolve`);
    }
  } finally {
    server.close();
  }
});

test('GET /run-videos lists the real videos plus the current one', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const data = await (await fetch(`${base}/run-videos`)).json();
    assert.equal(data.current, path.basename(workdir));
    assert.ok(Array.isArray(data.videos));
    assert.deepEqual([...data.videos].sort(), data.videos, 'listed in a stable order');
  } finally {
    server.close();
  }
});

test('the board page ships the Run tab and lands on it', async () => {
  const { server, base } = await startServer(makeWorkdir());
  try {
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, /id="tab-run"/);
    assert.match(html, /id="runVideoPicker"/);
    // No hash means Run; storyboard got its own explicit hash.
    assert.match(html, /HASH_TAB\[location\.hash\] \|\| 'tab-run'/);
    assert.match(html, /'#storyboard': 'tab-storyboard'/);
  } finally {
    server.close();
  }
});

test('approving a gate records it in the ledger, with a real timestamp', async () => {
  // The board writes this itself rather than asking a session to remember —
  // a status kept by a second hand drifts from the thing it describes.
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const before = await (await fetch(`${base}/run-log`)).json();
    assert.equal(before.steps.find((s) => s.number === '080').status, 'todo');

    const res = await fetch(`${base}/approve`, { method: 'POST' });
    assert.equal(res.status, 200);

    // This fixture has no shots.json, so graphics alone completes the gate.
    const after = await (await fetch(`${base}/run-log`)).json();
    const gate = after.steps.find((s) => s.number === '080');
    assert.equal(gate.status, 'done');
    assert.ok(!gate.derived, 'now a real record, not an inference');
    assert.match(gate.did, /Owner approved the storyboard/);
    assert.match(gate.output, /cues\.json approved=true/);
    assert.ok(Date.parse(gate.ended) > 0, 'must carry when it was approved');
    assert.equal(gate.issues, 'none found');
  } finally {
    server.close();
  }
});

test('a broken ledger cannot block an approval', async () => {
  const workdir = makeWorkdir();
  fs.writeFileSync(path.join(workdir, 'run-log.json'), '{not json');
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/approve`, { method: 'POST' });
    assert.equal(res.status, 200, 'the approval itself must still land');
    const cues = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    assert.equal(cues.approved, true);
  } finally {
    server.close();
  }
});

test('gate 080 stays running until BOTH halves are approved', async () => {
  // Two clicks, one gate. Calling it done after the first would report a gate
  // passed that the owner is still halfway through.
  const workdir = makeWorkdir();
  fs.writeFileSync(
    path.join(workdir, 'shots.json'),
    JSON.stringify({ video: 'x', approved: false, shots: [] }),
  );
  const { server, base } = await startServer(workdir);
  try {
    await fetch(`${base}/approve`, { method: 'POST' });
    let gate = (await (await fetch(`${base}/run-log`)).json()).steps.find((s) => s.number === '080');
    assert.equal(gate.status, 'running', 'graphics approved, shots not');
    assert.match(gate.issues, /waiting on the owner to approve the avatar shots/);

    await fetch(`${base}/approve-shots`, { method: 'POST' });
    gate = (await (await fetch(`${base}/run-log`)).json()).steps.find((s) => s.number === '080');
    assert.equal(gate.status, 'done');
    assert.match(gate.did, /graphics and avatar shots/);
  } finally {
    server.close();
  }
});

// ---- no-arg mode (the local-apps dashboard) -------------------------------

test('latestWorkdir skips a video that is not board-ready yet', () => {
  // A fresh video gets cues.json long before resolved.json. Sorting on
  // cues.json alone made the newest, least-ready video win and then throw,
  // which is how the dashboard entry broke the moment a new video was started.
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const videos = fs.mkdtempSync(path.join(TMP_ROOT, 'videos-'));

  const ready = path.join(videos, 'finished');
  fs.mkdirSync(ready);
  for (const f of ['cues.json', 'resolved.json', 'vo.mp3']) {
    fs.copyFileSync(path.join(FIXTURE_DIR, f), path.join(ready, f));
  }

  const inFlight = path.join(videos, 'in-flight');
  fs.mkdirSync(inFlight);
  fs.copyFileSync(path.join(FIXTURE_DIR, 'cues.json'), path.join(inFlight, 'cues.json'));
  // newer than the finished one, so it wins on mtime and must still be skipped
  const later = new Date(Date.now() + 60_000);
  fs.utimesSync(path.join(inFlight, 'cues.json'), later, later);

  assert.equal(latestWorkdir(videos), ready);
});

test('latestWorkdir returns null when nothing is bootable, rather than a workdir that throws', () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const videos = fs.mkdtempSync(path.join(TMP_ROOT, 'videos-none-'));
  const d = path.join(videos, 'just-started');
  fs.mkdirSync(d);
  fs.copyFileSync(path.join(FIXTURE_DIR, 'cues.json'), path.join(d, 'cues.json'));

  assert.equal(latestWorkdir(videos), null, 'no vo.mp3, so the board cannot serve it');
  assert.throws(() => createServer(d), /missing vo\.mp3/);
});

test('the board opens a video that has not reached step 040 yet', () => {
  // The 037 gate is reviewed ON this board. Requiring resolved.json to boot
  // made that gate unreachable: 040 writes resolved.json, but it refuses any
  // cue naming a card that only 038 builds AFTER 037 approves it.
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'pre-040-'));
  for (const f of ['cues.json', 'transcript.json', 'vo.mp3']) {
    fs.copyFileSync(path.join(FIXTURE_DIR, f), path.join(dir, f));
  }
  assert.ok(!fs.existsSync(path.join(dir, 'resolved.json')));
  assert.doesNotThrow(() => createServer(dir), 'Gate 1 must be reachable before 040');
});

test('a pre-040 board serves the Card Plan gate but will not let you approve an empty storyboard', async () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'pre-040-serve-'));
  for (const f of ['cues.json', 'transcript.json', 'vo.mp3']) {
    fs.copyFileSync(path.join(FIXTURE_DIR, f), path.join(dir, f));
  }
  fs.writeFileSync(
    path.join(dir, 'card-plan.json'),
    JSON.stringify({
      video: 'x',
      approved: false,
      sections: [{ part: 'body', items: [{ id: 'c01', card: 'race/cost-race', status: 'new', proposal: { does: 'bars race' } }] }],
    }),
  );
  const { server, base } = await startServer(dir);
  try {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /id="tab-card-plan"/, 'the gate must render');
    assert.match(html, /NEW/, 'the unbuilt card must be visible — that is the point of the gate');
    // and the storyboard must not offer to approve cues that do not exist yet
    assert.match(html, /id="approveBtn" disabled/);
    assert.match(html, /no <code>resolved\.json<\/code> yet/);
  } finally {
    server.close();
  }
});

test('the card plan spec line is not double-escaped', async () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'spec-esc-'));
  for (const f of ['cues.json', 'resolved.json', 'transcript.json', 'vo.mp3']) {
    fs.copyFileSync(path.join(FIXTURE_DIR, f), path.join(dir, f));
  }
  fs.writeFileSync(
    path.join(dir, 'card-plan.json'),
    JSON.stringify({
      video: 'x',
      approved: false,
      sections: [{ part: 'body', items: [{ id: 'c01', card: 'race/cost-race', status: 'new',
        proposal: { does: 'bars race as cost climbs', kind: 'beat', beats: 3, placement: 'fullframe' } }] }],
    }),
  );
  const { server, base } = await startServer(dir);
  try {
    const html = await (await fetch(`${base}/`)).text();
    // joining the entity BEFORE escaping turned "&" into "&amp;", so the
    // separator rendered as the literal text "&middot;" on the page
    assert.doesNotMatch(html, /&amp;middot;/, 'the separator must render as a dot, not as text');
    assert.match(html, /3 beats/);
  } finally {
    server.close();
  }
});

test('latestWorkdir handles an empty or absent videos dir', () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const empty = fs.mkdtempSync(path.join(TMP_ROOT, 'videos-empty-'));
  assert.equal(latestWorkdir(empty), null);
  assert.equal(latestWorkdir(path.join(empty, 'nope')), null);
});

test('the Run tab ships one status emoji per state, right-aligned', async () => {
  const { server, base } = await startServer(makeWorkdir());
  try {
    const html = await (await fetch(`${base}/`)).text();
    for (const [status, emoji] of [
      ['done', '✅'], ['running', '🔄'], ['blocked', '❌'], ['skipped', '⏭️'], ['todo', '⚪'],
    ]) {
      assert.ok(html.includes(emoji), `${status} needs its emoji`);
    }
    // margin-left:auto is what pushes the mark into its own right-hand column
    assert.match(html, /\.run-mark \{[^}]*margin-left:auto/);
    // running spins, so "in progress" reads as motion rather than a static icon
    assert.match(html, /\.run-mark\.spin \{[^}]*animation:run-spin/);
    // an unstarted row must dim its text WITHOUT dimming the emoji column
    assert.doesNotMatch(html, /\.run-row\.is-todo \{[^}]*opacity/);
  } finally {
    server.close();
  }
});

test('the page title names the video, so two boards are distinguishable', async () => {
  // Two sessions running in parallel land on different ports (4322, 4323...).
  // With a generic title, both browser tabs read the same and it is easy to
  // review the wrong video — reported from a live parallel run, 2026-07-30.
  const { server, base } = await startServer(makeWorkdir());
  try {
    for (const p of ['/', '/list']) {
      const html = await (await fetch(`${base}${p}`)).text();
      const title = html.match(/<title>([^<]*)<\/title>/)[1];
      assert.match(title, /visuals-flow board/);
      assert.doesNotMatch(title, /^Graphics storyboard timeline$/, `${p} must name the video`);
    }
  } finally {
    server.close();
  }
});

// ---- screenshot attachment on storyboard feedback -------------------------
// Final Cut took images; the storyboard boxes did not, so "this card is wrong"
// arrived with no picture of what was wrong (owner, 2026-07-30).

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function saveFb(base, cues, feedback, feedbackImages) {
  const body = { video: 'x', approved: false, cues, feedback };
  if (feedbackImages !== undefined) body.feedbackImages = feedbackImages;
  return fetch(`${base}/save`, { method: 'POST', body: JSON.stringify(body) });
}

test('a storyboard comment can carry a screenshot, and it serves back', async () => {
  const workdir = makeWorkdir();
  const cues = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8')).cues;
  const { server, base } = await startServer(workdir);
  try {
    const res = await saveFb(base, cues, { c01: 'wrong card here' }, { c01: PNG_1PX });
    assert.equal((await res.json()).ok, true);

    const fb = JSON.parse(fs.readFileSync(path.join(workdir, 'feedback.json'), 'utf8'));
    assert.equal(fb.items.c01.image, 'feedback-images/c01.png');
    assert.equal(fb.items.c01.text, 'wrong card here');
    assert.ok(fs.existsSync(path.join(workdir, fb.items.c01.image)));

    const img = await fetch(`${base}/feedback-image/c01`);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/png');
  } finally {
    server.close();
  }
});

test('a screenshot attaches to a comment whose text did NOT change', async () => {
  // The common case: you write the comment, then go take the screenshot. The
  // text loop only fires on a text change, so attaching had to live outside it.
  const workdir = makeWorkdir();
  const cues = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8')).cues;
  const { server, base } = await startServer(workdir);
  try {
    await saveFb(base, cues, { c02: 'this one too' });
    await saveFb(base, cues, { c02: 'this one too' }, { c02: PNG_1PX });
    const fb = JSON.parse(fs.readFileSync(path.join(workdir, 'feedback.json'), 'utf8'));
    assert.equal(fb.items.c02.image, 'feedback-images/c02.png');
    assert.equal(fb.items.c02.text, 'this one too', 'the text must survive untouched');
  } finally {
    server.close();
  }
});

test('clearing or deleting a comment takes its screenshot off disk', async () => {
  const workdir = makeWorkdir();
  const cues = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8')).cues;
  const { server, base } = await startServer(workdir);
  try {
    await saveFb(base, cues, { c01: 'a', c02: 'b' }, { c01: PNG_1PX, c02: PNG_1PX });
    assert.ok(fs.existsSync(path.join(workdir, 'feedback-images', 'c01.png')));

    // explicit clear
    await saveFb(base, cues, { c01: 'a', c02: 'b' }, { c02: null });
    let fb = JSON.parse(fs.readFileSync(path.join(workdir, 'feedback.json'), 'utf8'));
    assert.equal(fb.items.c02.image, undefined);
    assert.ok(!fs.existsSync(path.join(workdir, 'feedback-images', 'c02.png')));

    // deleting the comment entirely
    await saveFb(base, cues, { c01: '', c02: 'b' });
    fb = JSON.parse(fs.readFileSync(path.join(workdir, 'feedback.json'), 'utf8'));
    assert.equal(fb.items.c01, undefined);
    assert.ok(!fs.existsSync(path.join(workdir, 'feedback-images', 'c01.png')), 'no orphaned images');
  } finally {
    server.close();
  }
});

test('a non-image payload is refused rather than written to disk', async () => {
  const workdir = makeWorkdir();
  const cues = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8')).cues;
  const { server, base } = await startServer(workdir);
  try {
    for (const junk of ['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', '../../etc/passwd']) {
      await saveFb(base, cues, { c03: 'x' }, { c03: junk });
      const fb = JSON.parse(fs.readFileSync(path.join(workdir, 'feedback.json'), 'utf8'));
      assert.equal(fb.items.c03.image, undefined, `must reject ${junk}`);
    }
  } finally {
    server.close();
  }
});

test('a folded comment cannot have a screenshot attached', async () => {
  // Folded items are read-only history everywhere else; the image path must
  // not be a back door into them.
  const workdir = makeWorkdir();
  const cues = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8')).cues;
  fs.writeFileSync(
    path.join(workdir, 'feedback.json'),
    JSON.stringify({ video: 'x', items: { c01: { text: 'old', folded: '2026-07-01' } } }),
  );
  const { server, base } = await startServer(workdir);
  try {
    await saveFb(base, cues, { c01: 'old' }, { c01: PNG_1PX });
    const fb = JSON.parse(fs.readFileSync(path.join(workdir, 'feedback.json'), 'utf8'));
    assert.equal(fb.items.c01.image, undefined);
    assert.equal(fb.items.c01.folded, '2026-07-01');
  } finally {
    server.close();
  }
});

test('every feedback box ships the attach control', async () => {
  const { server, base } = await startServer(makeWorkdir());
  try {
    for (const p of ['/', '/list']) {
      const html = await (await fetch(`${base}${p}`)).text();
      assert.match(html, /class="fb-attach"/, `${p} needs the attach button`);
      assert.match(html, /class="fb-file"/);
      // paste is the way you actually attach a screenshot you just took
      assert.match(html, /textarea\.feedback/);
      assert.match(html, /clipboardData/);
      // and it must live in the same block as the save collector, or
      // FB_IMAGES is undefined at save time
      assert.match(html, /payload\.feedbackImages = FB_IMAGES/);
      assert.match(html, /var FB_IMAGES = \{\}/);
    }
  } finally {
    server.close();
  }
});

test('all three feedback views ship the SAME attach control', async () => {
  // fbBox is defined three times (timeline, list, card plan). An edit applied
  // to one copy leaves the other two behind — caught exactly that way.
  const { server, base } = await startServer(makeWorkdir());
  try {
    for (const p of ['/', '/list']) {
      const html = await (await fetch(`${base}${p}`)).text();
      const titles = new Set([...html.matchAll(/class="fb-attach" title="([^"]*)"/g)].map((m) => m[1]));
      assert.equal(titles.size, 1, `${p} has drifted copies: ${[...titles].join(' | ')}`);
      assert.match([...titles][0], /paste one into the box/);
      const attach = (html.match(/class="fb-attach"/g) || []).length;
      const boxes = (html.match(/textarea class="feedback"/g) || []).length;
      assert.equal(attach, boxes, `${p}: every feedback box needs exactly one attach control`);
    }
  } finally {
    server.close();
  }
});

// ---- reviewed / collapse --------------------------------------------------
test('every graphic and card-plan row ships a reviewed tick', async () => {
  const workdir = makeWorkdir();
  fs.writeFileSync(path.join(workdir, 'card-plan.json'), JSON.stringify({
    video: 'x', approved: false,
    sections: [{ part: 'body', items: [{ id: 'c01', card: 'a/b', status: 'existing' }] }],
  }));
  const { server, base } = await startServer(workdir);
  try {
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, /data-rid="sb:c01"/, 'storyboard tile needs a review id');
    assert.match(html, /data-rid="cp:c01"/, 'card plan row needs its own review id');
    assert.equal(
      (html.match(/class="rev-input"/g) || []).length,
      (html.match(/class="reviewable"|reviewable /g) || []).length,
      'one tick per reviewable block',
    );
    // state is a view preference, never cue data — writing it to cues.json
    // would un-approve the video on the next save
    assert.match(html, /board:reviewed:/);
    assert.doesNotMatch(html, /feedback\[t\.dataset\.ref\] = t\.value; feedback\.reviewed/);
    // collapsing must drop the live card iframe, not just hide it
    assert.match(html, /f\.dataset\.revSrc = f\.src/);
    assert.match(html, /revAll\(true\)/);
  } finally {
    server.close();
  }
});

// ---- global video picker --------------------------------------------------
test('?video= switches the WHOLE board, not just the Run tab', async () => {
  // The board used to be pinned to its launch workdir, so switching meant
  // restarting the server (owner hit this on a 19h-old process, 2026-07-30).
  const launch = makeWorkdir();
  const { server, base } = await startServer(launch);
  try {
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, /id="videoPicker"/, 'the picker must be on the storyboard, not only Run');
    assert.match(html, /\?video=' \+ encodeURIComponent/);
    assert.match(html, /location\.hash/, 'switching must keep the tab you were on');
    assert.match(html, /unsaved feedback/, 'must not silently drop unsaved work');
  } finally {
    server.close();
  }
});

test('requestedWorkdir only accepts a bootable video under videos/', async () => {
  const { requestedWorkdir } = await import('./board.mjs');
  const launch = makeWorkdir();
  const u = (q) => new URL(`http://x/${q}`);
  assert.equal(requestedWorkdir(u(''), launch), launch, 'no param keeps the launch video');
  for (const bad of ['../../etc', 'does-not-exist', '']) {
    assert.equal(
      requestedWorkdir(u(`?video=${encodeURIComponent(bad)}`), launch), launch,
      `"${bad}" must fall back, never resolve`,
    );
  }
});

test('the URL always names the video, and both pickers navigate', async () => {
  // A bare "/" hid which video you were on — the Run tab's picker swapped
  // content client-side while the URL still said nothing (owner, 2026-07-30).
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const r = await fetch(`${base}/`, { redirect: 'manual' });
    assert.equal(r.status, 302);
    assert.match(r.headers.get('location'), new RegExp(`\\?video=${path.basename(workdir)}$`));

    const html = await (await fetch(`${base}/?video=${path.basename(workdir)}`)).text();
    // both the Run picker and the topbar picker navigate; neither swaps in place
    assert.equal((html.match(/location\.pathname \+ '\?video='/g) || []).length, 2);
    assert.doesNotMatch(html, /picker\.addEventListener\('change', function \(\) \{ loadRun/);
  } finally {
    server.close();
  }
});

test('the URL wins over the launch video everywhere on the page', async () => {
  // Reported: URL said ?video=test-01 while the Run tab rendered opusclip's
  // ledger. The tab was reading /run-videos' `current` (the LAUNCH workdir)
  // instead of the URL the page was rendered for.
  const launch = makeWorkdir();
  const { server, base } = await startServer(launch);
  try {
    const html = await (await fetch(`${base}/?video=${path.basename(launch)}`)).text();
    // picker selection, picker init and the ledger fetch must all read the URL
    assert.equal((html.match(/URLSearchParams\(location\.search\)\.get\('video'\)/g) || []).length, 3);
    // and none of them may fall back to the launch video first
    assert.doesNotMatch(html, /v === d\.current \? ' selected'/);
  } finally {
    server.close();
  }
});
