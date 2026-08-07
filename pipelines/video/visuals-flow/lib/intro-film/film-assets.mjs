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
// contract is authored per video. A 1-second still video keeps every
// composition, every hyperframes check and every selector working unchanged.
export function buildAvatarStandIn(slug, imagePath) {
  const dest = path.join(filmAssetsDir(slug), 'avatar.mp4');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.lstatSync(dest, { throwIfNoEntry: false })) fs.rmSync(dest);
  execFileSync('ffmpeg', [
    '-loop', '1', '-i', imagePath, '-t', '1', '-r', '30',
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080',
    '-pix_fmt', 'yuv420p', '-y', dest,
  ], { stdio: 'pipe' });
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
