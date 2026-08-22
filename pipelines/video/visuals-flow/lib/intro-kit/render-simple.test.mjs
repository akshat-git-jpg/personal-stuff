import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderSimple } from './render-simple.mjs';
import { validateShape } from './cutlist-schema.mjs';
import { lintCutlist } from './lint-cutlist.mjs';
import { loadKit } from './inputs.mjs';

function ffprobeDuration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return parseFloat(r.stdout);
}

test('renderSimple refuses a cut list that fails the pacing lint — rendering an unlinted cut list is how a bad intro reaches the owner', async (t) => {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'intro-simple-lint-'));
  t.after(() => fs.rmSync(workdir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(workdir, 'intro-simple'), { recursive: true });

  const bad = {
    video: 'x',
    mode: 'simple',
    approved: false,
    span: { start: 0, end: 6.0 },
    // one avatar beat holding the whole span: S1 (share 1.0) and S3 (6.0s cut) both fire.
    beats: [{ id: 'b1', kind: 'avatar', t_start: 0, t_end: 6.0 }],
  };
  fs.writeFileSync(path.join(workdir, 'intro-simple', 'cutlist.json'), JSON.stringify(bad));

  await assert.rejects(() => renderSimple(workdir), /pacing lint/);
});

test('a fixture cut list renders end-to-end to an mp4 matching the fixture span duration', async (t) => {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'intro-simple-render-'));
  t.after(() => fs.rmSync(workdir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(workdir, 'intro-simple'), { recursive: true });

  const SPAN = 6.0;
  const cutlist = {
    video: 'fixture',
    mode: 'simple',
    approved: false,
    span: { start: 0.0, end: SPAN },
    beats: [
      { id: 'b01', kind: 'avatar', t_start: 0.0, t_end: 3.0 },
      // beats: [] — no on-screen word list, so S7 has nothing to check. The
      // point of this fixture is the render pipeline, not the word lint.
      { id: 'b02', kind: 'card', card: 'statement', t_start: 3.0, t_end: SPAN, vars: { text: 'Hello world', beats: [] } },
    ],
  };

  // The fixture itself must be a clean cut list before we spend a real render
  // on it — a broken fixture failing INSIDE renderSimple would read as a
  // renderer bug rather than a fixture bug.
  assert.deepEqual(validateShape(cutlist), []);
  assert.deepEqual(lintCutlist({ cutlist, kit: loadKit(), words: [] }).errors, []);
  fs.writeFileSync(path.join(workdir, 'intro-simple', 'cutlist.json'), JSON.stringify(cutlist));

  const avatarPath = path.join(workdir, 'avatar.mp4');
  const built = spawnSync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', `testsrc=size=1920x1080:rate=30:duration=${SPAN}`, '-pix_fmt', 'yuv420p', avatarPath,
  ]);
  assert.equal(built.status, 0, `ffmpeg fixture build failed: ${built.stderr}`);

  const { path: outPath, standIn } = await renderSimple(workdir, { jobs: 1 });
  assert.equal(standIn, false, 'a real avatar.mp4 is present — this must not fall back to the stand-in');
  assert.equal(outPath, path.join(workdir, 'intro-film', 'out', 'intro.mp4'), 'both intro flows share this exact path');
  assert.ok(fs.existsSync(outPath));

  const dur = ffprobeDuration(outPath);
  assert.ok(
    Number.isFinite(dur) && Math.abs(dur - SPAN) <= 0.15,
    `expected an mp4 of ~${SPAN}s (+/- 0.15s), got ${dur}`,
  );

  const renderMeta = JSON.parse(fs.readFileSync(path.join(workdir, 'intro-simple', 'render.json'), 'utf8'));
  assert.equal(renderMeta.beats.length, 2);
  assert.equal(renderMeta.standIn, false);
});
