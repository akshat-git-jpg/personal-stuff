import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from './board.mjs';
import { applicableTabs } from './board-data.mjs';

const FIXTURE_DIR = path.join(import.meta.dirname, 'fixtures', 'board');
const TMP_ROOT = path.join(import.meta.dirname, '.test-tmp', 'board-api');
const CARD_LIBRARY_ROOT = path.resolve(import.meta.dirname, '..', '..', 'card-library');

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

test('GET /api/board-data returns 200 JSON matching the schema', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/api/board-data`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.video, path.basename(workdir));
    assert.equal(data.hasResolved, true);
    assert.ok(data.totalDuration > 0);
    assert.ok(Array.isArray(data.segments));
    assert.ok(data.segments.length > 0);
    for (const seg of data.segments) {
      assert.ok(['cue', 'gap'].includes(seg.kind));
      assert.ok(seg.id.startsWith('seg-'));
      assert.equal(typeof seg.start, 'number');
      assert.equal(typeof seg.end, 'number');
      assert.ok(Array.isArray(seg.words));
      if (seg.kind === 'cue') {
        assert.ok(typeof seg.cueId === 'string');
        assert.ok(Array.isArray(seg.highlights));
        assert.ok(Array.isArray(seg.probeTimes));
      }
    }
  } finally {
    server.close();
  }
});

test('Segment ids and order agree with the page contract', async () => {
  const workdir = makeWorkdir();
  const cues = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
  cues.cues.unshift({ id: 'c99', card: 'some-card', anchor: 'unknown' });
  fs.writeFileSync(path.join(workdir, 'cues.json'), JSON.stringify(cues));

  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/api/board-data`);
    const data = await res.json();
    
    assert.equal(data.segments[0].kind, 'cue');
    assert.equal(data.segments[0].cueId, 'c99');
    assert.equal(data.segments[0].unresolved, true);

    for (let i = 0; i < data.segments.length; i++) {
      assert.equal(data.segments[i].id, `seg-${i}`);
    }
  } finally {
    server.close();
  }
});

test('A cue whose anchor matches fixture words yields non-empty highlights', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/api/board-data`);
    const data = await res.json();
    
    const seg = data.segments.find(s => s.kind === 'cue' && s.highlights.length > 0);
    assert.ok(seg, 'Should have a cue with highlighted words');
    const highlightedWords = seg.highlights.map(i => seg.words[i].text).join(' ');
    assert.ok(highlightedWords.length > 0);
  } finally {
    server.close();
  }
});

test('approved block: after POST /approve, re-fetch → approved.cues === true', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    let res = await fetch(`${base}/api/board-data`);
    let data = await res.json();
    assert.equal(data.approved.cues, false);

    await fetch(`${base}/approve`, { method: 'POST' });

    res = await fetch(`${base}/api/board-data`);
    data = await res.json();
    assert.equal(data.approved.cues, true);
  } finally {
    server.close();
  }
});

test('Degraded pre-040 board: missing resolved.json', async () => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const workdir = fs.mkdtempSync(path.join(TMP_ROOT, 'board-'));
  for (const f of ['cues.json', 'transcript.json', 'vo.mp3']) {
    fs.copyFileSync(path.join(FIXTURE_DIR, f), path.join(workdir, f));
  }
  
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/api/board-data`);
    assert.equal(res.status, 200);
    const data = await res.json();
    
    assert.equal(data.hasResolved, false);
    assert.deepEqual(data.resolved, []);
    
    const cuesData = JSON.parse(fs.readFileSync(path.join(workdir, 'cues.json'), 'utf8'));
    const cueSegments = data.segments.filter(s => s.kind === 'cue');
    assert.equal(cueSegments.length, cuesData.cues.length);
    for (const seg of cueSegments) {
      assert.equal(seg.unresolved, true);
    }
  } finally {
    server.close();
  }
});

test('shots/effects/sound/audit/cardPlan are null when absent; correct when effects.json present', async () => {
  const workdir = makeWorkdir(true);
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/api/board-data`);
    const data = await res.json();
    
    assert.equal(data.shots, null);
    assert.equal(data.sound, null);
    assert.equal(data.audit, null);
    assert.equal(data.cardPlan, null);
    
    assert.ok(data.effects);
    assert.ok(Array.isArray(data.effects.instances));
    
    const hasCaptions = data.effects.instances.some(i => i.type === 'captions' && i.enabled);
    if (hasCaptions) {
      assert.ok(data.fx.capChunks.length > 0);
    } else {
      assert.equal(data.fx.capChunks.length, 0);
    }
  } finally {
    server.close();
  }
});

test('?video=<other-slug> resolves like pages do', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/api/board-data?video=unknown-slug`);
    const data = await res.json();
    assert.equal(data.video, path.basename(workdir));
  } finally {
    server.close();
  }
});

test('GET /api/calibrate-data', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/api/calibrate-data`);
    assert.equal(res.status, 200);
    const data = await res.json();
    
    assert.ok(Array.isArray(data.cards));
    const catalog = JSON.parse(fs.readFileSync(path.join(CARD_LIBRARY_ROOT, 'catalog.json'), 'utf8'));
    const beatCardsCount = catalog.cards.filter(c => c.kind === 'beat').length;
    assert.equal(data.cards.length, beatCardsCount);
    
    for (const card of data.cards) {
      assert.ok(card.slug);
      if (card.max_beats > 0) {
        assert.ok(card.probeTimes.length > 0);
      }
    }
  } finally {
    server.close();
  }
});

test('Feedback: POST /save writes feedback, re-fetch exposes it', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const payload = {
      video: path.basename(workdir),
      approved: false,
      cues: [],
      feedback: { 'gap-test': 'my feedback text' }
    };
    const saveRes = await fetch(`${base}/save`, { 
      method: 'POST', 
      body: JSON.stringify(payload) 
    });
    assert.equal(saveRes.status, 200);
    
    const res = await fetch(`${base}/api/board-data`);
    const data = await res.json();
    
    assert.equal(data.feedback['gap-test'].text, 'my feedback text');
  } finally {
    server.close();
  }
});

// Plan 193: /api/board-data now carries runConfig and the applicable tab list,
// so the client has a way to know which tabs this video's flow actually uses.
test('GET /api/board-data carries runConfig and tabs; a video always has an intro tab', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/api/board-data`);
    const data = await res.json();
    assert.ok(data.runConfig);
    assert.equal(data.runConfig.intro, undefined);
    assert.deepEqual(data.tabs, applicableTabs(workdir));
    assert.ok(data.tabs.includes('intro'));
    assert.ok(data.tabs.includes('run'));
    assert.ok(data.tabs.includes('calibrate'));
  } finally {
    server.close();
  }
});

test('every video includes the intro tab, regardless of run-config', async () => {
  const filmDir = makeWorkdir();
  fs.writeFileSync(path.join(filmDir, 'run-config.json'), JSON.stringify({ intro: 'film', review: 'full', engine: 'heygen3' }));
  const cardsDir = makeWorkdir();
  fs.writeFileSync(path.join(cardsDir, 'run-config.json'), JSON.stringify({ intro: 'cards', review: 'full', engine: 'heygen3' }));
  const emptyDir = makeWorkdir();

  assert.ok(applicableTabs(filmDir).includes('intro'));
  assert.ok(applicableTabs(cardsDir).includes('intro'));
  assert.ok(applicableTabs(emptyDir).includes('intro'));
});

// Touches no filesystem: deleting the workdir out from under an already-booted
// server must not make /health fail — proof it reads nothing off disk, unlike
// the /api/board-data poll it replaces (plan 193).
test('GET /health returns 200 with no filesystem dependency on the workdir', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    fs.rmSync(workdir, { recursive: true, force: true });
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  } finally {
    server.close();
  }
});

test('intro-data and intro-frame endpoints', async () => {
  const workdir = makeWorkdir();
  const { server, base } = await startServer(workdir);
  try {
    const res = await fetch(`${base}/api/intro-data`);
    assert.equal(res.status, 200);
    const data = await res.json();
    // No run-config.json: introMode defaults to 'simple' (plan 220) and this
    // fixture has no intro-simple/cutlist.json either, so cutlist/pacing stay
    // null while present stays false (no intro-film/ dir).
    assert.deepEqual(data, { present: false, mode: 'simple', cutlist: null, pacing: null });

    const res2 = await fetch(`${base}/intro-frame?f=../../etc/passwd`);
    assert.equal(res2.status, 400);
  } finally {
    server.close();
  }
});

