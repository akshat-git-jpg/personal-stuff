import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderSimple, buildBeatVars } from './render-simple.mjs';
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
      { id: 'b02', kind: 'card', card: 'slate/kinetic-sentence', t_start: 3.0, t_end: SPAN, vars: { text: 'Hello world', beats: [] } },
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

// --- buildBeatVars: the variables contract the two shipped defects broke ---
//
// Both defects (plan 229 imported the enrichers and never called them; the
// renderer never injected `duration` although S4 told authors it did) passed
// the gate because nothing could see the variables object. These three tests
// are that gate. They spend no render — buildBeatVars is pure enough to call
// directly, which is the whole reason it was pulled out of renderCardBeat.

test('buildBeatVars injects the beat length as `duration`, overriding anything authored — the four ported kit cards scale their motion schedule to VARS.duration, so a missing one silently ran a 3.5s schedule inside a 2.5s cut', (t) => {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'intro-vars-dur-'));
  t.after(() => fs.rmSync(workdir, { recursive: true, force: true }));

  const beat = { id: 'b01', kind: 'card', card: 'enacted/ui-mock', t_start: 3.0, t_end: 5.5, vars: { appName: 'Zap' } };
  const vars = buildBeatVars(beat, { workdir, duration: 2.5 });
  assert.equal(vars.duration, 2.5, 'the renderer owns duration — S4 refuses an authored one on exactly this promise');
  assert.equal(vars.appName, 'Zap', 'authored variables survive alongside it');

  // Renderer-owned means renderer WINS, not "renderer defers". A cut list that
  // slipped a duration past the lint must still render at its beat length.
  const authored = buildBeatVars({ ...beat, vars: { appName: 'Zap', duration: 9 } }, { workdir, duration: 2.5 });
  assert.equal(authored.duration, 2.5, 'an authored duration is overwritten, never merged over');
});

test('buildBeatVars inlines a workdir image as a data URI — a staged card renders from a temp dir where a workdir-relative src resolves to nothing', (t) => {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'intro-vars-img-'));
  t.after(() => fs.rmSync(workdir, { recursive: true, force: true }));

  // A 1x1 PNG is enough: the assertion is that the path became a data URI,
  // not what the pixels are.
  const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  fs.mkdirSync(path.join(workdir, 'shots'), { recursive: true });
  fs.writeFileSync(path.join(workdir, 'shots', 'a.png'), PNG_1PX);

  const beat = { id: 'b02', kind: 'card', card: 'enacted/shot-float', t_start: 0, t_end: 3, vars: { text: 'x', shots: ['shots/a.png'] } };
  const vars = buildBeatVars(beat, { workdir, duration: 3 });
  assert.ok(vars.shots[0].startsWith('data:image/png;base64,'), `expected a data URI, got ${vars.shots[0]}`);
});

test('buildBeatVars inlines logo slugs under __logos — without it a logo-grid beat renders empty tiles', (t) => {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'intro-vars-logo-'));
  t.after(() => fs.rmSync(workdir, { recursive: true, force: true }));

  const beat = { id: 'b03', kind: 'card', card: 'tool-icon/logo-grid', t_start: 0, t_end: 3, vars: { text: 'x', productLogos: ['heygen', 'n8n'] } };
  const vars = buildBeatVars(beat, { workdir, duration: 3 });
  assert.ok(vars.__logos, 'enrichLogos never ran');
  assert.ok(vars.__logos.heygen?.startsWith('data:'), 'heygen was not inlined');
  assert.ok(vars.__logos.n8n?.startsWith('data:'), 'n8n was not inlined');
});
