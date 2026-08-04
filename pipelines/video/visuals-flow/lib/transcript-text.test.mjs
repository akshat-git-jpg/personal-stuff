import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { transcriptText } from './transcript-text.mjs';

const TMP_ROOT = path.join(import.meta.dirname, '.test-tmp', 'transcript-text');

function setupWorkdir(slug, words) {
  const wd = path.join(TMP_ROOT, slug);
  fs.mkdirSync(wd, { recursive: true });
  fs.writeFileSync(path.join(wd, 'transcript.json'), JSON.stringify(words));
  return wd;
}

test.before(() => {
  if (fs.existsSync(TMP_ROOT)) {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  }
});

test('transcriptText unit test', () => {
  const words = [{ text: 'a', start: 0, end: 1 }, { text: 'b', start: 1, end: 2 }];
  assert.equal(transcriptText(words), 'a b');
});

test('CLI smoke test', () => {
  const wd = setupWorkdir('cli-smoke', [
    { text: 'word1' },
    { text: 'word2' },
    { text: 'word3' }
  ]);

  const scriptPath = path.join(import.meta.dirname, 'transcript-text.mjs');
  const result = spawnSync('node', [scriptPath, wd], { encoding: 'utf8' });
  
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'word1 word2 word3\n');
});
