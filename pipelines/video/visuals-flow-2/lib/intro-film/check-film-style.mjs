// Static gate on the film's type scale and timeline coverage. Runs before any
// render, from the HTML alone.
//
// The type rules are DESIGN.md's, ported from card-library/scripts/check-type-scale.mjs
// (read, never edited — card-library is off limits from here). They exist because
// the first poc-01 film shipped with a largest-text of 54px on a 1080p frame and
// nothing caught it: the film was authored against brand.json's five colour
// tokens, with no typography contract in scope at all.
//
// The timeline rule is film-specific and has no card equivalent. A card is one
// held composition; a film is twelve, and a beat with no tween in it is a beat
// the viewer reads as a slide. The post-render gate catches this as G2 frozen
// picture, minutes and one encode too late.
import fs from 'node:fs';

export const STYLE = {
  HERO_MIN: 120,      // px on a 1080-tall frame. DESIGN.md hero is 120-200.
  HERO_RATIO_MIN: 2.5,
  HERO_RATIO_MAX: 4,  // hierarchy is a spread, not a cliff (owner, 2026-07-31)
  BODY_MIN: 40,       // DESIGN.md secondary is 40-56
};

// Strip CSS comments before matching: a film that DOCUMENTS why it sets a value
// would otherwise have its own prose read as a live declaration.
function styleOf(html) {
  const css = html.split('</style>')[0] ?? '';
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function scriptOf(html) {
  return [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
}

// Every GSAP timeline call carries its position as the argument after the vars
// object: tl.to('#sel', { ... }, 13.7). Labels are not used in authored films.
export function timelinePositions(script) {
  return [...script.matchAll(/\},\s*(\d+(?:\.\d+)?)\s*\)/g)].map((m) => Number(m[1]));
}

// A beat is "covered" if any tween STARTS inside it. A tween that merely spans
// the beat does not count: the beat needs a move of its own, or it is a hold.
export function uncoveredBeats(beats, positions) {
  return beats
    .filter((b) => !positions.some((p) => p >= b.t_start && p < b.t_end))
    .map((b) => b.id);
}

export function checkFilmStyle({ html, screenplay }) {
  const errors = [];
  const css = styleOf(html);

  const heroDecl = css.match(/--hero-size:\s*(\d+)px/);
  if (!heroDecl) {
    errors.push('no --hero-size declared in :root (DESIGN.md → Typography)');
  } else {
    const hero = Number(heroDecl[1]);
    if (hero < STYLE.HERO_MIN) {
      errors.push(`--hero-size is ${hero}px, minimum is ${STYLE.HERO_MIN}px`);
    }
    if (!/font-size:\s*var\(--hero-size\)/.test(css)) {
      errors.push('--hero-size is declared but never used as a font-size');
    }
    const bodyDecl = css.match(/--body-size:\s*(\d+)px/);
    if (!bodyDecl) {
      errors.push('no --body-size declared — the hero ratio cannot be checked');
    } else {
      const body = Number(bodyDecl[1]);
      if (body < STYLE.BODY_MIN) {
        errors.push(`--body-size is ${body}px, floor is ${STYLE.BODY_MIN}px on a 1080p frame`);
      }
      if (!/font-size:\s*var\(--body-size\)/.test(css)) {
        errors.push('--body-size is declared but never used as a font-size');
      }
      const ratio = hero / body;
      if (ratio < STYLE.HERO_RATIO_MIN) {
        errors.push(`hero ${hero}px vs body ${body}px = ${ratio.toFixed(2)}x, needs >= ${STYLE.HERO_RATIO_MIN}x — the film reads flat`);
      }
      if (ratio > STYLE.HERO_RATIO_MAX) {
        errors.push(`hero ${hero}px vs body ${body}px = ${ratio.toFixed(2)}x, max ${STYLE.HERO_RATIO_MAX}x — bring the hero down or the body up`);
      }
    }
  }

  // Tracking must be em-based on large type: a fixed -1.5px reads as tight at
  // 40px and as nothing at 160px, so a px value silently stops working the
  // moment the hero grows.
  if (!/letter-spacing:\s*-0?\.\d+em/.test(css)) {
    errors.push('no em-based negative letter-spacing found — hero type needs letter-spacing: -0.035em, not a px value');
  }
  if (!/color:\s*var\(--accent\)/.test(css)) {
    errors.push('no text element uses color: var(--accent) — every composition accents one word or label');
  }

  const beats = screenplay?.beats ?? [];
  if (beats.length) {
    const uncovered = uncoveredBeats(beats, timelinePositions(scriptOf(html)));
    if (uncovered.length) {
      errors.push(`beat(s) with no tween starting inside them, so the picture holds: ${uncovered.join(', ')}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function checkFilmStyleFiles(htmlFile, screenplayFile) {
  return checkFilmStyle({
    html: fs.readFileSync(htmlFile, 'utf8'),
    screenplay: JSON.parse(fs.readFileSync(screenplayFile, 'utf8')),
  });
}
