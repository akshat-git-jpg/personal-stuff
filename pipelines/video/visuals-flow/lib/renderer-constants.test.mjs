import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { CARD_RENDERER, FILM_RENDERER, CARD_RENDERER_VERSION, FILM_RENDERER_VERSION } from './renderer-constants.mjs';

const LIB = path.resolve(import.meta.dirname);
const ROOT = path.resolve(LIB, '..');

// Walk lib/ for .mjs sources, skipping tests, scratch dirs, and the constants
// module itself (which is allowed to name the versions — it IS the source).
function libSources(dir = LIB, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '.test-tmp' || e.name === 'fixtures' || e.name === 'node_modules') continue;
      libSources(p, out);
    } else if (e.name.endsWith('.mjs') && !e.name.endsWith('.test.mjs') && e.name !== 'renderer-constants.mjs') {
      out.push(p);
    }
  }
  return out;
}

// THE POINT OF THIS FILE. Four files used to hardcode a hyperframes pin and two
// of them disagreed by 26 patch versions with nothing to reveal it. Any new
// hardcoded pin fails here instead of silently becoming a fifth source of truth.
test('no lib/ source hardcodes a hyperframes version', () => {
  const offenders = [];
  for (const file of libSources()) {
    const src = fs.readFileSync(file, 'utf8');
    // Match a pinned version only: `hyperframes@0.7.62`. A bare `hyperframes`
    // mention in prose is fine, and so is `hyperframes@latest` in a doc.
    if (/hyperframes@\d+\.\d+\.\d+/.test(src)) offenders.push(path.relative(ROOT, file));
  }
  assert.deepStrictEqual(
    offenders, [],
    `these files hardcode a renderer pin — import CARD_RENDERER or FILM_RENDERER from lib/renderer-constants.mjs instead: ${offenders.join(', ')}`
  );
});

// steps/010's local transcribe fallback is bash and cannot import the module, so
// the coupling is asserted here instead. It transcribes rather than renders, but
// it is still a hyperframes invocation and a silent divergence is still a
// divergence.
test('steps/010 transcribe pin matches the card renderer', () => {
  const runSh = path.join(ROOT, 'steps', '010-transcribe-run', 'run.sh');
  const src = fs.readFileSync(runSh, 'utf8');
  const found = [...src.matchAll(/hyperframes@(\d+\.\d+\.\d+)/g)].map((m) => m[1]);
  assert.ok(found.length > 0, `expected a pinned hyperframes version in ${path.relative(ROOT, runSh)}`);
  for (const v of found) {
    assert.strictEqual(
      v, CARD_RENDERER_VERSION,
      `steps/010-transcribe-run/run.sh pins hyperframes@${v} but CARD_RENDERER_VERSION is ${CARD_RENDERER_VERSION} — bump both together`
    );
  }
});

test('both pins resolve to a concrete hyperframes spec', () => {
  assert.match(CARD_RENDERER, /^hyperframes@\d+\.\d+\.\d+$/);
  assert.match(FILM_RENDERER, /^hyperframes@\d+\.\d+\.\d+$/);
});

// The film path's own comments require render-film and review-film to stay on
// one renderer. They now share a constant, so this pins the property itself.
test('render-film and review-film read the same pin', () => {
  const read = (p) => fs.readFileSync(path.join(LIB, 'intro-film', p), 'utf8');
  for (const f of ['render-film.mjs', 'review-film.mjs']) {
    assert.match(read(f), /FILM_RENDERER/, `${f} must use FILM_RENDERER, not its own pin`);
  }
});

// HYPERFRAMES_VERSION must move BOTH pins together. Overriding only the card
// renderer is what let a review and a ship run on different versions.
test('HYPERFRAMES_VERSION overrides both pins together', async () => {
  const prev = process.env.HYPERFRAMES_VERSION;
  process.env.HYPERFRAMES_VERSION = '9.9.9';
  try {
    const fresh = await import(`./renderer-constants.mjs?override=${Date.now()}`);
    assert.strictEqual(fresh.CARD_RENDERER, 'hyperframes@9.9.9');
    assert.strictEqual(fresh.FILM_RENDERER, 'hyperframes@9.9.9');
  } finally {
    if (prev === undefined) delete process.env.HYPERFRAMES_VERSION;
    else process.env.HYPERFRAMES_VERSION = prev;
  }
});
