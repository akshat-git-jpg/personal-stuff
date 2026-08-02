import test from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { renderArgs } from './render-film.mjs';
import path from 'node:path';

test('renderArgs constructs correct arguments (default)', () => {
  const args = renderArgs('/tmp/film', '/tmp/out.mp4');
  const expectedVersion = process.env.HYPERFRAMES_VERSION ? `hyperframes@${process.env.HYPERFRAMES_VERSION}` : 'hyperframes@0.7.62';
  assert.deepStrictEqual(args, ['-y', expectedVersion, 'render', '/tmp/film', '--output', '/tmp/out.mp4']);
});

test('renderArgs honours HYPERFRAMES_VERSION', () => {
  const script = `
    process.env.HYPERFRAMES_VERSION = '1.0.0';
    import('./render-film.mjs').then(m => {
      const args = m.renderArgs('A', 'B');
      if (args[1] !== 'hyperframes@1.0.0') {
        console.error('Got', args);
        process.exit(1);
      }
    });
  `;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: path.resolve('./lib')
  });
  assert.strictEqual(r.status, 0, r.stderr?.toString());
});
