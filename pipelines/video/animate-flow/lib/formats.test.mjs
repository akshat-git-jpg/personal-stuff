import test from 'node:test';
import assert from 'node:assert/strict';
import { recordingBand, formatCanvas, formatDirName, stageCompositionName } from './formats.mjs';
import { runConfigErrors, formatsOf, reviewOf, modelsOf } from './run-config.mjs';

const good = { template: 'animate', video: 'v', designSystem: 'default', source: { audio: 'audio.wav', screen: null }, total: 10 };

test('the recording sits in a full-width band across the middle of the tall and square frames', () => {
  assert.deepEqual(recordingBand('9:16'), { x: 0, y: 656, w: 1080, h: 608 });
  assert.deepEqual(recordingBand('1:1'), { x: 0, y: 236, w: 1080, h: 608 });
  assert.deepEqual(recordingBand('16:9'), { x: 0, y: 0, w: 1920, h: 1080 });
  assert.deepEqual(formatCanvas('9:16', { w: 1920, h: 1080, fps: 30 }), { w: 1080, h: 1920, fps: 30 });
});

test('each format has its own composition folder and stage name', () => {
  assert.equal(formatDirName('m01', '16:9'), 'm01');
  assert.equal(formatDirName('m01', '9:16'), 'm01--9x16');
  assert.equal(stageCompositionName('16:9'), 'composition');
  assert.equal(stageCompositionName('1:1'), 'composition-1x1');
});

test('16:9 only by default; extra formats must be known and come after the main one', () => {
  assert.deepEqual(formatsOf(good), ['16:9']);
  assert.deepEqual(runConfigErrors({ ...good, formats: ['16:9', '9:16', '1:1'] }), []);
  assert.match(runConfigErrors({ ...good, formats: ['9:16'] }).join(), /must start with the main format/);
  assert.match(runConfigErrors({ ...good, formats: ['16:9', '4:5'] }).join(), /unknown format "4:5"/);
  assert.equal(reviewOf(good).deadMax, 4);
  assert.equal(reviewOf({ ...good, review: { deadMax: 3 } }).deadMax, 3);
  assert.match(runConfigErrors({ ...good, review: { deadMax: -1 } }).join(), /deadMax/);
  assert.equal(modelsOf(good).storyboard, 'sonnet');
});
