import test from 'node:test';
import assert from 'node:assert';
import { contactSheetArgs } from './contact-sheet.mjs';

test('contactSheetArgs builds argv', () => {
  const args = contactSheetArgs('frames/f_%04d.png', 'out.jpg', 6, 3);
  assert.deepStrictEqual(args, [
    '-y', '-i', 'frames/f_%04d.png',
    '-vf', 'scale=480:-1,tile=6x3',
    '-frames:v', '1',
    'out.jpg'
  ]);
});
