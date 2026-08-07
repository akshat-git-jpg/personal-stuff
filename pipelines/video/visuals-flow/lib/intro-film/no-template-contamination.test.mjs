import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepDir } from '../steps.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STEP = path.join(ROOT, 'steps', '130-author-intro-screenplay-llm');

// The owner's hard constraint on this step:
//
//   "just make sure that it's not using templatized things for intro and those
//    templates are not influencing this intro creation anyway. That context
//    should not come in intro."
//
// The card catalog is a TEMPLATE SET and must not reach the intro's context, or
// the author starts picking instead of authoring and the creative freedom that
// justifies the whole step is gone. DESIGN.md and the logo registry are the
// BRAND and are REQUIRED reading — the first film was authored without them and
// shipped a largest-text of 54px in Helvetica.
//
// Both halves matter. Do NOT "fix" a failure here by also banning DESIGN.md, and
// do NOT relax it by adding entries to an allow-list: that turns the owner's
// constraint into a suggestion.
const BANNED = ['catalog.json', 'card-plan.json', 'cues.json'];

// The prohibition has to be able to name the thing it prohibits. A line that
// forbids the file is the one legitimate mention.
const IS_PROHIBITION = /never read|do not read|must not|never in scope|not in scope/i;

test('the 130 authoring context never names the card catalog', () => {
  assert.ok(fs.existsSync(STEP), `${STEP} must exist — run.sh cats AUTHORING.md from it`);
  const files = fs.readdirSync(STEP);
  assert.ok(files.length > 0, 'the step folder must not be empty');

  for (const file of files) {
    const full = path.join(STEP, file);
    if (!fs.statSync(full).isFile()) continue;
    const text = fs.readFileSync(full, 'utf8');
    for (const banned of BANNED) {
      const offending = text
        .split('\n')
        .filter((l) => l.includes(banned) && !IS_PROHIBITION.test(l));
      assert.deepEqual(
        offending,
        [],
        `${file} references ${banned} outside a prohibition — the card catalog must not reach the intro's context`,
      );
    }
  }
});

test('the 130 authoring context requires DESIGN.md and the real logo registry', () => {
  const a = fs.readFileSync(path.join(STEP, 'AUTHORING.md'), 'utf8');
  assert.match(a, /DESIGN\.md/, 'the brand contract is required reading, not optional');
  assert.match(a, /logos\/registry\.json/, 'real logos are required — no invented rectangles');
});

test('run.sh can actually find the authoring prompt it cats', () => {
  // The step folder was missing on the first build: run.sh invoked
  // `cat steps/025-author-intro-film-llm/AUTHORING.md` and every opted-in video
  // failed on its first step, while the repo gate stayed green because nothing
  // asserted the file existed.
  //
  // run.sh no longer names the folder — it resolves it through the registry
  // (plan 191) — so the assertion follows the same resolution the driver uses.
  // Reading run.sh's source for a literal path would now match nothing and pass
  // vacuously, which is exactly the failure mode this test was written against.
  assert.equal(stepDir('130'), STEP, 'the registry must resolve 130 to this folder');
  assert.ok(
    fs.existsSync(path.join(stepDir('intro-film'), 'AUTHORING.md')),
    'run.sh cats AUTHORING.md from the folder the registry resolves for the intro-film verb',
  );
});

test('no intro-film library reads the catalog', () => {
  const dir = path.join(ROOT, 'lib', 'intro-film');
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const banned of BANNED) {
      assert.ok(!src.includes(banned), `lib/intro-film/${f} must not read ${banned}`);
    }
  }
});
