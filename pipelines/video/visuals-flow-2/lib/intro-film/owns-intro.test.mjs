import test, { mock } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { introOwnedByFilm } from './owns-intro.mjs';

test('introOwnedByFilm', (t) => {
  mock.method(fs, 'existsSync', () => false);
  assert.strictEqual(introOwnedByFilm('dummy'), false, 'false for absent config');

  fs.existsSync.mock.mockImplementation(() => true);
  mock.method(fs, 'readFileSync', () => '{}');
  assert.strictEqual(introOwnedByFilm('dummy'), false, 'false for {}');

  fs.readFileSync.mock.mockImplementation(() => JSON.stringify({ intro: 'cards' }));
  assert.strictEqual(introOwnedByFilm('dummy'), false, 'false for intro: cards');

  fs.readFileSync.mock.mockImplementation(() => JSON.stringify({ intro: 'film' }));
  assert.strictEqual(introOwnedByFilm('dummy'), true, 'true for intro: film');
  
  mock.restoreAll();
});
