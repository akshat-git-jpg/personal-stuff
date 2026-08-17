// The guard that keeps `screenplay.json` and `film/index.html` describing the
// SAME film.
//
// They are two files about one thing and nothing checked that they agreed.
// lint-screenplay.mjs validates the screenplay against itself and the
// transcript; it never opens the composition. render-film.mjs and
// review-film.mjs only check that index.html EXISTS.
//
// That gap is not cosmetic, because the review pass reads beat times from the
// screenplay and screenshots the composition:
//
//   beatSampleTimes(screenplay)  ->  t = 24.0
//   hyperframes snapshot index.html --at 24.0
//
// So a timing patched in the composition and not in the screenplay does not
// produce a visibly broken film — it produces a review that photographs the
// WRONG MOMENTS, prints each frame under the stage line it was supposed to
// satisfy, and reads as if the film is broken when it is only mis-sampled.
// The author then "fixes" frames that were never wrong.
//
// The link is made checkable by the beat banner comment the authored films
// already carry, one per beat, in screenplay order:
//
//   /* ---------- b01 hook 0 -> 11.36 : faces flicker, nothing settles ------ */
//
// That banner is now a CONTRACT, not a nicety: id, intent and both timestamps
// must match the screenplay beat. It costs the author nothing (the convention
// was already being followed) and it is the only thing tying the two files
// together, so it is enforced rather than remembered.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveWorkdir } from './workdir.mjs';

// Timestamps are authored to 2dp on both sides; 0.005 is half of the last
// place, so "15.1" and "15.10" agree and a real 0.01s edit does not.
export const SYNC_EPSILON = 0.005;

// `-->`, `->` and an em-dash arrow are all accepted: the banner is written by
// hand and an arrow variant is not a drift signal. The trailing `:` and its
// description are optional — the description is prose for a human reader and
// is deliberately NOT compared.
const BANNER_RE = /\/\*\s*-*\s*(b\d+)\s+(\S+)\s+(\d+(?:\.\d+)?)\s*(?:->|-->|→)\s*(\d+(?:\.\d+)?)\s*(?::|-|\*)/g;

// data-duration on the composition root is what Hyperframes renders to. It is
// required by the authoring contract and lint errors without it, so its absence
// here is a broken composition rather than an unsupported style.
export function parseFilmRoot(html) {
  const rootTag = html.match(/<[^>]*\bdata-composition-id\s*=\s*"[^"]*"[^>]*>/);
  if (!rootTag) return null;
  const attr = (name) => {
    const m = rootTag[0].match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`));
    return m ? m[1] : null;
  };
  const duration = attr('data-duration');
  return {
    compositionId: attr('data-composition-id'),
    duration: duration == null ? null : Number(duration),
    start: attr('data-start') == null ? null : Number(attr('data-start')),
  };
}

export function parseBeatBanners(html) {
  const out = [];
  BANNER_RE.lastIndex = 0;
  let m;
  while ((m = BANNER_RE.exec(html)) !== null) {
    out.push({ id: m[1], intent: m[2], t_start: Number(m[3]), t_end: Number(m[4]) });
  }
  return out;
}

const near = (a, b) => Math.abs(a - b) <= SYNC_EPSILON;

export function checkFilmSync({ screenplay, html }) {
  const errors = [];
  const beats = screenplay?.beats ?? [];

  const root = parseFilmRoot(html);
  if (!root) {
    errors.push({
      code: 'S1',
      message: 'no element with data-composition-id in film/index.html — the composition root is missing',
    });
    // Everything below reads from the root or the beats; without a root there
    // is nothing coherent left to compare against.
    return { errors, root: null, banners: [] };
  }

  // The film's own span. introSpan() is deliberately not consulted: this check
  // asks whether the TWO AUTHORED FILES agree, and lint-screenplay already
  // owns "does the screenplay match the measured intro".
  if (beats.length) {
    const spanEnd = beats[beats.length - 1].t_end;
    if (root.duration == null) {
      errors.push({ code: 'S2', message: 'composition root has no data-duration' });
    } else if (!near(root.duration, spanEnd)) {
      errors.push({
        code: 'S2',
        message: `data-duration ${root.duration} != screenplay end ${spanEnd} `
          + `(the render would be ${(root.duration - spanEnd).toFixed(2)}s ${root.duration > spanEnd ? 'longer' : 'shorter'} than the beats)`,
      });
    }
  }

  const banners = parseBeatBanners(html);
  if (beats.length && !banners.length) {
    errors.push({
      code: 'S3',
      message: 'no beat banner comments found in film/index.html. Every beat needs one, '
        + 'in screenplay order: /* ---------- b01 hook 0 -> 11.36 : what happens ---------- */',
    });
    return { errors, root, banners };
  }

  if (banners.length !== beats.length) {
    errors.push({
      code: 'S3',
      message: `${banners.length} beat banner(s) in film/index.html but ${beats.length} beat(s) in screenplay.json`,
    });
  }

  // Positional, not keyed by id: a banner in the wrong ORDER is drift too, and
  // matching by id would quietly accept a reordered timeline.
  const n = Math.min(banners.length, beats.length);
  for (let i = 0; i < n; i++) {
    const banner = banners[i];
    const beat = beats[i];
    if (banner.id !== beat.id) {
      errors.push({ code: 'S4', beat: beat.id, message: `banner ${i + 1} is '${banner.id}' but screenplay beat ${i + 1} is '${beat.id}'` });
      continue;
    }
    if (banner.intent !== beat.intent) {
      errors.push({ code: 'S5', beat: beat.id, message: `${beat.id} intent: film says '${banner.intent}', screenplay says '${beat.intent}'` });
    }
    if (!near(banner.t_start, beat.t_start)) {
      errors.push({ code: 'S6', beat: beat.id, message: `${beat.id} t_start: film says ${banner.t_start}, screenplay says ${beat.t_start}` });
    }
    if (!near(banner.t_end, beat.t_end)) {
      errors.push({ code: 'S6', beat: beat.id, message: `${beat.id} t_end: film says ${banner.t_end}, screenplay says ${beat.t_end}` });
    }
  }

  return { errors, root, banners };
}

export function runFilmSync(slug) {
  const workdir = resolveWorkdir(slug);
  const htmlFile = path.join(workdir, 'film', 'index.html');
  const screenplayFile = path.join(workdir, 'screenplay.json');
  if (!fs.existsSync(htmlFile)) throw new Error(`missing ${htmlFile} — author the film first (130)`);
  if (!fs.existsSync(screenplayFile)) throw new Error(`missing ${screenplayFile} — author the film first (130)`);
  const screenplay = JSON.parse(fs.readFileSync(screenplayFile, 'utf8'));
  const html = fs.readFileSync(htmlFile, 'utf8');
  return checkFilmSync({ screenplay, html });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const slug = process.argv[2];
  if (!slug) {
    console.error('usage: node lib/intro-film/check-film-sync.mjs <slug-or-path>');
    process.exit(1);
  }
  try {
    const { errors, banners } = runFilmSync(slug);
    for (const e of errors) console.error(`${e.code} film-sync: ${e.message}`);
    if (errors.length) {
      console.error(`\nscreenplay.json and film/index.html disagree. Fix BOTH, then re-run.`);
      process.exit(1);
    }
    console.log(`film-sync: ok (${banners.length} beats agree)`);
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
