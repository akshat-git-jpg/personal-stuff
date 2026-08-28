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
// Was the three 2026-08 videos. The owner deleted them on 2026-08-28 — *"You can
// remove older videos scripts, consider this as the first video which we are
// testing using this flow"* — so `vox-style-video-ai` is now the only real plan
// and the only fixture. Add a key here when a second video reaches step 050.
const REAL = ['vox-style-video-ai']

const FIXTURE = `# Test Video Title

## 1 · INTRODUCTION

#### A1 · Cold open

**SAY**
> "Perfect face. Perfect outfit."
>
> "Scene two. Different person."

**VIDEO**
One portrait full-screen.

## 2 · BODY

### SECTION: The test

> **RULES — WHOLE SECTION**
> - No replay of the scene grid.
> - Animation only.

#### 2.1 · Five scenes, five tools

**SAY**
> Cover how the grids came back.

**VIDEO**
Run the same prompt through all five tools.
Side-by-side grid.

**FACTS**
Soul ID trains once, about 5 minutes.
Midjourney needs the URL pasted every time.

#### 2.2 · A locked body line

**SAY** — final
> "This one is finished copy and stays finished."

#### 2.3 · Notes only

**VIDEO**
Just a video note, no spoken lane.

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
    const md = readFileSync(join(VIDEOS, key, 'script-plan.md'), 'utf8')
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
  assert.deepEqual(b.video, ['Just a video note, no spoken lane.'])
})

test('VIDEO and FACTS land in their own arrays', () => {
  const b = byNum('2.1')
  assert.deepEqual(b.video, ['Run the same prompt through all five tools.', 'Side-by-side grid.'])
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
    const md = readFileSync(join(VIDEOS, key, 'script-plan.md'), 'utf8')
    const { beats } = buildBeats(md)
    assert.ok(beats.length > 5, `${key}: expected more than 5 beats, got ${beats.length}`)
    for (const b of beats) {
      assert.ok(b.num && String(b.num).length, `${key}: a beat has no num`)
      assert.ok(b.title && b.title.length, `${key}: beat ${b.num} has no title`)
      assert.ok(['read', 'write'].includes(b.mode), `${key}: beat ${b.num} has mode ${b.mode}`)
    }
  }
})

test('the worksheet is still byte-identical after the parser change', (t) => {
  const checked = []
  for (const key of REAL) {
    const md = readFileSync(join(VIDEOS, key, 'script-plan.md'), 'utf8')
    const onDisk = join(VIDEOS, key, 'script-worksheet.md')
    let expected
    try {
      expected = readFileSync(onDisk, 'utf8')
    } catch {
      // No worksheet checked in for this video yet — one is generated later in
      // the flow. Say so out loud. Until 2026-08-28 this was a bare `continue`,
      // and when the older videos were deleted (the only one with a worksheet on
      // disk went with them) this whole test started passing with ZERO
      // assertions and no sign of it. A vacuous green test is the same failure
      // shape as the two bugs logged in FEEDBACK-LOG.md the same night.
      checked.push(`${key}: SKIPPED, no script-worksheet.md on disk yet`)
      continue
    }
    let actual = buildWorksheet(md)
    // buildWorksheet outputs the 'target — words' placeholder, while the on-disk
    // worksheet has been stamped with the actual word counts. Since we are testing
    // byte-identity of the parser change, we apply a symmetric normalization to both.
    expected = expected.replace(/target (\d+-\d+|—) words/g, 'target <NORMALIZED> words')
    actual = actual.replace(/target (\d+-\d+|—) words/g, 'target <NORMALIZED> words')
    
    assert.equal(actual, expected, `${key}: worksheet output drifted`)
    checked.push(`${key}: compared`)
  }
  t.diagnostic(checked.join(' | ') || 'no videos in REAL')
})

// ------------------------------------------------- section-level FACTS
// A `FACTS` block between a `### SECTION:` heading and that section's first beat
// belongs to the SECTION. It used to hit `if (!pending) continue` and be dropped
// in SILENCE.
//
// Measured 2026-08-28: every one of the eleven sections in vox-style-video-ai
// carried one — ten to fifteen lines of research each — and NONE of it reached
// the desk. The markdown looked right, the UI looked right, and the freelancer
// was simply never shown the material behind the section he was filming. It
// surfaced only because the owner asked for source links, they went into those
// blocks, and he could not find them: *"not seeing."*
//
// RULES were already handled this way. FACTS were not, and nothing said so.
test('a FACTS block before the first beat of a section is not dropped', () => {
  const md = [
    '# T',
    '',
    '## 1 · INTRODUCTION',
    '',
    '#### 1.1 · Open',
    '',
    '**SAY** — final',
    '> A line.',
    '',
    '## 2 · BODY',
    '',
    '### SECTION: The section',
    '',
    '> **RULES — WHOLE SECTION**',
    '> - A rule.',
    '',
    '**FACTS**',
    'A section fact.',
    'Who these people are: Someone https://youtu.be/aaaaaaaaaaa',
    '',
    '#### 2.1 · First',
    '',
    '**SAY**',
    'Cover the thing.',
    '',
    '#### 2.2 · Second',
    '',
    '**SAY**',
    'Cover the other thing.',
    '',
  ].join('\n')

  const { beats } = buildBeats(md)
  const first = beats.find((b) => b.num === '2.1')
  const second = beats.find((b) => b.num === '2.2')

  assert.deepEqual(
    first.facts,
    ['A section fact.', 'Who these people are: Someone https://youtu.be/aaaaaaaaaaa'],
    'SECTION_FACTS_DROPPED: the section FACTS block never reached a beat, so the research behind the section is invisible in the desk',
  )
  // Once, not on every beat. RULES repeat because breaking one breaks the video;
  // FACTS are context to read at the top of the section.
  assert.deepEqual(
    second.facts,
    [],
    'SECTION_FACTS_REPEATED: the section FACTS block was copied onto every beat, which turns the notes track into wallpaper',
  )
  assert.deepEqual(second.rules, ['A rule.'], 'RULES_NOT_REPEATED: a section rule must appear on every beat of the section')
})

test('a beat-level FACTS block is not swallowed by the section one', () => {
  const md = [
    '# T',
    '',
    '## 1 · INTRODUCTION',
    '',
    '#### 1.1 · Open',
    '',
    '**SAY** — final',
    '> A line.',
    '',
    '## 2 · BODY',
    '',
    '### SECTION: S',
    '',
    '**FACTS**',
    'Section fact.',
    '',
    '#### 2.1 · One',
    '',
    '**SAY**',
    'Do it.',
    '',
    '**FACTS**',
    'Beat fact.',
    '',
  ].join('\n')
  const { beats } = buildBeats(md)
  const b = beats.find((x) => x.num === '2.1')
  assert.deepEqual(
    b.facts,
    ['Section fact.', 'Beat fact.'],
    'FACTS_LOST: a beat that has both a section FACTS block and its own must carry both, section first',
  )
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
    const md = readFileSync(join(VIDEOS, key, 'script-plan.md'), 'utf8')
    const out = buildBeats(md)
    assert.ok(out.beats.length > 0, `${key}: expected beats, got none`)
  }
})

// SHOW and EDIT were two lanes until 2026-08-28, when the owner merged them:
// *"I don't like having screen recording notes and video editing notes, can you
// just club them both together and make it just video notes."* Nothing in the
// repo writes them any more, but a plan drafted before the merge still might,
// and silently dropping half a beat's instructions is the worst possible
// outcome. Both fold into `video`, in the order they were written.
test('a pre-merge SHOW and EDIT fold into the one video lane, in order', () => {
  const { beats } = buildBeats(`# T

## 1 · INTRODUCTION

#### A1 · Old lanes

**SAY**
> "A line."

**SHOW**
Film the panel.

**EDIT**
Trim the pause.

## 2 · BODY

### SECTION: S

#### 2.1 · Body beat

**SAY**
> Cover the thing.
`)
  const b = beats.find((x) => x.num === 'A1')
  assert.deepEqual(b.video, ['Film the panel.', 'Trim the pause.'])
  assert.equal(b.show, undefined, 'the merged parser must not keep a separate show array')
  assert.equal(b.edit, undefined, 'the merged parser must not keep a separate edit array')
})

// ---------------------------------------------------------------- section cards
//
// A body section is ONE card since 2026-08-29: the section heading, one flat
// `**NOTES**` bullet list, and one thing for the maker to write. It replaced five
// to seven `#### 2.n` beats per section, each with its own SAY / VIDEO / FACTS
// lanes. Owner: *"I want high level section distinction and their information
// that's it don't break down too much that it's cluttering everything and removes
// the creative freedom from the freelancer."*
//
// There is no `####` heading under a card, so the beat is synthesized from the
// section. These guard the two ways that can go wrong: the card never appearing
// at all, and an old plan's beats being swallowed by it.

const CARDS = `# Card Video

## 1 · INTRODUCTION

#### A1 · Cold open

**SAY**
> The first line.

## 2 · BODY

### SECTION: What makes it look like Vox

**NOTES**
- The background never moves.
- Sources: Joseph https://youtu.be/PaXuebdY75U

### SECTION: Why one tool beats five

**NOTES**
- Every route runs the same five steps.

## 3 · CONCLUSION

#### C1 · Sign-off

**SAY**
> Thanks for watching.
`

test('CARD_DROPPED: a body section with a NOTES lane becomes one card beat', () => {
  const { beats } = buildBeats(CARDS)
  const body = beats.filter((b) => b.partKind === 'body')

  assert.equal(body.length, 2, 'one card per body section, no more and no fewer')
  assert.deepEqual(
    body.map((b) => b.section),
    ['What makes it look like Vox', 'Why one tool beats five'],
  )
  assert.deepEqual(
    body.map((b) => b.num),
    ['2.1', '2.2'],
    'cards number from the part number, in order',
  )
  for (const card of body) {
    assert.equal(card.mode, 'write', 'a card is something he writes')
    assert.equal(card.title, card.section, 'the card IS the section, so it carries its name')
    assert.ok(card.notes.length > 0, 'the bullets must reach the card')
  }
})

test('CARD_NOTES_VERBATIM: the bullet list reaches the desk unchanged', () => {
  const { beats } = buildBeats(CARDS)
  const first = beats.find((b) => b.partKind === 'body')

  assert.deepEqual(first.notes, [
    '- The background never moves.',
    '- Sources: Joseph https://youtu.be/PaXuebdY75U',
  ])
})

test('CARD_ATE_A_BEAT: an older plan with real beats still parses beat by beat', () => {
  // The synthesizing branch fires only on NOTES. A plan in the old shape has
  // none, so nothing about it may change.
  const { beats } = buildBeats(FIXTURE)
  const body = beats.filter((b) => b.partKind === 'body')

  assert.ok(body.length > 0)
  for (const b of body) {
    assert.deepEqual(b.notes, [], 'an old-shape beat carries no card bullets')
  }
})

test('CARD_HAS_NO_WORKSHEET_SLOT: the desk-down fallback still gives him a place to write', () => {
  // The worksheet emits a slot per SAY block, and a card has no SAY. Without its
  // own branch every body section would vanish from the fallback file.
  const md = buildWorksheet(CARDS)

  assert.match(md, /#### B1 · What makes it look like Vox/)
  assert.match(md, /#### B2 · Why one tool beats five/)
  // The intro line "Fill the empty **Voiceover** slots" is one of the matches,
  // so count the slot HEADINGS rather than the word.
  assert.equal((md.match(/^#### B\d+ · /gm) ?? []).length, 2, 'one write slot per card')
  assert.ok(!md.includes('The background never moves.'), 'bullets stay out of the worksheet')
})
