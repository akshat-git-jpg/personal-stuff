import test from 'node:test';
import assert from 'node:assert/strict';
import { SOUND_CONSTANTS } from './sound-constants.mjs';

test('constants', () => {
  assert.equal(SOUND_CONSTANTS.HIT_GAIN_DB, -14);
  assert.equal(SOUND_CONSTANTS.POP_GAIN_DB, -16);
});
