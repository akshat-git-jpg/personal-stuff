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
import { resolveWorkdir } from './workdir.mjs';

// Workdir-relative source -> the name the composition references under assets/.
// The composition must use `assets/<name>`, never `../<name>`.
export const FILM_MEDIA = ['vo.mp3', 'avatar.mp4'];

export function filmAssetsDir(slug) {
  return path.join(resolveWorkdir(slug), 'film', 'assets');
}

// Symlinks rather than copies: the avatar clip is megabytes and this runs
// before every review pass. Idempotent — an existing link is replaced, so a
// re-rendered avatar is always picked up.
export function linkFilmMedia(slug, { media = FILM_MEDIA } = {}) {
  const workdir = resolveWorkdir(slug);
  const assets = filmAssetsDir(slug);
  fs.mkdirSync(assets, { recursive: true });

  const linked = [];
  const missing = [];
  for (const name of media) {
    const src = path.join(workdir, '..', name);
    if (!fs.existsSync(src)) {
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
  return { linked, missing, dir: assets };
}
