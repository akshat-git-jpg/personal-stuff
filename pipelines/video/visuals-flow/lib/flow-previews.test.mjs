import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { findPreviewFiles, pushAll, SOURCE } from './flow-previews.mjs';

const TMP = path.join(import.meta.dirname, '.test-tmp', 'flow-previews');
test.before(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
});

function workdir(name, files) {
  const dir = fs.mkdtempSync(path.join(TMP, `${name}-`));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}

// A fake `pp-flow-queue` that records the argv it was called with.
function spy(status = 0) {
  const calls = [];
  const run = (cli, args) => {
    calls.push(args);
    return { status, stdout: 'ok', stderr: '' };
  };
  return { calls, run };
}

// Only one gate approves a look from generated frames now: 240 new-card looks.
// 110 (propose the intro idea) was removed 2026-08-17 — real Hyperframes
// teasers (lib/intro-film/teasers.mjs) superseded the AI-generated still.
test('the only source picked up is the 240 new-card look queue', () => {
  const dir = workdir('card-only', { 'card-previews/promise-shelf.md': '## m1\nA frame.' });
  const found = findPreviewFiles(dir);
  assert.deepEqual(found.map((f) => f.group), ['card-promise-shelf']);
});

// The group id still carries the kind (the download filename is <group>_m1)
// even with one source — a real requirement, not a leftover from two.
test('the group id carries the kind', () => {
  const dir = workdir('kind', { 'card-previews/alpha.md': '## m1\nY.' });
  const groups = findPreviewFiles(dir).map((f) => f.group);
  assert.deepEqual(groups, ['card-alpha']);
});

// A deliberate behaviour change, not an oversight: a leftover
// intro-film/idea-previews directory (from before 2026-08-17, or authored by
// habit) must be silently ignored, not picked up as a source.
test('intro-film/idea-previews is no longer a source', () => {
  const dir = workdir('intro-ignored', {
    'intro-film/idea-previews/idea-a.md': '## m1\nA frame.',
    'card-previews/alpha.md': '## m1\nY.',
  });
  const groups = findPreviewFiles(dir).map((f) => f.group).sort();
  assert.deepEqual(groups, ['card-alpha'], 'the intro-film idea-previews file must be ignored');
});

// THE STALENESS REGRESSION. The relay de-dupes per (source, group) only, so a
// previous video's groups have nothing to collide with and survive. Since the
// extension auto-loads whatever is queued, those already-approved frames would
// ride along silently and spend generations. `previews` must REPLACE this
// pipeline's whole share of the queue, not add to it.
test('pushAll clears this source before pushing, so a previous video cannot linger', () => {
  const dir = workdir('clear', { 'card-previews/fresh.md': '## m1\nFresh.' });
  const { calls, run } = spy();
  pushAll(dir, { cli: 'pp-flow-queue', run });

  assert.deepEqual(calls[0], ['clear', '--source', SOURCE], 'the clear must come FIRST');
  assert.equal(calls[1][0], 'push');
  assert.ok(calls[1].includes('card-fresh'));
  assert.equal(calls.length, 2, 'one clear + one push');
});

// A bare run on a video with no previews must not wipe a queue the owner may be
// part-way through generating.
test('pushAll on a video with no preview files touches nothing', () => {
  const dir = workdir('empty', { 'cues.json': '{}' });
  const { calls, run } = spy();
  const pushed = pushAll(dir, { cli: 'pp-flow-queue', run });
  assert.deepEqual(pushed, []);
  assert.deepEqual(calls, [], 'no clear, no push — the queue is left alone');
});

test('a failing push is reported, not swallowed', () => {
  const dir = workdir('fail', { 'card-previews/x.md': '## m1\nX.' });
  const run = (cli, args) =>
    args[0] === 'clear' ? { status: 0, stdout: '', stderr: '' } : { status: 1, stdout: '', stderr: 'boom' };
  assert.throws(() => pushAll(dir, { cli: 'pp-flow-queue', run }), /push failed/);
});
