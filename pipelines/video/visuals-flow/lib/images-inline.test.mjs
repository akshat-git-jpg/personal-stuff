import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { enrichImages } from './images-inline.mjs';

const TMP = path.join(import.meta.dirname, '.test-tmp', 'images-inline');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.before(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(path.join(TMP, 'card-images'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'card-images', 'anchor.png'), PNG);
});

test('inlines a workdir-relative image as a data URI', () => {
  const { variables, missing } = enrichImages({ anchorImage: 'card-images/anchor.png' }, TMP);
  assert.deepEqual(missing, []);
  assert.match(variables.anchorImage, /^data:image\/png;base64,/);
});

test('reaches images nested in arrays and beats', () => {
  const { variables } = enrichImages({
    beats: [{ label: 'one', shot: 'card-images/anchor.png' }],
    gallery: ['card-images/anchor.png'],
  }, TMP);
  assert.match(variables.beats[0].shot, /^data:image\/png;base64,/);
  assert.match(variables.gallery[0], /^data:image\/png;base64,/);
  assert.equal(variables.beats[0].label, 'one');
});

test('leaves non-image strings untouched', () => {
  const input = { title: 'One Face, Every Scenario', slug: 'openart' };
  const { variables } = enrichImages(input, TMP);
  assert.equal(variables, input, 'returns the original object when nothing was inlined');
});

test('reports a missing file and leaves the path in place', () => {
  const { variables, missing } = enrichImages({ anchorImage: 'card-images/nope.png' }, TMP);
  assert.deepEqual(missing, ['card-images/nope.png']);
  assert.equal(variables.anchorImage, 'card-images/nope.png');
});

test('refuses to read outside the video workdir', () => {
  const { variables, missing } = enrichImages({ anchorImage: '../../../etc/hosts.png' }, TMP);
  assert.equal(missing.length, 1);
  assert.equal(variables.anchorImage, '../../../etc/hosts.png');
});

test('does not re-encode a value that is already a data URI', () => {
  const already = 'data:image/png;base64,AAAA.png';
  const { variables } = enrichImages({ anchorImage: already }, TMP);
  assert.equal(variables.anchorImage, already);
});
