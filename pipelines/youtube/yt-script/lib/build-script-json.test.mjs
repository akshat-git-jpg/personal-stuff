// The emitted script.json is checked against tp3's OWN validateScript, not a
// local copy of the rules: if tp3's schema moves, this suite goes red instead of
// yt-script silently emitting a shape vo-synth cannot read.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseScriptMd, buildScriptJson, wordCount, SCHEMA_ERROR, SHORT_BEAT_ERROR } from './build-script-json.mjs'
import { validateScript } from '../../tutorial-pipeline-3/lib/schema.mjs'

const MD = `# Some Video — Script

## PART A — INTRODUCTION

### 1. Cold Open

**Voiceover**
> "Every time a course update breaks a lesson, you know what happens next, and
> that is the bottleneck these tools are supposed to fix."

**Notes**
[Visual placeholder — open on a montage of studio setup.]

### 2. Reveal

**Voiceover**
> "So I tested five of the leading platforms, scoring each one on realism, voice
> quality and pricing, and by the end you will know which one fits."

## PART B — BODY

### 3. Quick Overview

**Voiceover**
> "Before we get into scoring, let us take a quick look at what each of these
> five platforms actually offers you today."

**Notes**
Show each dashboard. Hide the billing page.

## PART C — VERDICT

### 4. Final Recommendation

**Voiceover**
> "None of these are bad, they are just built for different priorities, and the
> one I would pick is the second."
`

test('parseScriptMd finds every beat, its part and its notes', () => {
  const beats = parseScriptMd(MD)
  assert.equal(beats.length, 4)
  assert.deepEqual(beats.map((b) => b.number), [1, 2, 3, 4])
  assert.deepEqual(beats.map((b) => b.part), ['A', 'A', 'B', 'C'])
  assert.match(beats[0].display_text, /^Every time a course update/)
  assert.doesNotMatch(beats[0].display_text, /^>/, 'blockquote marker survived')
  assert.doesNotMatch(beats[0].display_text, /^"/, 'wrapping quote survived')
  assert.match(beats[0].notes, /Visual placeholder/)
  assert.equal(beats[1].notes, '', 'a beat with no Notes block gets an empty string')
  assert.match(beats[2].notes, /Hide the billing page/)
})

test('the emitted object passes tp3 validateScript', () => {
  const { script, errors } = buildScriptJson('some-video', parseScriptMd(MD))
  assert.deepEqual(errors, [], 'builder reported its own errors')
  const res = validateScript(script)
  assert.deepEqual(res.errors, [], `SECTIONS_SCHEMA_BAD: ${res.errors.join(' | ')}`)
  assert.ok(res.ok)
})

test('ids are sequential sNN and PART B is the demo section', () => {
  const { script } = buildScriptJson('some-video', parseScriptMd(MD))
  assert.deepEqual(script.sections.map((s) => s.id), ['s01', 's02', 's03', 's04'])
  assert.deepEqual(script.sections.map((s) => s.demo), [false, false, true, false])
  assert.deepEqual(
    script.sections.map((s) => s.recording.status),
    ['none', 'none', 'pending', 'none'],
  )
})

test('stage is tts and spoken_text is empty, so respell.json can apply', () => {
  const { script } = buildScriptJson('some-video', parseScriptMd(MD))
  assert.equal(script.stage, 'tts', 'stage must be tts: vo-synth rejects anything else that allows empty spoken_text')
  for (const s of script.sections) {
    assert.equal(s.spoken_text, '', 'deriveSpoken only runs when spoken_text is empty')
  }
})

test('a beat under 8 words is reported, never padded', () => {
  const short = MD.replace(
    '> "None of these are bad, they are just built for different priorities, and the\n> one I would pick is the second."',
    '> "Links below."',
  )
  const { errors } = buildScriptJson('some-video', parseScriptMd(short))
  assert.ok(
    errors.some((e) => e.startsWith(SHORT_BEAT_ERROR)),
    `expected a ${SHORT_BEAT_ERROR}, got: ${errors.join(' | ')}`,
  )
})

test('a surviving VERIFY marker is an error', () => {
  const flagged = MD.replace('the second."', 'the [VERIFY: which one] second."')
  const { errors } = buildScriptJson('some-video', parseScriptMd(flagged))
  assert.ok(errors.some((e) => e.includes('[VERIFY:')), `got: ${errors.join(' | ')}`)
})

test('a bad key is rejected', () => {
  const { errors } = buildScriptJson('Some Video', parseScriptMd(MD))
  assert.ok(errors.some((e) => e.startsWith(SCHEMA_ERROR)), `got: ${errors.join(' | ')}`)
})

test('wordCount ignores whitespace runs', () => {
  assert.equal(wordCount('  a   b \n c '), 3)
})
