import test from 'node:test';
import assert from 'node:assert';
import { run } from './exec.mjs';

test('exec run success', async () => {
  const { stdout } = await run('echo', ['hello']);
  assert.match(stdout, /hello/);
});

test('exec run failure includes stderr', async () => {
  await assert.rejects(
    async () => {
      await run('node', ['-e', 'console.error("custom error"); process.exit(1);']);
    },
    (err) => {
      return err.message.includes('custom error');
    }
  );
});
