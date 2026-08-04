import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { nextLabel, registerVersion } from './versions.mjs';

test('versions registry', (t) => {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'versions-test-'));
  
  t.after(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  const finalMp4Path = path.join(tmpdir, 'final.mp4');
  fs.writeFileSync(finalMp4Path, 'fake-mp4-data');

  assert.strictEqual(nextLabel({}), 'v1');
  assert.strictEqual(nextLabel({ versions: [] }), 'v1');
  assert.strictEqual(nextLabel({ versions: [{ label: 'v1' }] }), 'v2');
  assert.strictEqual(nextLabel({ versions: [{ label: 'v1' }, { label: 'v2' }] }), 'v3');
  assert.strictEqual(nextLabel({ versions: [{ label: 'v9' }] }), 'v10');

  // Register first version
  const entry1 = registerVersion(tmpdir, finalMp4Path, { draft: false });
  assert.strictEqual(entry1.label, 'v1');
  assert.strictEqual(entry1.file, 'versions/v1.mp4');
  assert.strictEqual(entry1.draft, false);
  assert.ok(entry1.created.includes('T'));
  
  assert.ok(fs.existsSync(path.join(tmpdir, 'versions', 'v1.mp4')));
  assert.strictEqual(fs.readFileSync(path.join(tmpdir, 'versions', 'v1.mp4'), 'utf8'), 'fake-mp4-data');

  const vJson1 = JSON.parse(fs.readFileSync(path.join(tmpdir, 'versions.json'), 'utf8'));
  assert.strictEqual(vJson1.versions.length, 1);
  assert.strictEqual(vJson1.versions[0].label, 'v1');

  // Register second version as draft
  const entry2 = registerVersion(tmpdir, finalMp4Path, { draft: true });
  assert.strictEqual(entry2.label, 'v2');
  assert.strictEqual(entry2.draft, true);

  const vJson2 = JSON.parse(fs.readFileSync(path.join(tmpdir, 'versions.json'), 'utf8'));
  assert.strictEqual(vJson2.versions.length, 2);

  // Register explicit label
  const entry3 = registerVersion(tmpdir, finalMp4Path, { label: 'v3-test' });
  assert.strictEqual(entry3.label, 'v3-test');
  
  const vJson3 = JSON.parse(fs.readFileSync(path.join(tmpdir, 'versions.json'), 'utf8'));
  assert.strictEqual(vJson3.versions.length, 3);
  assert.strictEqual(vJson3.versions[2].label, 'v3-test');
});
