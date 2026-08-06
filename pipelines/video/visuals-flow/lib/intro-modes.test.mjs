import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { INTRO_MODES, INTRO_MODE_NAMES, introModeFor, ownsIntroSpan, introSpanFor } from './intro-modes.mjs';
import { loadRunConfig } from './run-config.mjs';

const LIB = path.resolve(import.meta.dirname);
const ROOT = path.resolve(LIB, '..');

function tmpWorkdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'intro-modes-test-'));
}

// --- the mode table itself -------------------------------------------------

test('every declared mode has well-formed capability fields', () => {
  for (const [name, mode] of Object.entries(INTRO_MODES)) {
    assert.equal(typeof mode.label, 'string', `${name}.label must be a string`);
    assert.ok(mode.label.length > 0, `${name}.label must be non-empty`);
    assert.equal(typeof mode.ownsIntroSpan, 'boolean', `${name}.ownsIntroSpan must be a boolean`);
    if (mode.ownsIntroSpan) {
      assert.equal(typeof mode.spanFrom, 'string', `${name}.spanFrom must be a string when ownsIntroSpan is true`);
      assert.ok(mode.spanFrom.length > 0, `${name}.spanFrom must be non-empty when ownsIntroSpan is true`);
    } else {
      assert.equal(mode.spanFrom, null, `${name}.spanFrom must be null when ownsIntroSpan is false`);
    }
  }
});

// The default path (unconfigured, and intro: "cards") must always exist as a
// real declared mode — this is what proves adding a flow can never quietly
// erase the safe default.
test('at least one declared mode does not own the intro span', () => {
  const nonOwning = Object.values(INTRO_MODES).filter((m) => !m.ownsIntroSpan);
  assert.ok(nonOwning.length >= 1, 'expected at least one mode with ownsIntroSpan: false');
});

// --- introModeFor / introSpanFor throw paths -------------------------------

test('introModeFor throws E-INTRO for a name accepted by run-config but absent from the table', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'film' }));
  const saved = INTRO_MODES.film;
  delete INTRO_MODES.film;
  try {
    assert.throws(() => introModeFor(w), /E-INTRO/);
  } finally {
    INTRO_MODES.film = saved;
    fs.rmSync(w, { recursive: true, force: true });
  }
});

test('introSpanFor returns null for cards', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'cards' }));
  assert.equal(introSpanFor(w), null);
  fs.rmSync(w, { recursive: true, force: true });
});

test('introSpanFor returns the intro part for film, from segments.json', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'film' }));
  fs.writeFileSync(path.join(w, 'segments.json'), JSON.stringify({
    structure: [{ part: 'intro', start: 0, end: 12.5 }, { part: 'conclusion', start: 40, end: 50 }],
  }));
  assert.deepEqual(introSpanFor(w), { start: 0, end: 12.5 });
  fs.rmSync(w, { recursive: true, force: true });
});

// Pre-segments case: 015 hasn't run yet, so segments.json does not exist.
// Several callers depend on this returning null rather than throwing.
test('introSpanFor returns null for film when segments.json is absent', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'film' }));
  assert.equal(introSpanFor(w), null);
  fs.rmSync(w, { recursive: true, force: true });
});

test('introSpanFor throws E-INTRO for a mode declaring an unreadable spanFrom', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'film' }));
  const saved = INTRO_MODES.film.spanFrom;
  INTRO_MODES.film.spanFrom = 'nonsense.path';
  try {
    assert.throws(() => introSpanFor(w), /E-INTRO/);
  } finally {
    INTRO_MODES.film.spanFrom = saved;
    fs.rmSync(w, { recursive: true, force: true });
  }
});

test('ownsIntroSpan matches the table: false for cards, true for film', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'cards' }));
  assert.equal(ownsIntroSpan(w), false);
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'film' }));
  assert.equal(ownsIntroSpan(w), true);
  fs.rmSync(w, { recursive: true, force: true });
});

// --- INTRO_MODE_NAMES vs run-config's accepted enum ------------------------

test('INTRO_MODE_NAMES round-trips through run-config: every declared mode is accepted, an undeclared one is rejected', () => {
  const w = tmpWorkdir();
  for (const name of INTRO_MODE_NAMES) {
    fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: name }));
    assert.doesNotThrow(() => loadRunConfig(w), `run-config.mjs should accept declared mode "${name}"`);
  }
  fs.writeFileSync(path.join(w, 'run-config.json'), JSON.stringify({ intro: 'not-a-real-mode' }));
  assert.throws(() => loadRunConfig(w), /intro must be one of/);
  fs.rmSync(w, { recursive: true, force: true });
});

// --- the no-bypass gate -----------------------------------------------------
//
// This is the mutation target boss exercises: reverting a branch site back to
// the old identity-check predicate must make this test fail, printing E-INTRO.

// Walk lib/ for .mjs sources, skipping tests, scratch dirs, and the deprecated
// alias module itself (which is ALLOWED to name the old predicate — it IS the
// alias).
function libSources(dir = LIB, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '.test-tmp' || e.name === 'fixtures' || e.name === 'node_modules') continue;
      libSources(p, out);
    } else if (e.name.endsWith('.mjs') && !e.name.endsWith('.test.mjs')) {
      if (path.relative(LIB, p) === path.join('intro-film', 'owns-intro.mjs')) continue;
      out.push(p);
    }
  }
  return out;
}

test('no lib/ source outside the deprecated alias calls introOwnedByFilm/filmSpanFor or reads .intro directly', () => {
  const offenders = [];
  for (const file of libSources()) {
    const src = fs.readFileSync(file, 'utf8');
    const bypassesPredicate = /\bintroOwnedByFilm\s*\(/.test(src) || /\bfilmSpanFor\s*\(/.test(src);
    const readsIntroDirectly = /\.intro\s*===\s*['"]/.test(src);
    if (bypassesPredicate || readsIntroDirectly) offenders.push(path.relative(ROOT, file));
  }
  assert.deepEqual(
    offenders, [],
    `E-INTRO these files bypass the intro-mode capability query — call ownsIntroSpan/introSpanFor from lib/intro-modes.mjs instead: ${offenders.join(', ')}`
  );
});
