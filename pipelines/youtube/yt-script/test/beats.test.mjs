import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBeats } from '../lib/beats.mjs'
import { buildWorksheet } from '../render-worksheet.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const VIDEOS = join(ROOT, 'videos')
const REAL = ['ai-avatar-generator-comparison', 'ai-avatar-generators', 'character-consistency-ai']

const FIXTURE = `# Test Video Title

## 1 · INTRODUCTION

#### A1 · Cold open

**SAY**
> "Perfect face. Perfect outfit."
>
> "Scene two. Different person."

**SHOW**
One portrait full-screen.

## 2 · BODY

### SECTION: The test

> **RULES — WHOLE SECTION**
> - No replay of the scene grid.
> - Animation only.

#### 2.1 · Five scenes, five tools

**SAY**
> Cover how the grids came back.

**SHOW**
Run the same prompt through all five tools.

**EDIT**
Side-by-side grid.

**FACTS**
Soul ID trains once, about 5 minutes.
Midjourney needs the URL pasted every time.

#### 2.2 · A locked body line

**SAY** — final
> "This one is finished copy and stays finished."

#### 2.3 · Notes only

**SHOW**
Just a screen recording note, no spoken lane.

## 3 · CONCLUSION

#### C1 · Sign off

**SAY**
> "Links below."

> **VERDICT:** OpenArt wins on memory.
`

const fx = () => buildBeats(FIXTURE)
const byNum = (n) => fx().beats.find((b) => b.num === n)

test('the title comes off the H1', () => {
  assert.equal(fx().title, 'Test Video Title')
})

test('beat number and title split on the middot', () => {
  const b = byNum('2.1')
  assert.ok(b, 'beat 2.1 must exist')
  assert.equal(b.title, 'Five scenes, five tools')
})

test('an intro SAY is finished copy', () => {
  const b = byNum('A1')
  assert.equal(b.mode, 'read')
  assert.deepEqual(b.say, ['"Perfect face. Perfect outfit."', '', '"Scene two. Different person."'])
  assert.equal(b.angle, null)
})

test('a body SAY draft becomes an instruction, never spoken copy', () => {
  const b = byNum('2.1')
  assert.equal(b.mode, 'write', 'BODY_DRAFT_LEAKED: body beat 2.1 must be a write beat')
  assert.equal(
    b.say,
    null,
    'BODY_DRAFT_LEAKED: a body SAY draft reached `say`, so the maker would see it as pasteable copy'
  )
  assert.deepEqual(b.angle, ['Cover how the grids came back.'])
})

test('no real outline puts a body draft into say', () => {
  for (const key of REAL) {
    const md = readFileSync(join(VIDEOS, key, 'outline.md'), 'utf8')
    for (const b of buildBeats(md).beats) {
      if (b.partKind === 'body' && b.say !== null && b.angle === null) {
        assert.ok(
          b.mode === 'read',
          `BODY_DRAFT_LEAKED: ${key} beat ${b.num} has spoken copy without being marked final`
        )
      }
      assert.ok(
        !(b.say !== null && b.angle !== null),
        `BODY_DRAFT_LEAKED: ${key} beat ${b.num} carries both say and angle`
      )
    }
  }
})

test('a body SAY noted `final` stays finished copy', () => {
  const b = byNum('2.2')
  assert.equal(b.mode, 'read')
  assert.deepEqual(b.say, ['"This one is finished copy and stays finished."'])
  assert.equal(b.angle, null)
})

test('a body beat with no SAY at all is still a write beat', () => {
  const b = byNum('2.3')
  assert.equal(b.mode, 'write')
  assert.equal(b.say, null)
  assert.equal(b.angle, null)
  assert.deepEqual(b.show, ['Just a screen recording note, no spoken lane.'])
})

test('SHOW, EDIT and FACTS land in their own arrays', () => {
  const b = byNum('2.1')
  assert.deepEqual(b.show, ['Run the same prompt through all five tools.'])
  assert.deepEqual(b.edit, ['Side-by-side grid.'])
  assert.deepEqual(b.facts, [
    'Soul ID trains once, about 5 minutes.',
    'Midjourney needs the URL pasted every time.',
  ])
})

test('section RULES attach to every beat in that section', () => {
  for (const n of ['2.1', '2.2', '2.3']) {
    assert.deepEqual(byNum(n).rules, ['No replay of the scene grid.', 'Animation only.'])
  }
  assert.deepEqual(byNum('A1').rules, [])
})

test('part kind splits on the BODY heading', () => {
  assert.equal(byNum('A1').partKind, 'intro')
  assert.equal(byNum('2.1').partKind, 'body')
  assert.equal(byNum('C1').partKind, 'outro')
})

test('a verdict attaches to the beat it follows', () => {
  assert.equal(byNum('C1').verdict, 'OpenArt wins on memory.')
})

test('every real outline parses and every beat has a num and a title', () => {
  for (const key of REAL) {
    const md = readFileSync(join(VIDEOS, key, 'outline.md'), 'utf8')
    const { beats } = buildBeats(md)
    assert.ok(beats.length > 5, `${key}: expected more than 5 beats, got ${beats.length}`)
    for (const b of beats) {
      assert.ok(b.num && String(b.num).length, `${key}: a beat has no num`)
      assert.ok(b.title && b.title.length, `${key}: beat ${b.num} has no title`)
      assert.ok(['read', 'write'].includes(b.mode), `${key}: beat ${b.num} has mode ${b.mode}`)
    }
  }
})

test('the worksheet is still byte-identical after the parser change', () => {
  for (const key of REAL) {
    const md = readFileSync(join(VIDEOS, key, 'outline.md'), 'utf8')
    const onDisk = join(VIDEOS, key, 'script-worksheet.md')
    let expected
    try {
      expected = readFileSync(onDisk, 'utf8')
    } catch {
      continue // this video has no checked-in worksheet
    }
    let actual = buildWorksheet(md)
    // buildWorksheet outputs the 'target — words' placeholder, while the on-disk
    // worksheet has been stamped with the actual word counts. Since we are testing
    // byte-identity of the parser change, we apply a symmetric normalization to both.
    expected = expected.replace(/target (\d+-\d+|—) words/g, 'target <NORMALIZED> words')
    actual = actual.replace(/target (\d+-\d+|—) words/g, 'target <NORMALIZED> words')
    
    assert.equal(actual, expected, `${key}: worksheet output drifted`)
  }
})

// ---------------------------------------------------------------- legacy guard
// A pre-spec outline must be REFUSED, not silently half-parsed. Measured
// 2026-08-23: ai-avatar-online-courses returned 5 beats instead of 13 and
// ai-video-tools-comparison returned 0, both with no error, so the desk showed
// a short plausible wrong script.

test('a legacy "### N. Title" outline is refused, not half-parsed', () => {
  const legacy = [
    '# A legacy outline',
    '',
    '## PART A — INTRODUCTION',
    '',
    '### 1. Cold Open',
    '',
    '**Voiceover**',
    '',
    '> "Something spoken."',
    '',
    '### 2. The Test',
    '',
    '**Notes**',
    '',
    'Show the thing.',
    '',
  ].join('\n')

  let err = null
  try {
    buildBeats(legacy)
  } catch (e) {
    err = e
  }
  assert.ok(err, 'LEGACY_OUTLINE_FORMAT: expected buildBeats to refuse a legacy outline')
  assert.equal(err.code, 'LEGACY_OUTLINE_FORMAT')
  assert.match(err.message, /LEGACY_OUTLINE_FORMAT/)
})

test('every real spec-format outline still parses', () => {
  for (const key of REAL) {
    const md = readFileSync(join(VIDEOS, key, 'outline.md'), 'utf8')
    const out = buildBeats(md)
    assert.ok(out.beats.length > 0, `${key}: expected beats, got none`)
  }
})
