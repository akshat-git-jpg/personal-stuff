import { test } from 'node:test'
import assert from 'node:assert'
import { resolveSlugToVerb, submitOne, waitForCompletion, downloadOne } from '../lib/heygen.mjs'

test('resolveSlugToVerb: template_id -> generate-from-template', () => {
  const res = resolveSlugToVerb('girl-1', { 'girl-1': { template_id: 'X' } })
  assert.deepStrictEqual(res, { verb: 'generate-from-template', flag: '--template', value: 'girl-1' })
})

test('resolveSlugToVerb: avatar_id -> generate-from-audio', () => {
  const res = resolveSlugToVerb('some-photo', { 'some-photo': { avatar_id: 'Y' } })
  assert.deepStrictEqual(res, { verb: 'generate-from-audio', flag: '--avatar', value: 'some-photo' })
})

test('resolveSlugToVerb: bogus throws', () => {
  assert.throws(() => resolveSlugToVerb('bogus', {}), /heygen: unknown slug bogus/)
})

test('resolveSlugToVerb: missing id throws', () => {
  assert.throws(() => resolveSlugToVerb('empty', { 'empty': {} }), /neither template_id nor avatar_id/)
})

test('submitOne: returns video_id', async () => {
  let calledArgs
  const execFn = (bin, args) => {
    calledArgs = args
    return '{"video_id":"abc"}\n'
  }
  const vid = await submitOne({
    selection: { id: 'sel-1' },
    wavSlice: '/tmp/slice.wav',
    slug: 'girl-1',
    engineFlag: 'heygen4',
    heygenWebBin: 'hw.mjs',
    execFn,
    registryJson: { 'girl-1': { template_id: 'X' } }
  })
  assert.strictEqual(vid, 'abc')
  assert.ok(calledArgs.includes('--engine'))
  assert.ok(calledArgs.includes('heygen4'))
})

test('waitForCompletion: returns COMPLETED immediately', async () => {
  const execFn = () => '{"status":"COMPLETED","progress":100}'
  const res = await waitForCompletion('abc', { heygenWebBin: 'hw.mjs', execFn })
  assert.strictEqual(res.status, 'COMPLETED')
})

test('waitForCompletion: throws on FAILED', async () => {
  const execFn = () => '{"status":"FAILED"}'
  await assert.rejects(
    waitForCompletion('abc', { heygenWebBin: 'hw.mjs', execFn }),
    /heygen: submit abc FAILED/
  )
})
