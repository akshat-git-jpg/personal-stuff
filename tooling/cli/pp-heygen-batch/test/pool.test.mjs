import { test } from 'node:test'
import assert from 'node:assert'
import { checkPool, readUsageSnapshot } from '../lib/pool.mjs'

test('checkPool: all III selections + empty pool -> ok', () => {
  const res = checkPool([{ engine: 'heygen3' }], new Map([['s01', 10]]), { seconds_remain: 0 })
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.requestedIvSec, 0)
})

test('checkPool: one IV selection fits -> ok', () => {
  const res = checkPool([{ engine: 'heygen4', section_id: 's01' }], new Map([['s01', 10]]), { seconds_remain: 20 })
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.requestedIvSec, 10)
})

test('checkPool: two IV selections sum > pool -> not ok', () => {
  const res = checkPool(
    [{ engine: 'heygen4', section_id: 's01' }, { engine: 'heygen4', section_id: 's02' }],
    new Map([['s01', 15], ['s02', 15]]),
    { seconds_remain: 20 }
  )
  assert.strictEqual(res.ok, false)
  assert.ok(res.reason.includes('~30s'))
  assert.ok(res.reason.includes('20s left'))
})

test('checkPool: mixed III + IV where IV alone fits -> ok', () => {
  const res = checkPool(
    [{ engine: 'heygen3', section_id: 's01' }, { engine: 'heygen4', section_id: 's02' }],
    new Map([['s01', 15], ['s02', 15]]),
    { seconds_remain: 20 }
  )
  assert.strictEqual(res.ok, true)
  assert.strictEqual(res.requestedIvSec, 15)
})

test('checkPool: usage is null -> treat as 0', () => {
  const res = checkPool([{ engine: 'heygen4', section_id: 's01' }], new Map([['s01', 10]]), null)
  assert.strictEqual(res.ok, false)
  assert.strictEqual(res.poolRemain, 0)
})

test('readUsageSnapshot: parses JSON from stdout', () => {
  const execFn = (bin, args) => {
    assert.strictEqual(bin, 'node')
    assert.deepStrictEqual(args, ['tooling/cli/heygen-web/heygen-web.mjs', 'usage'])
    return '{"seconds_remain": 42}'
  }
  const snap = readUsageSnapshot(execFn)
  assert.strictEqual(snap.seconds_remain, 42)
})
