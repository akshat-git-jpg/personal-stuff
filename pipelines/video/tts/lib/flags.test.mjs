import test from 'node:test';
import assert from 'node:assert';
import { scanFlags, stripFlags } from './flags.mjs';

test('scanFlags', () => {
  const text = 'Here is [VERIFY: a thing] and [FILL:  another  ].';
  const flags = scanFlags(text);
  assert.deepStrictEqual(flags, [
    { kind: 'VERIFY', note: 'a thing', raw: '[VERIFY: a thing]' },
    { kind: 'FILL', note: 'another', raw: '[FILL:  another  ]' }
  ]);

  assert.deepStrictEqual(scanFlags('clean text'), []);
});

test('stripFlags', () => {
  const text = 'Here is [VERIFY: a thing] and [FILL:  another  ].';
  assert.strictEqual(stripFlags(text), 'Here is and .');

  const text2 = '   [VERIFY: start]   middle   [FILL: end]   ';
  assert.strictEqual(stripFlags(text2), 'middle');
});
