import { test } from 'node:test'
import assert from 'node:assert'
import { sliceWav, probeDurationSec } from '../lib/slice.mjs'

test('sliceWav: calls ffmpeg with correct args', () => {
  let calledBin, calledArgs
  const execFn = (bin, args) => {
    calledBin = bin
    calledArgs = args
  }
  sliceWav('/tmp/s01.wav', 1.0, 3.5, '/tmp/out.wav', { execFileSync: execFn })
  
  assert.strictEqual(calledBin, 'ffmpeg')
  assert.deepStrictEqual(calledArgs, [
    '-y',
    '-loglevel', 'error',
    '-i', '/tmp/s01.wav',
    '-ss', '1.000',
    '-t', '2.500',
    '-c', 'copy',
    '/tmp/out.wav'
  ])
})

test('sliceWav: throws on invalid duration', () => {
  assert.throws(() => sliceWav('/tmp/s01.wav', 5.0, 4.0, '/tmp/out.wav'), /sliceWav: non-positive duration/)
})

test('probeDurationSec: parses float from output', () => {
  const execFn = () => '12.345\n'
  const duration = probeDurationSec('/tmp/s01.wav', { execFileSync: execFn })
  assert.strictEqual(duration, 12.345)
})
