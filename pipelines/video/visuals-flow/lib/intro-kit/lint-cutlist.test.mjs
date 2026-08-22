import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { lintCutlist, truncationNotices, AVATAR_MAX_SHARE, AVATAR_MAX_HOLD, CUT_MIN, CUT_MAX } from './lint-cutlist.mjs';
import { loadKit } from './inputs.mjs';

const FIXTURES = path.join(import.meta.dirname, 'fixtures');
const kit = loadKit();
const words = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'words.json'), 'utf8'));

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8'));
}

function lint(name) {
  return lintCutlist({ cutlist: loadFixture(name), kit, words });
}

function hasCode(result, code) {
  return result.errors.some((e) => e.startsWith(code));
}

// S6 was retired by plan 229 (its per-card duration range lived only in the
// deleted intro-kit/kit.json; S3's [CUT_MIN, CUT_MAX] is a tighter bound).
const CODES = ['S1', 'S2', 'S3', 'S4', 'S5', 'S7'];

test('the module exports the three tunable thresholds the mutation recipe targets', () => {
  assert.equal(AVATAR_MAX_SHARE, 0.55);
  assert.equal(AVATAR_MAX_HOLD, 5.0);
  assert.equal(CUT_MIN, 1.5);
  assert.equal(CUT_MAX, 4.0);
});

test('good.json produces zero errors', () => {
  const result = lint('good');
  assert.deepEqual(result.errors, [], `expected no errors, got:\n${result.errors.join('\n')}`);
  assert.deepEqual(result.warnings, [], 'this lint carries no warnings — every rule is a hard gate');
});

for (const code of CODES) {
  test(`bad-${code.toLowerCase()}.json trips ${code}`, () => {
    const result = lint(`bad-${code.toLowerCase()}`);
    assert.ok(
      hasCode(result, code),
      `expected an error starting with "${code}" for bad-${code.toLowerCase()}.json, got:\n${result.errors.join('\n')}`,
    );
  });

  test(`good.json does not trip ${code}`, () => {
    const result = lint('good');
    assert.ok(!hasCode(result, code), `good.json unexpectedly tripped ${code}: ${result.errors.join('\n')}`);
  });
}

test('S1 message names both the measured share and the threshold', () => {
  const result = lint('bad-s1');
  const msg = result.errors.find((e) => e.startsWith('S1'));
  assert.match(msg, /avatar share 0\.\d+ exceeds 0\.55/);
});

test('S2 fires only on a lone avatar beat, not on an overlay beat of the same length', () => {
  // bad-s1.json holds an overlay beat (b04, 2.4s) well under AVATAR_MAX_HOLD —
  // S2 only checks kind "avatar", so it must stay silent on b04.
  const result = lint('bad-s1');
  assert.ok(!result.errors.some((e) => e.startsWith('S2') && e.includes('b04')));
});

test('S4 also refuses a card used with the wrong overlay kind', () => {
  const cutlist = {
    ...loadFixture('good'),
    beats: loadFixture('good').beats.map((b) =>
      b.id === 'b04' ? { ...b, kind: 'card' } : b, // lower-third is overlay-only
    ),
  };
  const result = lintCutlist({ cutlist, kit, words });
  assert.ok(hasCode(result, 'S4'), `expected S4 kind-mismatch, got:\n${result.errors.join('\n')}`);
});

test('S7 accepts a phrase word list spread across multiple transcript words', () => {
  // good.json's b07 (logo-grid) beats list matches five separate transcript
  // words in order — a straight equality check on the whole sentence would
  // have missed this.
  const result = lint('good');
  assert.ok(!result.errors.some((e) => e.startsWith('S7') && e.includes('b07')));
});

function oneCardCutlist(card, vars, { start = 0, end = 3 } = {}) {
  return {
    video: 'x', mode: 'simple', approved: false,
    span: { start, end },
    beats: [{ id: 'c1', kind: 'card', card, t_start: start, t_end: end, vars }],
  };
}

test('S4 refuses a duration var — the renderer owns it', () => {
  const result = lintCutlist({
    cutlist: oneCardCutlist('checklist/checklist', { title: 'What you get', duration: 3 }),
    kit, words: [],
  });
  assert.ok(
    result.errors.some((e) => e.startsWith('S4 renderer-owned-var')),
    `expected S4 renderer-owned-var, got:\n${result.errors.join('\n')}`,
  );
});

test('S4 refuses a beats element carrying a key outside the card beat_shape', () => {
  const result = lintCutlist({
    cutlist: oneCardCutlist('checklist/checklist', { title: 'What you get', beats: [{ text: 'Fast', bogus: 1 }] }),
    kit, words: [],
  });
  assert.ok(
    result.errors.some((e) => e.startsWith('S4 bad-beat')),
    `expected S4 bad-beat, got:\n${result.errors.join('\n')}`,
  );
});

test('S4 allows `at` on a beats element — the cut list authors reveal times directly', () => {
  const result = lintCutlist({
    cutlist: oneCardCutlist('checklist/checklist', { title: 'What you get', beats: [{ text: 'Fast', at: 0.4 }] }),
    kit, words: [],
  });
  assert.ok(
    !result.errors.some((e) => e.startsWith('S4')),
    `expected no S4 error, got:\n${result.errors.join('\n')}`,
  );
});

test('a body card far shorter than its designed length raises a truncation NOTICE, not an error', () => {
  const cutlist = oneCardCutlist('checklist/checklist', { title: 'What you get' }, { start: 0, end: 2 });
  const result = lintCutlist({ cutlist, kit, words: [] });
  assert.deepEqual(result.errors, [], `expected no errors, got:\n${result.errors.join('\n')}`);
  const notices = truncationNotices({ cutlist, kit });
  assert.ok(notices.some((n) => n.startsWith('NOTICE truncation')), `expected a truncation notice, got:\n${notices.join('\n')}`);
});
