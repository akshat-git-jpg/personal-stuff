import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { resolveWorkdir, rootDir } from './workdir.mjs';

test('resolveWorkdir', async (t) => {
  await t.test('bare slug resolves under videos/', () => {
    const dir = resolveWorkdir('my-slug');
    assert.strictEqual(dir, path.join(rootDir(), 'videos', 'my-slug'));
  });

  await t.test('path with a slash is returned resolved', () => {
    const dir = resolveWorkdir('./videos/another-slug');
    assert.strictEqual(dir, path.resolve('./videos/another-slug'));
  });

  await t.test('empty argument throws', () => {
    assert.throws(() => resolveWorkdir(''), /slug or path required/);
    assert.throws(() => resolveWorkdir(undefined), /slug or path required/);
  });
});
