import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { boardGate, boardErrors, momentSig, decide, readBoard } from './storyboard.mjs';
import { createStoryboardServer } from './storyboard-server.mjs';
import { authorMoments, formatLines } from './author-moments.mjs';
import { attributeDead } from './review-cut.mjs';
import { ROOT, MEDIA_ROOT } from './paths.mjs';

const m1 = { id: 'm01', kind: 'takeover', start: 1, end: 5, duration: 4, idea: 'a thing breaks' };
const m2 = { id: 'm02', kind: 'overlay', start: 8, end: 12, duration: 4, idea: 'a price lands' };

test('the gate passes only approved panels drawn for the moment as it stands', () => {
  const board = { moments: {
    m01: { status: 'approved', sig: momentSig(m1) },
    m02: { status: 'rejected', sig: momentSig(m2), note: 'too busy' },
  } };
  assert.deepEqual(boardGate(board, [m1]), []);
  assert.match(boardGate(board, [m2])[0].why, /rejected: "too busy"/);
  assert.match(boardGate(board, [{ ...m1, idea: 'changed' }])[0].why, /moment changed/);
  assert.match(boardGate({ moments: {} }, [m1])[0].why, /no storyboard panel/);
});

test('board.json must give every moment a key second inside it, a caption and a still', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-'));
  fs.mkdirSync(path.join(dir, 'stills'));
  fs.writeFileSync(path.join(dir, 'stills', 'm01.html'), '<html></html>');
  assert.deepEqual(boardErrors({ m01: { at: 2, caption: 'x' } }, [m1], dir), []);
  const errs = boardErrors({ m01: { at: 9, caption: '' } }, [m1, m2], dir).join('\n');
  assert.match(errs, /m01: at must be seconds within 0-4/);
  assert.match(errs, /m01: caption is required/);
  assert.match(errs, /no entry for m02/);
  fs.rmSync(dir, { recursive: true, force: true });
});

function fixture(slug) {
  const wd = path.join(ROOT, 'videos', slug);
  fs.mkdirSync(wd, { recursive: true });
  fs.writeFileSync(path.join(wd, 'run-config.json'), JSON.stringify({ template: 'animate', video: slug, designSystem: 'default', source: { audio: 'audio.wav', screen: null }, total: 20 }));
  fs.writeFileSync(path.join(wd, 'moments.json'), JSON.stringify({ moments: [m1, m2] }));
  fs.writeFileSync(path.join(wd, 'transcript.json'), '[]');
  fs.writeFileSync(path.join(wd, 'storyboard.json'), JSON.stringify({ video: slug, moments: {
    m01: { at: 2, caption: 'breaks', status: 'pending', sig: momentSig(m1) },
    m02: { at: 1, caption: 'lands', status: 'pending', sig: momentSig(m2) },
  } }));
  return wd;
}

test('040 refuses moments whose panel is not approved, and names them', async () => {
  const slug = `zz-board-gate-${process.pid}`;
  const wd = fixture(slug);
  try {
    await assert.rejects(authorMoments(slug, { stageOnly: true }), /storyboard gate[\s\S]*m01: panel is pending[\s\S]*m02: panel is pending[\s\S]*--skip-storyboard/);
    decide(slug, ['m01'], 'approved');
    await assert.rejects(authorMoments(slug, { only: ['m02'], stageOnly: true }), /m02: panel is pending/);
    assert.equal(readBoard(slug).moments.m01.status, 'approved');
  } finally {
    fs.rmSync(wd, { recursive: true, force: true });
  }
});

test('the storyboard page lists panels and records approve and reject-with-note', async () => {
  const slug = `zz-board-page-${process.pid}`;
  const wd = fixture(slug);
  const server = createStoryboardServer(slug);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (b) => fetch(`${base}/api/decide`, { method: 'POST', body: JSON.stringify(b) }).then((r) => r.json());
  try {
    assert.match(await (await fetch(`${base}/`)).text(), /Storyboard/);
    const s = await (await fetch(`${base}/api/state`)).json();
    assert.deepEqual(s.panels.map((p) => [p.n, p.id, p.status]), [[1, 'm01', 'pending'], [2, 'm02', 'pending']]);
    assert.equal((await post({ id: 'm01', status: 'approved' })).ok, true);
    assert.equal((await post({ id: 'm02', status: 'rejected', note: '' })).ok, false);
    assert.equal((await post({ id: 'm02', status: 'rejected', note: 'keep it off the sidebar' })).panel.note, 'keep it off the sidebar');
    const board = JSON.parse(fs.readFileSync(path.join(wd, 'storyboard.json'), 'utf8'));
    assert.deepEqual([board.moments.m01.status, board.moments.m02.status], ['approved', 'rejected']);
    assert.equal((await fetch(`${base}/panel/m01.png`)).status, 404);
  } finally {
    server.close();
    fs.rmSync(wd, { recursive: true, force: true });
    fs.rmSync(path.join(MEDIA_ROOT, slug), { recursive: true, force: true });
  }
});

test('extra formats are laid out again around the recording band', () => {
  const lines = formatLines(['16:9', '9:16'], { w: 1920, h: 1080, fps: 30 }, 'overlay');
  assert.match(lines, /`composition\/index.html`: 16:9, 1920x1080px \(the main cut\)/);
  assert.match(lines, /`composition-9x16\/index.html`: 9:16, 1080x1920px\. The recording sits in a band at y 656-1264px/);
});

test('dead seconds are split between the moments and the recording', () => {
  const r = attributeDead([{ from: 3, to: 9, seconds: 6 }], [m1, m2]);
  assert.deepEqual(r.byMoment, { m01: 2, m02: 1 });
  assert.deepEqual(r.runs[0].where, ['m01', 'm02', 'recording']);
});
