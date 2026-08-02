import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFilmStyle, timelinePositions, uncoveredBeats, STYLE } from './check-film-style.mjs';

const goodCss = `
  :root { --hero-size: 140px; --body-size: 44px; --accent: #fb923c; }
  .hero { font-size: var(--hero-size); letter-spacing: -0.035em; }
  .body { font-size: var(--body-size); }
  .label { color: var(--accent); }
`;
const screenplay = {
  beats: [
    { id: 'b01', t_start: 0, t_end: 5 },
    { id: 'b02', t_start: 5, t_end: 10 },
  ],
};
const goodScript = `
  tl.to('#a', { opacity: 1 }, 0);
  tl.to('#b', { y: 10 }, 6.5);
`;
const film = (css = goodCss, script = goodScript) =>
  `<style>${css}</style><body><script>${script}</script></body>`;

test('a film meeting the DESIGN.md type contract passes', () => {
  const r = checkFilmStyle({ html: film(), screenplay });
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
});

test('the 54px-largest-text failure that shipped the first film is caught', () => {
  const r = checkFilmStyle({
    html: film(goodCss.replace('--hero-size: 140px', '--hero-size: 54px')),
    screenplay,
  });
  assert.ok(r.errors.some((e) => e.includes(`minimum is ${STYLE.HERO_MIN}px`)), r.errors.join('; '));
});

test('a hero declared but never used as a font-size is caught', () => {
  const css = goodCss.replace('font-size: var(--hero-size);', 'font-size: 54px;');
  const r = checkFilmStyle({ html: film(css), screenplay });
  assert.ok(r.errors.some((e) => e.includes('never used as a font-size')), r.errors.join('; '));
});

test('a hero-to-body spread outside 2.5x-4x is caught at both ends', () => {
  const flat = checkFilmStyle({ html: film(goodCss.replace('--body-size: 44px', '--body-size: 120px')), screenplay });
  assert.ok(flat.errors.some((e) => e.includes('reads flat')), flat.errors.join('; '));

  const cliff = checkFilmStyle({ html: film(goodCss.replace('--body-size: 44px', '--body-size: 40px').replace('--hero-size: 140px', '--hero-size: 200px')), screenplay });
  assert.ok(cliff.errors.some((e) => e.includes(`max ${STYLE.HERO_RATIO_MAX}x`)), cliff.errors.join('; '));
});

test('px letter-spacing on hero type is rejected in favour of em', () => {
  const r = checkFilmStyle({ html: film(goodCss.replace('-0.035em', '-1.5px')), screenplay });
  assert.ok(r.errors.some((e) => e.includes('em-based negative letter-spacing')), r.errors.join('; '));
});

test('a film that accents nothing is caught', () => {
  const r = checkFilmStyle({ html: film(goodCss.replace('color: var(--accent);', 'color: #fff;')), screenplay });
  assert.ok(r.errors.some((e) => e.includes('var(--accent)')), r.errors.join('; '));
});

test('prose in a CSS comment is not read as a live declaration', () => {
  const css = `/* --hero-size: 140px is deliberately absent here */ .a { color: var(--accent); letter-spacing: -0.035em; }`;
  const r = checkFilmStyle({ html: film(css), screenplay });
  assert.ok(r.errors.some((e) => e.includes('no --hero-size declared')), r.errors.join('; '));
});

test('timeline positions are read off the GSAP position argument', () => {
  assert.deepEqual(timelinePositions(goodScript), [0, 6.5]);
  assert.deepEqual(timelinePositions("gsap.set('#a', { opacity: 0 });"), [], 'set() carries no position');
});

test('a beat with no tween starting inside it is flagged as a hold', () => {
  assert.deepEqual(uncoveredBeats(screenplay.beats, [0, 6.5]), []);
  assert.deepEqual(uncoveredBeats(screenplay.beats, [0, 1.2]), ['b02']);
  assert.deepEqual(uncoveredBeats(screenplay.beats, []), ['b01', 'b02']);
});

test('a tween that merely spans a beat does not cover it', () => {
  // A move starting at 0 and running long still leaves b02 without a beat of
  // its own — that is exactly the "reads as a slide" defect.
  const r = checkFilmStyle({ html: film(goodCss, "tl.to('#a', { opacity: 1, duration: 9 }, 0);"), screenplay });
  assert.ok(r.errors.some((e) => e.includes('b02')), r.errors.join('; '));
});
