import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { checkAvatarClip } from './avatar.mjs';
import { resolveWorkdir } from './workdir.mjs';

test('checkAvatarClip: missing file', () => {
  const slug = '.test-tmp/avatar-missing';
  const workdir = resolveWorkdir(slug);
  if (fs.existsSync(workdir)) fs.rmSync(workdir, { recursive: true, force: true });
  fs.mkdirSync(workdir, { recursive: true });

  const result = checkAvatarClip(slug);
  assert.strictEqual(result.ok, false);
  assert.match(result.reason, /no avatar\.mp4/);

  fs.rmSync(workdir, { recursive: true, force: true });
});
