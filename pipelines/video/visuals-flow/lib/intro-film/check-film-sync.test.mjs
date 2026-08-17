import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFilmRoot, parseBeatBanners, checkFilmSync, SYNC_EPSILON } from './check-film-sync.mjs';

const beats = [
  { id: 'b01', intent: 'hook', t_start: 0, t_end: 11.36 },
  { id: 'b02', intent: 'stakes', t_start: 11.36, t_end: 15.1 },
  { id: 'b03', intent: 'button', t_start: 15.1, t_end: 22.9 },
];

const banner = (id, intent, a, b) =>
  `  /* ---------- ${id} ${intent} ${a} -> ${b} : something happens ---------- */`;

function film({ duration = 22.9, rows = beats, root = true } = {}) {
  const head = root
    ? `<div id="root" data-composition-id="intro" data-start="0" data-duration="${duration}"\n     data-fps="30" data-width="1920" data-height="1080">`
    : '<div id="root">';
  return [
    '<!DOCTYPE html><html><body>',
    head,
    '</div><script>',
    ...rows.map((b) => banner(b.id, b.intent, b.t_start, b.t_end)),
    '</script></body></html>',
  ].join('\n');
}

const codes = (r) => r.errors.map((e) => e.code);

test('parseFilmRoot reads the composition root attributes', () => {
  const root = parseFilmRoot(film());
  assert.equal(root.compositionId, 'intro');
  assert.equal(root.duration, 22.9);
  assert.equal(root.start, 0);
});

test('parseFilmRoot returns null when there is no composition root', () => {
  assert.equal(parseFilmRoot(film({ root: false })), null);
});

test('parseBeatBanners reads every banner in document order', () => {
  const found = parseBeatBanners(film());
  assert.deepEqual(found.map((b) => b.id), ['b01', 'b02', 'b03']);
  assert.deepEqual(found[1], { id: 'b02', intent: 'stakes', t_start: 11.36, t_end: 15.1 });
});

test('parseBeatBanners accepts the arrow variants an author might type', () => {
  const html = [
    '  /* ---------- b01 hook 0 --> 11.36 : a ---------- */',
    '  /* ---------- b02 stakes 11.36 → 15.1 : b ---------- */',
  ].join('\n');
  assert.deepEqual(parseBeatBanners(html).map((b) => b.id), ['b01', 'b02']);
});

test('a film that matches its screenplay passes', () => {
  const r = checkFilmSync({ screenplay: { beats }, html: film() });
  assert.deepEqual(r.errors, []);
  assert.equal(r.banners.length, 3);
});

test('S1 — a composition with no root is reported and comparison stops', () => {
  const r = checkFilmSync({ screenplay: { beats }, html: film({ root: false }) });
  assert.deepEqual(codes(r), ['S1']);
  assert.equal(r.root, null);
});

test('S2 — data-duration disagreeing with the last beat end is an error', () => {
  const r = checkFilmSync({ screenplay: { beats }, html: film({ duration: 24.5 }) });
  assert.deepEqual(codes(r), ['S2']);
  assert.match(r.errors[0].message, /1\.60s longer/);
});

test('S2 — trailing-zero formatting is not drift', () => {
  // 15.1 in the screenplay, "15.10" in the film. The whole check is worthless
  // if it cries wolf on how a number was typed.
  const rows = [{ id: 'b01', intent: 'hook', t_start: 0, t_end: '15.10' }];
  const r = checkFilmSync({
    screenplay: { beats: [{ id: 'b01', intent: 'hook', t_start: 0, t_end: 15.1 }] },
    html: film({ duration: '15.100', rows }),
  });
  assert.deepEqual(r.errors, []);
});

test('S3 — a film with no banners at all names the required format', () => {
  const r = checkFilmSync({ screenplay: { beats }, html: film({ rows: [] }) });
  assert.deepEqual(codes(r), ['S3']);
  assert.match(r.errors[0].message, /b01 hook 0 -> 11\.36/);
});

test('S3 — a beat dropped from the film is caught by count', () => {
  const r = checkFilmSync({ screenplay: { beats }, html: film({ rows: beats.slice(0, 2) }) });
  assert.ok(codes(r).includes('S3'));
});

test('S4 — reordered beats fail even though every id is present', () => {
  const swapped = [beats[1], beats[0], beats[2]];
  const r = checkFilmSync({ screenplay: { beats }, html: film({ rows: swapped }) });
  assert.ok(codes(r).includes('S4'));
});

test('S5 — an intent changed in one file only is caught', () => {
  const rows = beats.map((b, i) => (i === 2 ? { ...b, intent: 'tease' } : b));
  const r = checkFilmSync({ screenplay: { beats }, html: film({ rows }) });
  assert.deepEqual(codes(r), ['S5']);
  assert.match(r.errors[0].message, /film says 'tease', screenplay says 'button'/);
});

test('S6 — the drift this whole guard exists for: a timing patched in the film only', () => {
  // b02 re-timed in the composition, screenplay untouched. Before this check,
  // the review sampled b02 at the OLD midpoint and printed the frame under the
  // stage line it never covered.
  const rows = beats.map((b) => (b.id === 'b02' ? { ...b, t_end: 16.4 } : b));
  const r = checkFilmSync({ screenplay: { beats }, html: film({ rows }) });
  assert.deepEqual(codes(r), ['S6']);
  assert.match(r.errors[0].message, /b02 t_end: film says 16\.4, screenplay says 15\.1/);
});

test('a drift smaller than the epsilon is tolerated, one larger is not', () => {
  // Deliberately not asserted AT the boundary: 15.1 + 0.005 is 15.105000000000002
  // in float, so an exact-epsilon test asserts IEEE rounding rather than the
  // policy. Inside and outside are what the policy actually claims.
  const shift = (d) => beats.map((b) => (b.id === 'b02' ? { ...b, t_end: 15.1 + d } : b));
  assert.deepEqual(
    checkFilmSync({ screenplay: { beats }, html: film({ rows: shift(SYNC_EPSILON / 2) }) }).errors,
    [],
  );
  assert.ok(
    checkFilmSync({ screenplay: { beats }, html: film({ rows: shift(SYNC_EPSILON * 4) }) }).errors.length,
  );
});

test('an empty screenplay does not invent errors', () => {
  const r = checkFilmSync({ screenplay: { beats: [] }, html: film({ rows: [] }) });
  assert.deepEqual(r.errors, []);
});
