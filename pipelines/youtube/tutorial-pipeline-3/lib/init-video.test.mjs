import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, 'init-video.mjs');

test('init-video', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tp3-init-"));
  
  // Reject bad slug
  try {
    execFileSync('node', [scriptPath, 'bad_slug', '--root', tmpRoot]);
    assert.fail('Should reject bad slug');
  } catch (err) {
    assert.strictEqual(err.status, 1);
    assert.match(err.stderr.toString(), /Invalid slug: bad_slug/);
  }

  // Create tree
  try {
    execFileSync('node', [scriptPath, 'good-slug', '--root', tmpRoot]);
  } catch (err) {
    assert.fail('Should succeed with good slug');
  }
  
  const videoDir = path.join(tmpRoot, 'videos', 'good-slug');
  assert.strictEqual(fs.existsSync(path.join(videoDir, 'inputs', 'transcripts')), true);
  assert.strictEqual(fs.existsSync(path.join(videoDir, 'inputs', 'topic.md')), true);
  assert.strictEqual(fs.existsSync(path.join(videoDir, 'inputs', 'vision.md')), true);

  // Refuse existing slug
  try {
    execFileSync('node', [scriptPath, 'good-slug', '--root', tmpRoot]);
    assert.fail('Should refuse existing slug');
  } catch (err) {
    assert.strictEqual(err.status, 1);
    assert.match(err.stderr.toString(), /Directory already exists/);
  }

  fs.rmSync(tmpRoot, { recursive: true });
});
