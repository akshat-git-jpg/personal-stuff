// The film composition has to be SELF-CONTAINED before any diagnostic works.
//
// hyperframes lint raises an error for every asset path that traverses above
// the project root, and `hyperframes check` runs its passes in order: when lint
// errors, the layout, motion and contrast passes never sample anything. The
// result is a report that says `layout: ok` with `samples: []` — green because
// it did nothing. The film's own media (the voiceover and the avatar clip) live
// one level up in the workdir, so every check on this project was vacuous.
//
// Linking the media INTO film/assets/ is what turns the real checker on.
// film/assets/ is already gitignored, so these are build artifacts, not content.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveWorkdir } from './workdir.mjs';

// Workdir-relative source -> the name the composition references under assets/.
// The composition must use `assets/<name>`, never `../<name>`.
export const FILM_MEDIA = ['vo.mp3', 'avatar.mp4'];

// The avatar stand-in used by every pre-render intro build. Deliberately ONE
// hardcoded real photograph rather than a per-character lookup: the stand-in is
// judged for framing, size and grade against the design, never for who it is
// (owner 2026-08-07 — "use any avatar image, hardcode it. doesn't matter").
// A real photo and not a generated grey figure, because a grey figure is the
// "no avatar set" icon and gets reviewed as final art (owner, three times:
// 2026-08-06 silhouettes and dashed wells, 2026-08-07 the drawing seal).
export const STAND_IN_IMAGE = path.resolve(
  import.meta.dirname, '..', '..', '..', 'heygen', 'characters', 'side-avatar', 'source.jpeg',
);

export function filmAssetsDir(slug) {
  return path.join(resolveWorkdir(slug), 'film', 'assets');
}

// The avatar is a STILL until the render phase (owner 2026-08-07). Every review
// before 4xx judges motion graphics, and the one avatar defect this film hit —
// a daylight-lit room against a near-black field — is a grade mismatch a still
// shows as well as video. So we do not spend HeyGen seconds to review a card.
//
// It is encoded to mp4 rather than linked as an image ON PURPOSE: the
// composition references `assets/avatar.mp4` in a <video> element, and that
// contract is authored per video. A still video keeps every composition, every
// hyperframes check and every selector working unchanged.
//
// It has to be LONGER THAN THE FILM, which the first version was not. At one
// second against a 113s intro the stand-in painted the presenter for frame 0
// and nothing after: every face:panel and face:full beat reviewed as an empty
// right-hand panel. That is the exact opposite of what the stand-in is for —
// the reviewer judges composition against a frame the film will never produce,
// and the space the presenter occupies looks free for a device to move into.
// Cheap to be generous: the content is one repeated still, so 1fps for five
// minutes is a handful of KB and covers any intro this pipeline will make.
const STAND_IN_SECONDS = 300;

export function buildAvatarStandIn(slug, imagePath, { seconds = STAND_IN_SECONDS } = {}) {
  const dest = path.join(filmAssetsDir(slug), 'avatar.mp4');
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  // Rebuilding is both wasteful and, on Windows, the thing that breaks the run.
  // The stand-in is a pure function of (image, seconds), so an existing one
  // built from the same inputs is already correct — re-encoding 300s of a still
  // on every review pass only creates a window for someone else to be holding
  // the file. The board server streams film/assets to the UI and holds exactly
  // this file open, which is not a fault to fix but a reader doing its job.
  // The marker records the inputs, so changing either still forces a rebuild.
  const marker = path.join(path.dirname(dest), '.avatar-standin.json');
  const want = { image: imagePath, seconds, mtime: fs.statSync(imagePath).mtimeMs };
  if (fs.existsSync(dest)) {
    try {
      const have = JSON.parse(fs.readFileSync(marker, 'utf8'));
      if (have.image === want.image && have.seconds === want.seconds && have.mtime === want.mtime) return dest;
    } catch { /* no marker or unreadable — fall through and rebuild */ }
  }

  // Windows keeps a handle on this file for a beat after the ffmpeg that wrote
  // it exits, and holds it for the whole run when a review pass is building its
  // own stand-in at the same time — so a bare rmSync throws EPERM and takes the
  // render down before hyperframes ever starts. `force` does not help: it only
  // swallows ENOENT. Retry the unlock race; if it is still held after a second
  // the holder is another run rather than a lingering handle, so say so instead
  // of surfacing a bare EPERM path with no cause attached.
  if (fs.lstatSync(dest, { throwIfNoEntry: false })) {
    try {
      fs.rmSync(dest, { maxRetries: 10, retryDelay: 100 });
    } catch (e) {
      throw new Error(
        `cannot replace ${dest} (${e.code}) — another intro render or review is ` +
        'running for this video. Wait for it to finish, then re-run.',
      );
    }
  }
  // Encode to a temp name and rename into place. A killed ffmpeg — a timeout, a
  // Ctrl-C, a crashed parent — leaves an mp4 with no moov atom, and a truncated
  // mp4 is not a loud failure: the <video> element simply never paints, so the
  // presenter silently disappears from every frame and the film reviews as if
  // she were not in it. Writing straight to `dest` means any interruption
  // publishes that corruption under the real name, and the marker above would
  // then vouch for it on every later run. The destination now only ever holds a
  // file ffmpeg finished writing.
  // The temp name keeps the .mp4 extension: ffmpeg picks its muxer from the
  // output extension, and `avatar.mp4.tmp-1234` makes it bail with "unable to
  // choose an output format" before it writes a byte.
  const tmp = path.join(path.dirname(dest), `avatar.tmp-${process.pid}.mp4`);
  try {
    execFileSync('ffmpeg', [
      // -framerate BEFORE -i, not just -r after it. The image demuxer defaults
      // to 25fps, so `-r 1` alone is an OUTPUT rate that throws away 24 of every
      // 25 frames — on this ffmpeg build that degenerates to `frame=0` with a
      // climbing `drop=` and the encode never emits anything. It does not fail:
      // it spins until something kills it and leaves a moov-less mp4 behind,
      // which is how a "hung stand-in" wedged four intro renders on 2026-08-16.
      '-framerate', '1', '-loop', '1', '-i', imagePath, '-t', String(seconds), '-r', '1',
      '-vf', 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080',
      '-pix_fmt', 'yuv420p', '-y', tmp,
      // stdio 'ignore', not 'pipe'. Nothing reads ffmpeg's output, and a piped
      // child that fills the OS pipe buffer blocks on write forever while the
      // parent sits in execFileSync — which is exactly the symptom seen here
      // twice: an ffmpeg alive for minutes with its output file at 0 bytes and
      // the review step frozen with nothing printed. Discarding the stream
      // removes the deadlock rather than tuning maxBuffer around it.
    ], { stdio: 'ignore' });
    fs.renameSync(tmp, dest);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
  fs.writeFileSync(marker, JSON.stringify(want));
  return dest;
}

// Symlinks rather than copies: the avatar clip is megabytes and this runs
// before every review pass. Idempotent — an existing link is replaced, so a
// re-rendered avatar is always picked up.
//
// `standInImage`: when the real avatar.mp4 is missing AND this is supplied,
// build a stand-in in its place instead of just reporting it missing. The
// `standIn` field on the result is how a caller tells a real avatar apart
// from a stand-in — a caller that cannot tell the two apart will eventually
// ship one as the other.
export function linkFilmMedia(slug, { media = FILM_MEDIA, standInImage = null } = {}) {
  const workdir = resolveWorkdir(slug);
  const assets = filmAssetsDir(slug);
  fs.mkdirSync(assets, { recursive: true });

  const linked = [];
  const missing = [];
  let standIn = false;
  for (const name of media) {
    const src = path.join(workdir, '..', name);
    if (!fs.existsSync(src)) {
      if (name === 'avatar.mp4' && standInImage) {
        buildAvatarStandIn(slug, standInImage);
        linked.push(name);
        standIn = true;
        continue;
      }
      missing.push(name);
      continue;
    }
    const dest = path.join(assets, name);
    // lstat, not exists: a link pointing at a deleted file fails existsSync but
    // still occupies the path, and symlinkSync would throw EEXIST on it.
    if (fs.lstatSync(dest, { throwIfNoEntry: false })) fs.rmSync(dest);
    fs.symlinkSync(path.resolve(src), dest);
    linked.push(name);
  }
  return { linked, missing, dir: assets, standIn };
}
