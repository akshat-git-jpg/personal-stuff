import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { list } from '../../../video-registry/lib/registry.mjs';

const PIPELINE_ROOT = path.resolve(import.meta.dirname, '..');
const videos = (name) => path.join(PIPELINE_ROOT, 'videos', name);

test('a bare slug whose dir exists resolves under videos/', () => {
  assert.equal(resolveWorkdir('test-01'), videos('test-01'));
});

test('an unknown slug still returns a videos/ path and does not throw', () => {
  // resolveWorkdir also builds the path for a workdir that does not exist yet.
  const name = 'definitely-not-a-real-video-xyz';
  assert.equal(resolveWorkdir(name), videos(name));
});

test('"." still resolves to the pipeline root', () => {
  // scripts/test-run-sh.sh drives every verb with the literal slug "." — that
  // must keep hitting the existing-path branch and never reach the registry.
  assert.equal(resolveWorkdir('.'), path.resolve('.'));
});

test('a path-like arg is returned resolved and untouched', () => {
  assert.equal(resolveWorkdir('videos/test-01'), path.resolve('videos/test-01'));
});

test('a registered alias resolves to the canonical workdir when that dir exists', () => {
  let checked = 0;
  for (const v of list()) {
    for (const alias of v.aliases) {
      const canonical = videos(v.key);
      if (!fs.existsSync(canonical)) continue;   // nothing for the alias to point at
      if (fs.existsSync(videos(alias))) continue; // alias has its own dir here; no redirect
      assert.equal(resolveWorkdir(alias), canonical, `alias ${alias} should reach ${v.key}`);
      checked += 1;
    }
  }
  // best-ai-video-generator has the alias ai-video-tools-comparison and a real
  // workdir here, so this must exercise at least one redirect.
  assert.ok(checked > 0, 'expected at least one alias redirect to be exercised');
});
