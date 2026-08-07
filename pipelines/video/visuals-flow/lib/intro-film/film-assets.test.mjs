import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { linkFilmMedia, filmAssetsDir, FILM_MEDIA, STAND_IN_IMAGE, buildAvatarStandIn } from './film-assets.mjs';

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

test('STAND_IN_IMAGE resolves to a real photograph already in the repo', () => {
  assert.ok(fs.existsSync(STAND_IN_IMAGE), `${STAND_IN_IMAGE} must exist`);
});

// The whole point of the stand-in: a review before any HeyGen second is spent
// still gets a video file at exactly the path the composition references.
test('linkFilmMedia builds a stand-in when avatar.mp4 is missing and standInImage is supplied', () => {
  const dir = tmpWorkdir();
  fs.writeFileSync(path.join(dir, '..', 'vo.mp3'), 'audio');

  const res = linkFilmMedia(dir, { standInImage: STAND_IN_IMAGE });

  assert.equal(res.standIn, true);
  assert.deepEqual(res.missing, []);
  assert.ok(res.linked.includes('avatar.mp4'));

  const dest = path.join(filmAssetsDir(dir), 'avatar.mp4');
  assert.ok(fs.existsSync(dest));
  const probe = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', dest,
  ], { encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stderr);
  assert.equal(probe.stdout.trim(), '1920,1080');
});

// A real avatar.mp4 must always win — the stand-in exists to fill a GAP, not
// to shadow a real file that is already there.
test('linkFilmMedia leaves standIn false when the real avatar.mp4 is present', () => {
  const dir = tmpWorkdir();
  const src = path.join(dir, '..', 'avatar.mp4');
  fs.writeFileSync(src, 'real avatar bytes');

  const res = linkFilmMedia(dir, { standInImage: STAND_IN_IMAGE });

  assert.equal(res.standIn, false);
  assert.equal(fs.readFileSync(path.join(filmAssetsDir(dir), 'avatar.mp4'), 'utf8'), 'real avatar bytes');
});

test('linkFilmMedia with no standInImage keeps the old behaviour: avatar.mp4 just reported missing', () => {
  const dir = tmpWorkdir();
  const res = linkFilmMedia(dir);
  assert.equal(res.standIn, false);
  assert.ok(res.missing.includes('avatar.mp4'));
});

test('buildAvatarStandIn overwrites a previous stand-in rather than throwing EEXIST', () => {
  const dir = tmpWorkdir();
  const first = buildAvatarStandIn(dir, STAND_IN_IMAGE);
  const mtimeFirst = fs.statSync(first).mtimeMs;
  assert.doesNotThrow(() => buildAvatarStandIn(dir, STAND_IN_IMAGE));
  assert.ok(fs.existsSync(first));
  assert.ok(fs.statSync(first).mtimeMs >= mtimeFirst);
});
