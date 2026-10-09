import test from 'node:test';
import assert from 'node:assert';
import { lintSpoken, checkScript, seedScript } from './vo-prep.mjs';

const kinds = (text, map) => lintSpoken(text, map).map((p) => p.kind);

test('lintSpoken passes clean VO text', () => {
  assert.deepStrictEqual(lintSpoken('In twenty twenty-six, it costs fifty percent less. That is huge.'), []);
});

test('lintSpoken flags every character the engine reads badly', () => {
  assert.deepStrictEqual(kinds(''), ['empty']);
  assert.deepStrictEqual(kinds('Fast — cheap.'), ['dash']);
  assert.deepStrictEqual(kinds('Fast; cheap.'), ['semicolon']);
  assert.deepStrictEqual(kinds('Wait... no.'), ['ellipsis']);
  assert.deepStrictEqual(kinds('Docs & sheets.'), ['symbol']);
  assert.deepStrictEqual(kinds('It works (mostly).'), ['bracket', 'bracket']);
  assert.deepStrictEqual(kinds('It costs 50 dollars.'), ['digit']);
  assert.deepStrictEqual(kinds('This is HUGE.'), ['caps']);
  assert.deepStrictEqual(kinds('An AI tool.'), []);
  assert.deepStrictEqual(kinds('Click [FILL: price].'), ['flag']);
});

test('lintSpoken checks the text after the respell map runs', () => {
  assert.deepStrictEqual(kinds('Call the API.', { API: 'A-P-I' }), []);
  assert.deepStrictEqual(kinds('Export at 1080p.', { '1080p': 'ten-eighty p' }), []);
});

test('checkScript reports per section; seedScript fills only empty VO text', () => {
  const script = {
    sections: [
      { id: 's01', display_text: 'In 2026 it works.', spoken_text: '' },
      { id: 's02', display_text: 'Hello & bye.', spoken_text: 'Hello and bye.' },
    ],
  };
  const before = checkScript(script);
  assert.strictEqual(before.ok, false);
  assert.deepStrictEqual(before.sections.map((s) => s.problems.map((p) => p.kind)), [['empty'], []]);

  const seeded = seedScript(script);
  assert.strictEqual(seeded.sections[0].spoken_text, 'In 2026 it works.');
  assert.strictEqual(seeded.sections[1].spoken_text, 'Hello and bye.');
  assert.deepStrictEqual(checkScript(seeded).sections[0].problems.map((p) => p.kind), ['digit']);
  assert.strictEqual(script.sections[0].spoken_text, '');
});
