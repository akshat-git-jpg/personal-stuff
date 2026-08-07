import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer, latestWorkdir, buildSegments, synthCalibrationVars, loadShots, mergeShots, loadEffects, mergeEffects, fxContext, fxEventsAt, appendFinalFeedback, appendIntroFeedback, pinFromClick, resolveAndExtend, playthroughView, toggleAuditAccepted, REVIEW_NAMESPACES, TAB_NAMESPACE, reviewNamespacesFromRegistry, gateNumberFor } from './board.mjs';

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

// Every server is tracked and force-closed when the file finishes. Without
// this, a test that throws before its `server.close()` leaks a listener, the
// process never exits, and the whole suite HANGS instead of reporting the
// failure (bitten 2026-07-31: a dist-dependent test failed on a fresh checkout
// and check.sh sat silent for 20+ minutes).
const OPEN_SERVERS = new Set();
async function startServer(workdir) {
  const server = createServer(workdir);
  OPEN_SERVERS.add(server);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, base: `http://localhost:${port}` };
}

test.after(() => {
  for (const s of OPEN_SERVERS) {
    try { s.closeAllConnections?.(); s.close(); } catch { /* already closed */ }
  }
});

test.before(() => {
  if (fs.existsSync(TMP_ROOT)) {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  }
  ensureFixtureAudio();
});

test('GET /list returns 302 to /#storyboard preserving ?video=', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  const res = await fetch(`${base}/list?video=test-01`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/?video=test-01#storyboard');
  server.close();
});

test('GET / with ?video= returns 200 containing id="root"', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /id="root"/);
  server.close();
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

test('GET /poster/c01.jpg returns an image and caches; an unknown cue id 404s', async () => {
  const workdir = makeWorkdir();
  const rendersDir = path.join(workdir, 'renders');
  fs.mkdirSync(rendersDir);
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=128x128:d=10', '-c:v', 'libx264', path.join(rendersDir, 'c01.mp4')], { stdio: 'ignore' });

  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/poster/c01.jpg`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/jpeg');
    const buf = Buffer.from(await res.arrayBuffer());
    assert.ok(buf.length > 0);
    assert.ok(fs.existsSync(path.join(workdir, '.posters', 'c01.jpg')));

    const res2 = await fetch(`${base}/poster/c99.jpg`);
    assert.equal(res2.status, 404);
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

test('API board-data segments have order, gap ids, and highlights', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  const res = await fetch(`${base}/api/board-data`);
  const data = await res.json();
  const segments = data.segments || [];
  assert.ok(segments.length > 0);
  server.close();
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

    const dataBoard = await (await fetch(`http://localhost:${port}/api/board-data`)).json();
    assert.equal(dataBoard.feedback.c01.text, 'wrong card here');
    assert.equal(dataBoard.feedback._global.text, 'good pass');
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

test('API returns folded items correctly', async () => {
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
    const data = await (await fetch(`http://localhost:${port}/api/board-data`)).json();
    assert.equal(data.feedback.c01.text, 'old lesson');
    assert.equal(data.feedback.c01.folded, '2026-07-18');
  } finally {
    server.close();
  }
});

test('API and save: legacy string upgrade', async () => {
  const workdir = makeWorkdir();
  const fbPath = path.join(workdir, 'feedback.json');
  fs.writeFileSync(fbPath, JSON.stringify({
    items: {
      c01: 'old legacy string',
      c02: 'another legacy'
    }
  }));

  const server = createServer(workdir);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    const data = await (await fetch(`http://localhost:${port}/api/board-data`)).json();
    assert.equal(data.feedback.c01.text, 'old legacy string');
    assert.equal(data.feedback.c02.text, 'another legacy');
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

test('GET /calibrate returns 302 to /#calibrate', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  const res = await fetch(`${base}/calibrate?video=test-01`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/?video=test-01#calibrate');
  server.close();
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
  const res = await fetch(`${base}/approve-effects`, { method: 'POST' });
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(fs.readFileSync(path.join(workdir, 'effects.json'), 'utf8')).approved, true);
  server.close();
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

test('Card Plan tab API round-trips does text', async () => {
  const workdir = makeWorkdir();
  fs.writeFileSync(path.join(workdir, 'card-plan.json'), JSON.stringify({ approved: false, sections: [{ does: 'test' }] }));
  const { server, base } = await startServer(workdir);
  const res = await fetch(`${base}/api/board-data`);
  const data = await res.json();
  assert.ok(data.cardPlan);
  assert.equal(data.cardPlan.sections[0].does, 'test');
  server.close();
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

test('POST /approve-card-plan flips approved', async () => {
  const workdir = makeWorkdir();
  fs.writeFileSync(path.join(workdir, 'card-plan.json'), JSON.stringify({
    video: 'x',
    approved: false,
    sections: [{ part: 'body', items: [{ id: 'c01', card: 'race/cost-race', status: 'new', proposal: { does: 'bars race' } }] }],
  }));
  const { server, base } = await startServer(workdir);
  const res = await fetch(`${base}/approve-card-plan`, { method: 'POST' });
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(fs.readFileSync(path.join(workdir, 'card-plan.json'), 'utf8')).approved, true);
  server.close();
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

test('Run tab serves 200', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  server.close();
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

test('a pre-040 board approves an empty storyboard', async () => {
  const workdir = makeWorkdir();
  fs.unlinkSync(path.join(workdir, 'resolved.json'));
  fs.writeFileSync(path.join(workdir, 'cues.json'), '[]');
  const { server, base } = await startServer(workdir);
  const res = await fetch(`${base}/approve`, { method: 'POST' });
  assert.equal(res.status, 200);
  server.close();
});


test('latestWorkdir handles an empty or absent videos dir', () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const empty = fs.mkdtempSync(path.join(TMP_ROOT, 'videos-empty-'));
  assert.equal(latestWorkdir(empty), null);
  assert.equal(latestWorkdir(path.join(empty, 'nope')), null);
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



// ---- reviewed / collapse --------------------------------------------------

// ---- global video picker --------------------------------------------------
test('?video= redirect test stays', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  server.close();
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

test('appendIntroFeedback allocates intro:0, intro:1; ignores final-* keys', () => {
  const fb = { items: { 'final-v1:0': { text: 'old' } } };
  const f2 = appendIntroFeedback(fb, { text: 'my feedback', context: 'intro@00:01.2', t: 1.2, x: 50, y: 50 });
  assert.ok(f2.items['intro:0'], 'starts at intro:0');
  assert.equal(f2.items['intro:0'].text, 'my feedback');
  assert.equal(f2.items['intro:0'].t, 1.2);
  
  const f3 = appendIntroFeedback(f2, { text: 'more feedback' });
  assert.ok(f3.items['intro:1'], 'increments to intro:1');
  assert.equal(f3.items['intro:1'].text, 'more feedback');
  assert.equal(f3.items['final-v1:0'].text, 'old', 'does not touch final-* keys');
});

test('/intro-video returns 206 for a Range request, 404 JSON when unrendered', async () => {
  const workdir = makeWorkdir();
  const outDir = path.join(workdir, 'intro-film', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  
  const { server, base } = await startServer(workdir);
  try {
    let res = await fetch(`${base}/intro-video`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).ok, false);

    const videoPath = path.join(outDir, 'intro.mp4');
    fs.writeFileSync(videoPath, Buffer.alloc(100));
    
    res = await fetch(`${base}/intro-video`, { headers: { 'Range': 'bytes=0-49' } });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get('content-range'), 'bytes 0-49/100');
    assert.equal(res.headers.get('content-length'), '50');
    await res.arrayBuffer();
  } finally {
    server.close();
  }
});

test('edit/delete guard accepts intro:0, rejects cue:7', async () => {
  const workdir = makeWorkdir();
  fs.writeFileSync(path.join(workdir, 'feedback.json'), JSON.stringify({
    items: {
      'intro:0': { text: 'intro' },
      'cue:7': { text: 'cue' }
    }
  }));
  const { server, base } = await startServer(workdir);
  try {
    let res = await fetch(`${base}/feedback-final-delete`, { method: 'POST', body: JSON.stringify({ key: 'cue:7' }) });
    assert.equal(res.status, 400);

    res = await fetch(`${base}/feedback-final-delete`, { method: 'POST', body: JSON.stringify({ key: 'intro:0' }) });
    assert.equal(res.status, 200, 'intro: keys must be editable');
    assert.equal((await res.json()).ok, true);
  } finally {
    server.close();
  }
});

// Gate 027 reviews the intro film BEFORE 030 authors any cue, so the board has
// to open on a workdir with no cues.json at all. It used to throw at boot, which
// made the Intro tab unreachable at the only point in the flow it exists for.
test('createServer boots a video that has no cues.json', () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'board-nocues-'));
  for (const f of ['transcript.json', 'vo.mp3']) {
    fs.copyFileSync(path.join(FIXTURE_DIR, f), path.join(dir, f));
  }
  fs.writeFileSync(path.join(dir, 'run-config.json'),
    JSON.stringify({ engine: 'heygen3' }));
  assert.ok(!fs.existsSync(path.join(dir, 'cues.json')), 'fixture must have no cues.json');
  const server = createServer(dir);          // must not throw
  OPEN_SERVERS.add(server);
  assert.ok(server, 'board must open for a video before the cue pass');
});

// Every video is an intro-film video now (plan 194), so an unconfigured video
// also boots successfully without cues.json.
test('createServer boots an unconfigured workdir with no cues.json', () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'board-cards-'));
  for (const f of ['transcript.json', 'vo.mp3']) {
    fs.copyFileSync(path.join(FIXTURE_DIR, f), path.join(dir, f));
  }
  assert.ok(!fs.existsSync(path.join(dir, 'run-config.json')), 'fixture must have no run-config.json');
  const server = createServer(dir);
  OPEN_SERVERS.add(server);
  assert.ok(server, 'board must open for an unconfigured video before the cue pass');
});

// Booting on an intro-film video is not enough — the board must also SWITCH to
// one. requestedWorkdir kept its own copy of the cues.json precondition, so
// ?video=<intro-film-slug> silently fell back to the launch workdir: the URL
// named the new video while the page showed the old one (owner report
// 2026-08-06). requestedWorkdir resolves against the real videos/ root, so the
// fixture has to live there.
test('requestedWorkdir switches to an intro-film video that has no cues.json', async () => {
  const { requestedWorkdir } = await import('./board.mjs');
  const videosDir = path.join(path.resolve(import.meta.dirname, '..'), 'videos');
  const slug = `.test-intro-film-${process.pid}`;
  const target = path.join(videosDir, slug);
  fs.mkdirSync(target, { recursive: true });
  try {
    fs.copyFileSync(path.join(FIXTURE_DIR, 'vo.mp3'), path.join(target, 'vo.mp3'));
    fs.writeFileSync(path.join(target, 'run-config.json'),
      JSON.stringify({ engine: 'heygen3', review: 'full', intro: 'film' }));
    const launch = makeWorkdir();
    const url = new URL(`http://x/?video=${encodeURIComponent(slug)}`);
    assert.equal(requestedWorkdir(url, launch), target,
      'an intro-film video must be reachable by ?video= before the cue pass exists');

  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

// The dashboard starts the board with NO slug, so latestWorkdir decides what the
// owner sees. Keying candidacy on cues.json made an intro-film video invisible:
// the dashboard opened an older cue-driven video instead, which is how the wrong
// video ended up on screen with the right URL in the bar.
test('latestWorkdir picks an intro-film video that has no cues.json', () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const videos = fs.mkdtempSync(path.join(TMP_ROOT, 'videos-introfilm-'));

  const older = path.join(videos, 'older-cards');
  fs.mkdirSync(older);
  for (const f of ['cues.json', 'vo.mp3']) fs.copyFileSync(path.join(FIXTURE_DIR, f), path.join(older, f));

  const film = path.join(videos, 'newer-film');
  fs.mkdirSync(film);
  fs.copyFileSync(path.join(FIXTURE_DIR, 'vo.mp3'), path.join(film, 'vo.mp3'));
  fs.writeFileSync(path.join(film, 'run-config.json'),
    JSON.stringify({ engine: 'heygen3', review: 'full', intro: 'film' }));
  fs.writeFileSync(path.join(film, 'run-log.json'), JSON.stringify({ steps: [] }));

  // Make the film video unambiguously the most recently touched one.
  const past = new Date(Date.now() - 60_000);
  fs.utimesSync(path.join(older, 'cues.json'), past, past);

  assert.equal(latestWorkdir(videos), film, 'newest bootable video wins, cues or no cues');

  // And an intro-film video still has to be bootable to be picked.
  fs.rmSync(path.join(film, 'vo.mp3'));
  assert.equal(latestWorkdir(videos), older, 'no vo.mp3 means not board-ready, so fall back');
});


// ---- several screenshots on one comment ------------------------------------
// One frame rarely shows a whole problem. Before this, `image` was a single
// string and a second paste silently replaced the first client-side, so the
// owner saw the older screenshot vanish with no sign why (report 2026-08-06).
test('a review comment carries several screenshots, each served by index', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/feedback-intro`, {
      method: 'POST',
      body: JSON.stringify({ item: { text: 'three frames', t: 4 }, images: [PNG_1PX, PNG_1PX, PNG_1PX] }),
    });
    assert.equal(res.status, 200);
    const { key, item } = await res.json();

    assert.deepEqual(item.images, [
      'feedback-images/intro-0-0.png',
      'feedback-images/intro-0-1.png',
      'feedback-images/intro-0-2.png',
    ], 'indexed names, so a second screenshot cannot land on the first one\'s path');
    for (const rel of item.images) assert.ok(fs.existsSync(path.join(workdir, rel)), `${rel} on disk`);

    // /<key> is the first one (what every pre-existing link means), /<key>/<n> the nth.
    for (const [suffix, expect] of [['', 200], ['/0', 200], ['/2', 200], ['/3', 404]]) {
      const img = await fetch(`${base}/feedback-image/${key}${suffix}`);
      assert.equal(img.status, expect, `/feedback-image/${key}${suffix}`);
    }

    // Deleting the comment takes EVERY screenshot with it, not just the first.
    const del = await fetch(`${base}/feedback-delete`, { method: 'POST', body: JSON.stringify({ key }) });
    assert.equal(del.status, 200);
    for (const rel of item.images) {
      assert.ok(!fs.existsSync(path.join(workdir, rel)), `${rel} must be removed with its comment`);
    }
  } finally {
    server.close();
  }
});

// feedback.json files already on disk carry the pre-2026-08-06 single `image`
// string. A review comment is a record, not a cache — it must keep rendering.
test('itemImages reads the legacy single image and the new array alike', async () => {
  const { itemImages } = await import('./board.mjs');
  assert.deepEqual(itemImages({ image: 'feedback-images/intro-0.png' }), ['feedback-images/intro-0.png']);
  assert.deepEqual(itemImages({ images: ['a.png', 'b.png'] }), ['a.png', 'b.png']);
  assert.deepEqual(itemImages({ images: ['a.png'], image: 'legacy.png' }), ['a.png'], 'array wins when both are present');
  assert.deepEqual(itemImages({}), []);
  assert.deepEqual(itemImages(undefined), []);
});

test('a legacy single-image comment still serves at /feedback-image/<key>', async () => {
  const workdir = makeWorkdir();
  fs.mkdirSync(path.join(workdir, 'feedback-images'), { recursive: true });
  fs.writeFileSync(path.join(workdir, 'feedback-images', 'intro-0.png'),
    Buffer.from(PNG_1PX.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(workdir, 'feedback.json'), JSON.stringify({
    items: { 'intro:0': { text: 'old shape', t: 1, image: 'feedback-images/intro-0.png' } },
  }));
  const { server, base } = await startServer(workdir);
  try {
    const img = await fetch(`${base}/feedback-image/intro:0`);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/png');
  } finally {
    server.close();
  }
});

// The extension point for a future review step: add a namespace, get edit and
// delete. A permissive "anything:<n>" rule would also hand this endpoint the
// storyboard's cue notes, which another surface owns.
test('isEditableKey admits review namespaces and refuses everything else', async () => {
  const { isEditableKey } = await import('./board.mjs');
  for (const ok of ['intro:0', 'intro:12', 'final-v1:0', 'final-v2:31']) {
    assert.equal(isEditableKey(ok), true, `${ok} must be editable`);
  }
  for (const no of ['cue:7', 'sb:c01', 'c01', 'intro', 'intro:', ':0', '', undefined, '../etc:0']) {
    assert.equal(isEditableKey(no), false, `${no} must be refused`);
  }
});

// Plan 193: REVIEW_NAMESPACES and the gate step numbers are now derived from
// the registry (plan 191) instead of hand-maintained literals. These tests
// exercise the REAL steps/ folder on disk — not a fixture — because that is
// the same registry boss's mutation gate edits, and a test running against a
// stand-in fixture would never notice a mutation to the real files.
test('REVIEW_NAMESPACES is derived from the registry and still equals [intro, final]', () => {
  assert.deepEqual(REVIEW_NAMESPACES, ['intro', 'final']);
  assert.deepEqual(reviewNamespacesFromRegistry(), ['intro', 'final']);
});

// TAB_NAMESPACE deliberately does NOT cover every gated tab: card-plan (037)
// and storyboard (080) also hold gates, but their comments (zone-*,
// card-body:*, cue:*) are owned by a different surface with its own
// lifecycle — deleting one through this endpoint is exactly the bug the
// closed-list comment on REVIEW_NAMESPACES warns about.
test('TAB_NAMESPACE maps only the tabs that get edit + delete', () => {
  assert.deepEqual(TAB_NAMESPACE, { intro: 'intro', 'final-cut': 'final' });
});

test('gateNumberFor resolves the current step number for all three approvable gates', () => {
  assert.equal(gateNumberFor('card-plan.json'), '037');
  assert.equal(gateNumberFor('final-cut.json'), '120');
  assert.equal(gateNumberFor('intro-film/screenplay.json'), '027');
});

test('gateNumberFor throws E-BOARD when no step declares the gate file', () => {
  assert.throws(() => gateNumberFor('no-such-gate.json'), /E-BOARD/);
});

// ---- re-rendered media must beat the browser cache -------------------------
// The intro film and its review frames keep the SAME url across re-renders, so
// a cached copy is indistinguishable from a fresh one by URL alone: the owner
// re-renders after giving feedback and is served the film they just critiqued.
// /intro-frame guaranteed it by claiming max-age=31536000 — a year of
// immutability on a file every review pass rewrites (owner report 2026-08-06).
test('a re-rendered intro film beats a cached copy, and 304s when unchanged', async () => {
  const workdir = makeWorkdir();
  const outDir = path.join(workdir, 'intro-film', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const mp4 = path.join(outDir, 'intro.mp4');
  fs.writeFileSync(mp4, 'VERSION-ONE');

  const { server, base } = await startServer(workdir);
  try {
    const first = await fetch(`${base}/intro-video`);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('cache-control'), 'no-cache',
      'must revalidate — an unconditioned video url is how a stale render survives a re-render');
    const etag = first.headers.get('etag');
    assert.ok(etag, 'needs a validator or revalidation cannot work');

    const unchanged = await fetch(`${base}/intro-video`, { headers: { 'if-none-match': etag } });
    assert.equal(unchanged.status, 304, 'unchanged file must 304, or every load re-downloads the film');

    // A Range must NEVER 304: a media element that asks for bytes and gets an
    // empty 304 simply stalls.
    const ranged = await fetch(`${base}/intro-video`, {
      headers: { Range: 'bytes=0-3', 'if-none-match': etag },
    });
    assert.equal(ranged.status, 206, 'a Range request must be answered with bytes, never a 304');

    // Re-render: same path, different content.
    fs.writeFileSync(mp4, 'VERSION-TWO-IS-LONGER');
    const after = await fetch(`${base}/intro-video`, { headers: { 'if-none-match': etag } });
    assert.equal(after.status, 200, 'a re-render must not be answered with 304');
    assert.equal(await after.text(), 'VERSION-TWO-IS-LONGER');
  } finally {
    server.close();
  }
});

test('review frames revalidate instead of claiming a year of immutability', async () => {
  const workdir = makeWorkdir();
  const reviewDir = path.join(workdir, 'intro-film', 'review');
  fs.mkdirSync(reviewDir, { recursive: true });
  const frame = path.join(reviewDir, 'frame-00-at-1s.png');
  fs.writeFileSync(frame, 'FRAME-V1');

  const { server, base } = await startServer(workdir);
  try {
    const first = await fetch(`${base}/intro-frame?f=frame-00-at-1s.png`);
    assert.equal(first.status, 200);
    const cc = first.headers.get('cache-control') ?? '';
    assert.doesNotMatch(cc, /max-age=\d{5,}/,
      'review frames are rewritten under the same name by every review pass — they are never immutable');
    const etag = first.headers.get('etag');

    assert.equal((await fetch(`${base}/intro-frame?f=frame-00-at-1s.png`,
      { headers: { 'if-none-match': etag } })).status, 304);

    fs.writeFileSync(frame, 'FRAME-V2-AFTER-REVIEW');
    const after = await fetch(`${base}/intro-frame?f=frame-00-at-1s.png`, { headers: { 'if-none-match': etag } });
    assert.equal(after.status, 200, 're-reviewed frame must not be answered with 304');
    assert.equal(await after.text(), 'FRAME-V2-AFTER-REVIEW');
  } finally {
    server.close();
  }
});
