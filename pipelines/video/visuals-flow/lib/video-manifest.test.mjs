import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadVideoManifest, MANIFEST_DEFAULTS } from './video-manifest.mjs';

test('loadVideoManifest defaults when missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'video-test-'));
  try {
    const manifest = loadVideoManifest(tmp);
    assert.deepStrictEqual(manifest, MANIFEST_DEFAULTS);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('loadVideoManifest merges with raw file', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'video-test-'));
  try {
    fs.writeFileSync(path.join(tmp, 'video.json'), JSON.stringify({ base: 'none', music: 'track1.mp3' }));
    const manifest = loadVideoManifest(tmp);
    assert.strictEqual(manifest.base, 'none');
    assert.strictEqual(manifest.music, 'track1.mp3');
    assert.strictEqual(manifest.aspect, '16:9');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('loadVideoManifest throws on bad base', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'video-test-'));
  try {
    fs.writeFileSync(path.join(tmp, 'video.json'), JSON.stringify({ base: 'invalid' }));
    assert.throws(() => loadVideoManifest(tmp), /video.json base must be "screen"\|"none", got "invalid"/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('loadVideoManifest throws on bad aspect', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'video-test-'));
  try {
    fs.writeFileSync(path.join(tmp, 'video.json'), JSON.stringify({ aspect: '9:16' }));
    assert.throws(() => loadVideoManifest(tmp), /video.json aspect: only "16:9" is supported/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
