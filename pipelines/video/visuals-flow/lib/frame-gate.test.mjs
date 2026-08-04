import { test, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { probeTimesForCue, frameHasColor, frameGate } from './frame-gate.mjs';
import { closeBrowser } from '../../card-library/scripts/overflow-probe.mjs';

const cardLibraryRoot = path.resolve(import.meta.dirname, '..', '..', 'card-library');

after(() => closeBrowser());

test('probeTimesForCue: beats + midpoint + tail, deduped sorted', () => {
  const cue = {
    duration: 10,
    variables: {
      beats: [{ at: 1.2 }, { at: 3.4 }]
    }
  };
  const times = probeTimesForCue(cue);
  assert.deepStrictEqual(times, [1.2, 3.4, 5, 9]);
});

test('frameHasColor: false on all-white, true on accent swatch', () => {
  execSync('ffmpeg -v error -f lavfi -i color=white:s=480x270 -frames:v 1 /tmp/white.png -y');
  execSync('ffmpeg -v error -f lavfi -i color=0xfb923c:s=480x270 -frames:v 1 /tmp/orange.png -y');
  assert.strictEqual(frameHasColor('/tmp/white.png', '#fb923c'), false);
  assert.strictEqual(frameHasColor('/tmp/orange.png', '#fb923c'), true);
});

test('frameGate flags an overflowing cue and passes a clean one', async () => {
  const cleanCue = {
    id: 'c01',
    card: 'slate/kinetic-sentence',
    duration: 5,
    variables: {
      text: 'One two three four five',
      beats: [
        { kind: 'word', text: 'One', at: 1 },
        { kind: 'word', text: 'two', at: 2 },
        { kind: 'word', text: 'three', at: 3 },
        { kind: 'word', text: 'four', at: 4 },
        { kind: 'word', text: 'five', at: 5 },
      ]
    }
  };

  const overflowingCue = {
    id: 'c02',
    card: 'pros-cons/pros-cons',
    duration: 5,
    variables: {
      title: 'This is a very very very very very very very very very very very very very long title that overflows because it wraps way too many lines and pushes the content completely off the bottom edge of the screen',

      beats: [
        { kind: 'pro', text: 'x', at: 1 }
      ]
    }
  };

  const errors = await frameGate([cleanCue, overflowingCue], cardLibraryRoot);
  assert.strictEqual(errors.length, 1);
  assert.ok(errors[0].includes('E12 frame-gate: c02'));
  assert.ok(errors[0].includes('overflows the canvas'));
});
