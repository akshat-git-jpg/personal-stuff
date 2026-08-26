import test from 'node:test';
import assert from 'node:assert';
import { lockScript } from './vo-lock.mjs';

function section(over = {}) {
  return {
    id: 's01',
    version: 1,
    demo: false,
    display_text: 'Some narration.',
    spoken_text: 'Some narration.',
    flags: [],
    tts: { regens_used: 1, locked: false, take: 's01-v1-t1.wav' },
    recording: { status: 'none' },
    ...over
  };
}

test('lockScript locks every section that has a take', () => {
  const script = { sections: [section({ id: 's01' }), section({ id: 's02' })] };
  const { script: next, locked } = lockScript(script);
  assert.deepStrictEqual(locked, ['s01', 's02']);
  assert.ok(next.sections.every(s => s.tts.locked));
  // input untouched
  assert.strictEqual(script.sections[0].tts.locked, false);
});

test('lockScript --only locks just that section', () => {
  const script = { sections: [section({ id: 's01' }), section({ id: 's02' })] };
  const { script: next, locked } = lockScript(script, { only: 's02' });
  assert.deepStrictEqual(locked, ['s02']);
  assert.strictEqual(next.sections[0].tts.locked, false);
  assert.strictEqual(next.sections[1].tts.locked, true);
});

test('lockScript is idempotent over already-locked sections', () => {
  const script = {
    sections: [section({ tts: { regens_used: 1, locked: true, take: 's01-v1-t1.wav' } })]
  };
  const { locked } = lockScript(script);
  assert.deepStrictEqual(locked, []);
});

test('lockScript refuses a section with no take, empty spoken_text, or open flags', () => {
  assert.throws(
    () => lockScript({ sections: [section({ tts: { regens_used: 0, locked: false, take: null } })] }),
    /null take/
  );
  assert.throws(
    () => lockScript({ sections: [section({ spoken_text: '' })] }),
    /empty spoken_text/
  );
  assert.throws(
    () => lockScript({ sections: [section({ flags: [{ kind: 'VERIFY', note: 'x' }] })] }),
    /remaining flags/
  );
});
