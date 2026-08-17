import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseTeaserRoot,
  parseMomentBanners,
  lintTeasers,
  renderArgs,
  TEASER_SECONDS,
  TEASER_WIDTH,
  TEASER_HEIGHT,
} from './teasers.mjs';
import { FILM_RENDERER } from '../renderer-constants.mjs';

const FIXTURES = path.join(import.meta.dirname, 'fixtures', 'teasers');

// The arc clauses the on-disk fixtures were written against — a/index.html
// carries 3 moment banners, b/index.html carries 2. Keep these in sync with
// the fixture files if either changes.
const ARC_A = [
  'five blank cards snap into a row',
  'one card fills, the others grey out',
  'the row collapses into a scored column',
];
const ARC_B = [
  'a single stat ticks up from zero',
  'the number locks and the title fades in',
];

// Inline builder for the unit-level lint codes (length/canvas/arc/root). Only
// the missing-teaser test below reads the real fixture tree — everything else
// is pure-string, per the injected-`read` design in teasers.mjs.
function html({
  duration = 6, width = 1920, height = 1080, moments = [1, 2, 3],
  compositionId = 'teaser-x', root = true, omitDuration = false,
} = {}) {
  const durationAttr = omitDuration ? '' : ` data-duration="${duration}"`;
  const rootTag = root
    ? `<div id="root" data-composition-id="${compositionId}" data-start="0"${durationAttr}\n     data-fps="30" data-width="${width}" data-height="${height}"></div>`
    : '<div id="root"></div>';
  const banners = moments.map((n) => `  /* ---------- m${n} : moment ---------- */`).join('\n');
  return `<!DOCTYPE html><html><body>\n${rootTag}\n<script>\n${banners}\n</script>\n</body></html>`;
}

const codes = (r) => r.errors.map((e) => e.code);

test('parseTeaserRoot reads id/duration/start/width/height', () => {
  const root = parseTeaserRoot(html());
  assert.equal(root.compositionId, 'teaser-x');
  assert.equal(root.duration, 6);
  assert.equal(root.start, 0);
  assert.equal(root.width, 1920);
  assert.equal(root.height, 1080);
});

test('parseTeaserRoot returns null when there is no composition root', () => {
  assert.equal(parseTeaserRoot(html({ root: false })), null);
});

test('parseMomentBanners returns the moment numbers in document order', () => {
  assert.deepEqual(parseMomentBanners(html({ moments: [1, 2, 3] })), [1, 2, 3]);
});

test('a valid two-direction idea lints clean against inline teasers', () => {
  const teasers = {
    a: html({ compositionId: 'teaser-a', moments: [1, 2, 3] }),
    b: html({ compositionId: 'teaser-b', moments: [1, 2] }),
  };
  const idea = { directions: [{ id: 'a', arc: ARC_A }, { id: 'b', arc: ARC_B }] };
  const read = (id) => teasers[id] ?? null;
  assert.deepEqual(lintTeasers({ idea, read }).errors, []);
});

test('IDEA-PREVIEW-MISSING when a direction has no teaser on disk — the mutation gate', () => {
  // Reads the ON-DISK fixture tree via fs, exactly as runLintTeasers does. This
  // is deliberate: `rm lib/intro-film/fixtures/teasers/b/index.html` must make
  // THIS assertion fail, printing IDEA-PREVIEW-MISSING, through the real lint
  // path — not against an inline string a mutation can't touch.
  const read = (id) => {
    const f = path.join(FIXTURES, id, 'index.html');
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  };
  const idea = { directions: [{ id: 'a', arc: ARC_A }, { id: 'b', arc: ARC_B }] };
  const { errors } = lintTeasers({ idea, read });
  assert.deepEqual(
    codes({ errors }),
    [],
    'every proposed direction needs an on-disk teaser — deleting fixtures/teasers/b/index.html must fail here with IDEA-PREVIEW-MISSING',
  );
});

test('IDEA-PREVIEW-LENGTH for a 4s teaser', () => {
  const idea = { directions: [{ id: 'a', arc: ARC_A }] };
  const read = () => html({ duration: 4, moments: [1, 2, 3] });
  assert.deepEqual(codes(lintTeasers({ idea, read })), ['IDEA-PREVIEW-LENGTH']);
});

test('IDEA-PREVIEW-LENGTH for a missing data-duration', () => {
  const idea = { directions: [{ id: 'a', arc: ARC_A }] };
  const read = () => html({ omitDuration: true, moments: [1, 2, 3] });
  assert.deepEqual(codes(lintTeasers({ idea, read })), ['IDEA-PREVIEW-LENGTH']);
});

test('IDEA-PREVIEW-CANVAS for a portrait root', () => {
  const idea = { directions: [{ id: 'a', arc: ARC_A }] };
  const read = () => html({ width: 1080, height: 1920, moments: [1, 2, 3] });
  assert.deepEqual(codes(lintTeasers({ idea, read })), ['IDEA-PREVIEW-CANVAS']);
});

test('IDEA-PREVIEW-ARC when the banner count does not match the arc clause count', () => {
  // 3 arc clauses, only 2 moment banners — a teaser covering 2 of 4 clauses
  // shows a smaller direction than the one the owner would be approving.
  const idea = { directions: [{ id: 'a', arc: ARC_A }] };
  const read = () => html({ moments: [1, 2] });
  assert.deepEqual(codes(lintTeasers({ idea, read })), ['IDEA-PREVIEW-ARC']);
});

test('trailing-zero formatting is not a length error', () => {
  const idea = { directions: [{ id: 'a', arc: ARC_A }] };
  const read = () => html({ duration: '6.00', moments: [1, 2, 3] });
  assert.deepEqual(lintTeasers({ idea, read }).errors, []);
});

test('renderArgs builds the exact hyperframes render invocation', () => {
  assert.deepEqual(
    renderArgs('a'),
    ['-y', FILM_RENDERER, 'render', 'a', '--fps', '30', '--format', 'mp4', '--quality', 'high', '-o', 'a.mp4'],
  );
});

test('TEASER_SECONDS/WIDTH/HEIGHT are the fixed values the gate compares directions on', () => {
  assert.equal(TEASER_SECONDS, 6);
  assert.equal(TEASER_WIDTH, 1920);
  assert.equal(TEASER_HEIGHT, 1080);
});
