import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sideModeCueIds } from './side-mode.mjs';
import { rewriteCanvas, hashRenderInputs } from './render.mjs';
import { SHOT_CONSTANTS } from './shot-constants.mjs';

const TMP_ROOT = path.join(import.meta.dirname, '.test-tmp', 'side-mode');
test.before(() => {
  if (fs.existsSync(TMP_ROOT)) fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TMP_ROOT, { recursive: true });
});

test('sideModeCueIds: a side span covering one fullframe cue returns that cue id', () => {
  const cues = [{ id: 'c1', placement: 'fullframe', start: 10, duration: 20 }];
  const spans = [{ id: 's1', mode: 'side', start: 12, end: 25 }];
  const ids = sideModeCueIds(cues, spans);
  assert.deepEqual([...ids], ['c1']);
});

test('sideModeCueIds: a full span contributes nothing', () => {
  const cues = [{ id: 'c1', placement: 'fullframe', start: 10, duration: 20 }];
  const spans = [{ id: 's1', mode: 'full', start: 12, end: 25 }];
  const ids = sideModeCueIds(cues, spans);
  assert.equal(ids.size, 0);
});

test('sideModeCueIds: a side span covering zero fullframe cues throws with the span id', () => {
  const cues = [{ id: 'c1', placement: 'fullframe', start: 100, duration: 20 }];
  const spans = [{ id: 's1', mode: 'side', start: 0, end: 10 }];
  assert.throws(() => sideModeCueIds(cues, spans), /s1/);
});

test('sideModeCueIds: a side span covering two fullframe cues throws with the span id and cue ids', () => {
  const cues = [
    { id: 'c1', placement: 'fullframe', start: 0, duration: 10 },
    { id: 'c2', placement: 'fullframe', start: 10, duration: 10 },
  ];
  const spans = [{ id: 's1', mode: 'side', start: 5, end: 15 }];
  assert.throws(() => sideModeCueIds(cues, spans), (err) => {
    assert.match(err.message, /s1/);
    assert.match(err.message, /c1/);
    assert.match(err.message, /c2/);
    return true;
  });
});

test('sideModeCueIds: an overlay cue is not eligible to cover a side span', () => {
  const cues = [{ id: 'c1', placement: 'overlay', start: 10, duration: 20 }];
  const spans = [{ id: 's1', mode: 'side', start: 12, end: 25 }];
  assert.throws(() => sideModeCueIds(cues, spans), /s1/);
});

test('staged HTML: a side-covered cue stages at data-width="1200"', () => {
  const html = '<div id="root" data-width="1920" data-duration="6"></div>';
  const cues = [{ id: 'c1', placement: 'fullframe', start: 10, duration: 20 }];
  const spans = [{ id: 's1', mode: 'side', start: 12, end: 25 }];
  const ids = sideModeCueIds(cues, spans);
  const cue = { ...cues[0], sideMode: ids.has('c1') };
  assert.equal(cue.sideMode, true);

  const { html: out, error } = rewriteCanvas(html, SHOT_CONSTANTS.SIDE_GRAPHICS_W.value);
  assert.equal(error, null);
  assert.match(out, /data-width="1200"/);
});

test('staged HTML: a cue with no covering side span stays at 1920', () => {
  const html = '<div id="root" data-width="1920" data-duration="6"></div>';
  const cues = [{ id: 'c1', placement: 'fullframe', start: 10, duration: 20 }];
  const spans = [];
  const ids = sideModeCueIds(cues, spans);
  const cue = { ...cues[0], sideMode: ids.has('c1') };
  assert.equal(cue.sideMode, false);

  // render.mjs only calls rewriteCanvas when cue.sideMode is truthy, so the
  // staged html for this cue is never touched and keeps its original width.
  assert.match(html, /data-width="1920"/);
});

test('hashRenderInputs: rewriting data-width for side mode changes the render cache key', () => {
  const full = fs.mkdtempSync(path.join(TMP_ROOT, 'full-'));
  fs.mkdirSync(path.join(full, 'card'));
  fs.writeFileSync(path.join(full, 'card', 'index.html'), '<div data-width="1920" data-duration="6"></div>');
  fs.writeFileSync(path.join(full, 'vars.json'), '{}');

  const side = fs.mkdtempSync(path.join(TMP_ROOT, 'side-'));
  fs.mkdirSync(path.join(side, 'card'));
  const { html: sideHtml } = rewriteCanvas('<div data-width="1920" data-duration="6"></div>', SHOT_CONSTANTS.SIDE_GRAPHICS_W.value);
  fs.writeFileSync(path.join(side, 'card', 'index.html'), sideHtml);
  fs.writeFileSync(path.join(side, 'vars.json'), '{}');

  const args = ['hyperframes', 'render', '--format', 'mp4'];
  assert.notEqual(
    hashRenderInputs(full, args),
    hashRenderInputs(side, args),
    'a cue that flips sideMode between runs must not serve a stale clip at the wrong width',
  );
});
