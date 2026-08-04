import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { linkFilmMedia, filmAssetsDir, FILM_MEDIA } from './film-assets.mjs';

function tmpWorkdir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'film-assets-'));
  const dir = path.join(root, 'intro-film');
  fs.mkdirSync(path.join(dir, 'film'), { recursive: true });
  return dir;
}

test('links present media into film/assets and reports what is missing', () => {
  const dir = tmpWorkdir();
  fs.writeFileSync(path.join(dir, '..', 'vo.mp3'), 'audio');

  const res = linkFilmMedia(dir);

  assert.deepEqual(res.linked, ['vo.mp3']);
  assert.deepEqual(res.missing, ['avatar.mp4']);
  assert.equal(fs.readFileSync(path.join(filmAssetsDir(dir), 'vo.mp3'), 'utf8'), 'audio');
});

test('re-linking picks up a replaced source instead of failing on EEXIST', () => {
  const dir = tmpWorkdir();
  const src = path.join(dir, '..', 'avatar.mp4');
  fs.writeFileSync(src, 'take-1');
  linkFilmMedia(dir);

  fs.writeFileSync(src, 'take-2');
  const res = linkFilmMedia(dir);

  assert.deepEqual(res.linked, ['avatar.mp4']);
  assert.equal(fs.readFileSync(path.join(filmAssetsDir(dir), 'avatar.mp4'), 'utf8'), 'take-2');
});

test('a link left dangling by a deleted source is replaced, not thrown on', () => {
  const dir = tmpWorkdir();
  const src = path.join(dir, '..', 'vo.mp3');
  fs.writeFileSync(src, 'audio');
  linkFilmMedia(dir);

  // The dangling link fails existsSync but still occupies the path.
  fs.rmSync(src);
  fs.writeFileSync(src, 'audio-2');

  assert.doesNotThrow(() => linkFilmMedia(dir));
  assert.equal(fs.readFileSync(path.join(filmAssetsDir(dir), 'vo.mp3'), 'utf8'), 'audio-2');
});

test('FILM_MEDIA covers exactly the media the composition cannot inline', () => {
  assert.deepEqual([...FILM_MEDIA].sort(), ['avatar.mp4', 'vo.mp3']);
});
