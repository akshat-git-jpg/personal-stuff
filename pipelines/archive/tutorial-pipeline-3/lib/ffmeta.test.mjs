import test from 'node:test';
import assert from 'node:assert';
import { durationOf, heightOf } from './ffmeta.mjs';

test('durationOf parses correct duration', async () => {
  const runner = async (cmd, args) => {
    assert.strictEqual(cmd, 'ffprobe');
    assert.ok(args.includes('format=duration'));
    return { stdout: '12.345\n' };
  };
  const duration = await durationOf('test.mp4', runner);
  assert.strictEqual(duration, 12.345);
});

test('durationOf throws on invalid output', async () => {
  const runner = async () => ({ stdout: 'invalid\n' });
  await assert.rejects(durationOf('test.mp4', runner), /Invalid duration/);
});

test('heightOf parses correct height', async () => {
  const runner = async (cmd, args) => {
    assert.strictEqual(cmd, 'ffprobe');
    assert.ok(args.includes('stream=height'));
    return { stdout: '1080\n' };
  };
  const height = await heightOf('test.mp4', runner);
  assert.strictEqual(height, 1080);
});

test('heightOf throws on invalid output', async () => {
  const runner = async () => ({ stdout: 'invalid\n' });
  await assert.rejects(heightOf('test.mp4', runner), /Invalid height/);
});
