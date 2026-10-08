import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { referencedAssets, restoreAssets } from './assets.mjs';

test('logo copies are restored from the registry; unknown files are reported', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'animate-assets-'));
  const logos = path.join(root, 'logos');
  const dir = path.join(root, 'm01');
  fs.mkdirSync(logos);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(logos, 'openart.png'), 'png');
  fs.writeFileSync(path.join(dir, 'index.html'), '<img src="assets/openart.png"><div style="background:url(assets/own.png)"></div>');
  assert.deepEqual(referencedAssets(fs.readFileSync(path.join(dir, 'index.html'), 'utf8')), ['openart.png', 'own.png']);
  assert.deepEqual(restoreAssets(dir, { logos }), ['own.png']);
  assert.equal(fs.readFileSync(path.join(dir, 'assets', 'openart.png'), 'utf8'), 'png');
});
