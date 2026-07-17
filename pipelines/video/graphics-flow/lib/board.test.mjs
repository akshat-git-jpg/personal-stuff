import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer, buildSegments } from './board.mjs';

const FIXTURE_DIR = path.join(import.meta.dirname, 'fixtures', 'board');
const TMP_ROOT = path.join(import.meta.dirname, '.test-tmp');

function ensureFixtureAudio() {
  const voPath = path.join(FIXTURE_DIR, 'vo.mp3');
  if (fs.existsSync(voPath)) return;
  const result = spawnSync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=30', '-c:a', 'libmp3lame', voPath,
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

function makeWorkdir() {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TMP_ROOT, 'board-'));
  for (const f of ['cues.json', 'resolved.json', 'transcript.json', 'vo.mp3']) {
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
  ensureFixtureAudio();
});

test('GET / lists every cue id and an Approve button', async () => {
  const { server, base } = await startServer(makeWorkdir());
  try {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /c01/);
    assert.match(html, /c02/);
    assert.match(html, />Approve</);
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
    assert.deepEqual(data, { ok: true, errors: [] });

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

test('GET / contains gap timecode, cues in DOM order, anchor highlighted, minimap matches segment count', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/`);
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
