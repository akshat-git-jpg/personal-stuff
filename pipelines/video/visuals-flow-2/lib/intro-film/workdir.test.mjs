import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { resolveWorkdir, rootDir } from './workdir.mjs';

test('resolveWorkdir', async (t) => {
  await t.test('bare slug resolves under videos/ and intro-film', () => {
    const p = resolveWorkdir('my-slug');
    assert.strictEqual(p, path.join(rootDir(), 'videos', 'my-slug', 'intro-film'));
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
