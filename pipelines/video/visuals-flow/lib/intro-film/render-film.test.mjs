import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { renderArgs, renderFilm, renderAndDeliver } from './render-film.mjs';

test('renderArgs emits -o <file>.mp4, never a bare directory', () => {
  const args = renderArgs('renders/intro-film.mp4');
  assert.strictEqual(args[args.length - 2], '-o');
  assert.ok(args[args.length - 1].endsWith('.mp4'));
});

test('renderFilm throws when film/index.html is absent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'renderfilm-'));
  const fxDir = path.join(dir, 'videos', 'fx');
  const filmDir = path.join(fxDir, 'intro-film');
  fs.mkdirSync(filmDir, { recursive: true });

  assert.throws(() => {
    renderFilm(path.join(fxDir, 'intro-film'));
  }, /missing .*\/film\/index\.html/);
});

test('renderAndDeliver does NOT write out/intro.mp4 when the verdict fails', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'renderdeliver-'));
  const fxDir = path.join(dir, 'videos', 'fx');
  const filmDir = path.join(fxDir, 'intro-film');
  const rendersDir = path.join(filmDir, 'renders');
  
  fs.mkdirSync(rendersDir, { recursive: true });
  fs.mkdirSync(path.join(filmDir, 'film'), { recursive: true });
  fs.writeFileSync(path.join(fxDir, 'segments.json'), JSON.stringify({
    structure: [{ part: 'intro', start: 0, end: 6 }]
  }));
  fs.writeFileSync(path.join(filmDir, 'film', 'index.html'), '<html></html>');

  const fixtureFile = path.join(dir, 'fixture.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=gray:s=1920x1080:d=6', '-r', '30', '-pix_fmt', 'yuv420p', fixtureFile]);

  const binDir = path.join(dir, 'bin');
  fs.mkdirSync(binDir);
  const npxPath = path.join(binDir, 'npx');
  const script = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
fs.copyFileSync('${fixtureFile}', path.join(process.cwd(), 'renders', 'intro-film.mp4'));
process.exit(0);
`;
  fs.writeFileSync(npxPath, script);
  fs.chmodSync(npxPath, 0o755);

  const oldPath = process.env.PATH;
  process.env.PATH = `${binDir}:${oldPath}`;

  try {
    const res = renderAndDeliver(path.join(fxDir, 'intro-film'));
    assert.strictEqual(res.verdict.pass, false);
    assert.strictEqual(res.delivered, null);
    assert.strictEqual(fs.existsSync(path.join(filmDir, 'out', 'intro.mp4')), false);
  } finally {
    process.env.PATH = oldPath;
  }
});
