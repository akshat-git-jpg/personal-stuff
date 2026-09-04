import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { rangeForText, ensureWords } from '../lib/timings.mjs'

const wordsJsonPath = join(import.meta.dirname, 'fixtures/words-s01.json')
const fixture = JSON.parse(readFileSync(wordsJsonPath, 'utf8'))

test('rangeForText: exact match', () => {
  const { start_sec, end_sec, matched_words } = rangeForText('jumps over the', fixture.words)
  assert.strictEqual(start_sec, 1.5)
  assert.strictEqual(end_sec, 2.8)
  assert.strictEqual(matched_words, 3)
})

test('rangeForText: trailing punctuation ignored', () => {
  const { start_sec, end_sec, matched_words } = rangeForText('hello world.', fixture.words)
  assert.strictEqual(start_sec, 3.5)
  assert.strictEqual(end_sec, 4.5)
  assert.strictEqual(matched_words, 2)
})

test('rangeForText: case-insensitive match', () => {
  const { start_sec, end_sec, matched_words } = rangeForText('HeLlO wOrLd', fixture.words)
  assert.strictEqual(start_sec, 3.5)
  assert.strictEqual(end_sec, 4.5)
  assert.strictEqual(matched_words, 2)
})

test('rangeForText: one-word skip tolerated', () => {
  const { start_sec, end_sec, matched_words } = rangeForText('the quick brown fox', fixture.words)
  assert.strictEqual(start_sec, 0.0)
  assert.strictEqual(end_sec, 1.5)
  assert.strictEqual(matched_words, 4)
})

test('rangeForText: too many misses throws', () => {
  assert.throws(() => rangeForText('totally unrelated sentence here', fixture.words), /rangeForText: text not found/)
})

test('ensureWords: reads cached JSON', () => {
  let called = false
  const execFn = () => { called = true; throw new Error('should not spawn') }
  const res = ensureWords('testkey', 's01', {
    cachePath: wordsJsonPath,
    execFileSync: execFn
  })
  assert.strictEqual(called, false)
  assert.strictEqual(res.duration_sec, 12.0)
})
