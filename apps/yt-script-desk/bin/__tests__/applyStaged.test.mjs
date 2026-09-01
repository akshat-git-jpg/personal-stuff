// `desk.mjs apply` splices every STAGED in-place edit into script-plan.md in one
// pass. Owner, 2026-08-29: *"can we do commit in 1 go. i will edit wherever
// required and tell you once all are reviewed and done. then you can update/edit
// in 1 go."*
//
// The failure this guards is silent and expensive: a splice that lands on the
// wrong block rewrites a section the owner never touched, and he would only find
// it by reading the whole plan again. So these check WHICH card changed, not just
// that something did.
import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBeats } from '../../../../pipelines/youtube/yt-script/lib/beats.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DESK = join(HERE, '..', 'desk.mjs')

const PLAN = `# Two Level Video

## Contents
1. What Makes a Vox Style Video Look Like Vox
2. How to Make a Vox Style Video with AI
   2.1 Picking a Topic That Holds Up
   2.2 Writing the Script

## 1 · INTRODUCTION

#### A1 · Cold open

**VIDEO**
About 12 seconds of the finished shot.
No browser, no logo.

**SAY**
> The first line.
> The second line.

## 2 · BODY

### SECTION: What Makes a Vox Style Video Look Like Vox

**NOTES**
- The background never moves.
- Sources: Joseph https://youtu.be/PaXuebdY75U

### SECTION: How to Make a Vox Style Video with AI

#### Picking a Topic That Holds Up

**NOTES**
- One narrator has to carry it.

#### Writing the Script

**NOTES**
- Edit the draft in place.

## 3 · CONCLUSION

#### C1 · Sign-off

**SAY**
> Thanks for watching.
`


// A plan in the OLDER shape: its body instructions are `**VIDEO**` blocks, not
// `**NOTES**`. The desk shows them in the same column either way (`laneLines`
// merges the lanes), so they are editable, and everything that goes wrong on the
// write path goes wrong here rather than on the plan above.
const VIDEO_PLAN = `# Video Lane Plan

## Contents
1. What Makes It Work
2. How To Do It
   2.1 Step One

## 1 · INTRODUCTION

#### A1 · Cold open

**VIDEO**
About 12 seconds of the finished shot.

**SAY**
> The first line.
> The second line.

## 2 · BODY

### SECTION: What Makes It Work

**VIDEO**
Leaf section instruction.

### SECTION: How To Do It

#### Step One

**VIDEO**
Subsection instruction.

## 3 · CONCLUSION

#### C1 · Sign-off

**SAY**
> Thanks for watching.
`

// What the desk actually SHOWS in the Notes column — the merge, in WriteView order.
const shown = (b) =>
  b ? [...(b.notes ?? []), ...(b.angle ?? []), ...(b.video ?? []), ...(b.rules ?? []), ...(b.facts ?? [])] : []

const buildBeatsOf = (md) => buildBeats(md).beats.map((b) => [b.num, b])

// `DESK_VIDEOS_ROOT` points desk.mjs at a scratch tree. The fixture never goes
// near the real `videos/` directory, which every plan-walking test iterates.
function withFixture(staged, fn, plan = PLAN) {
  const root = mkdtempSync(join(tmpdir(), 'desk-apply-'))
  const key = 'fixture'
  const dir = join(root, key)
  mkdirSync(dir, { recursive: true })
  try {
    writeFileSync(join(dir, 'script-plan.md'), plan)
    writeFileSync(join(dir, 'desk-draft.json'), JSON.stringify(staged, null, 2))
    const out = execFileSync('node', [DESK, 'apply', key], {
      encoding: 'utf8',
      env: { ...process.env, DESK_VIDEOS_ROOT: root },
    })
    return fn({ key, dir, out, md: readFileSync(join(dir, 'script-plan.md'), 'utf8') })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('desk.mjs apply', () => {
  it('APPLY_WRONG_CARD: a staged note edit lands on the card it came from', () => {
    withFixture(
      {
        notes: { '2.2': ['- REPLACED, and only here.'] },
        noteEdits: { '2.2': { original: ['- Edit the draft in place.'], at: 'x' } },
      },
      ({ md }) => {
        const { beats } = buildBeats(md)
        const byNum = Object.fromEntries(beats.map((b) => [b.num, b]))

        expect(byNum['2.2'].notes).toEqual(['- REPLACED, and only here.'])
        expect(byNum['2.1'].notes, 'a sibling changed').toEqual(['- One narrator has to carry it.'])
        expect(byNum['1'].notes, 'the leaf section changed').toEqual([
          '- The background never moves.',
          '- Sources: Joseph https://youtu.be/PaXuebdY75U',
        ])
      },
    )
  })

  it('APPLY_LEAF_SECTION: a section with no subsections is spliced correctly too', () => {
    withFixture(
      {
        notes: { 1: ['- LEAF REPLACED.'] },
        noteEdits: { 1: { original: ['- The background never moves.'], at: 'x' } },
      },
      ({ md }) => {
        const byNum = Object.fromEntries(buildBeats(md).beats.map((b) => [b.num, b]))
        expect(byNum['1'].notes).toEqual(['- LEAF REPLACED.'])
        expect(byNum['2.1'].notes).toEqual(['- One narrator has to carry it.'])
      },
    )
  })

  it('APPLY_SPOKEN: a staged spoken edit keeps its blockquote', () => {
    withFixture(
      {
        says: { A1: ['A brand new first line.', 'And a second.'] },
        edits: { A1: { original: ['The first line.', 'The second line.'], at: 'x' } },
      },
      ({ md }) => {
        expect(md).toMatch(/^> A brand new first line\.$/m)
        expect(md).toMatch(/^> And a second\.$/m)
        expect(md.includes('The first line.'), 'the old spoken copy is still there').toBe(false)
        const beat = buildBeats(md).beats.find((b) => b.num === 'A1')
        expect(beat.say).toEqual(['A brand new first line.', 'And a second.'])
      },
    )
  })

  it('APPLY_CLEARS_STAGE: the staged store is emptied so nothing applies twice', () => {
    withFixture(
      {
        draft: { '2.1': 'his words' },
        notes: { '2.1': ['- ONE.'] },
        noteEdits: { '2.1': { original: ['- One narrator has to carry it.'], at: 'x' } },
      },
      ({ dir }) => {
        const after = JSON.parse(readFileSync(join(dir, 'desk-draft.json'), 'utf8'))
        expect(after.notes).toEqual({})
        expect(after.noteEdits).toEqual({})
        expect(after.draft, "the maker's own writing was cleared").toEqual({ '2.1': 'his words' })
      },
    )
  })

  it('APPLY_MULTI: several edits at once do not shift each other', () => {
    withFixture(
      {
        notes: {
          1: ['- FIRST.', '- FIRST B.', '- FIRST C.'],
          '2.1': ['- SECOND.'],
          '2.2': ['- THIRD.', '- THIRD B.'],
        },
        noteEdits: {
          1: { original: [], at: 'x' },
          '2.1': { original: [], at: 'x' },
          '2.2': { original: [], at: 'x' },
        },
      },
      ({ md }) => {
        const byNum = Object.fromEntries(buildBeats(md).beats.map((b) => [b.num, b]))
        expect(byNum['1'].notes).toEqual(['- FIRST.', '- FIRST B.', '- FIRST C.'])
        expect(byNum['2.1'].notes).toEqual(['- SECOND.'])
        expect(byNum['2.2'].notes).toEqual(['- THIRD.', '- THIRD B.'])
      },
    )
  })

  // An intro beat has no NOTES lane. The desk builds its Notes column from the
  // beat's VIDEO lane, so an edit there has to land back in VIDEO — it was
  // silently skipped until 2026-08-29, which threw the edit away.
  it('APPLY_INTRO_VIDEO: a note edit on an intro beat writes back to its VIDEO lane', () => {
    withFixture(
      {
        notes: { A1: ['Rewritten shot note.', 'And a second line.'] },
        noteEdits: { A1: { original: ['About 12 seconds of the finished shot.'], at: 'x' } },
      },
      ({ md, out }) => {
        expect(out, 'the edit was skipped instead of applied').not.toMatch(/SKIPPED/)
        expect(md).toMatch(/^\*\*VIDEO\*\*$/m)
        expect(md).toMatch(/^Rewritten shot note\.$/m)
        expect(md).toMatch(/^And a second line\.$/m)
        // The header must stay VIDEO. A `**NOTES**` lane in the introduction
        // would be read as a body card by the parser.
        expect(md.includes('**NOTES**\nRewritten shot note.')).toBe(false)

        const beat = buildBeats(md).beats.find((b) => b.num === 'A1')
        expect(beat.video).toEqual(['Rewritten shot note.', 'And a second line.'])
        expect(beat.say, 'the spoken copy was touched').toEqual([
          'The first line.',
          'The second line.',
        ])
      },
    )
  })

  // Clicking through a page of always-open boxes blurs every one of them. A blur
  // that changed nothing must not appear in the review list.
  it('NOOP_STAGED: an edit identical to the file is not listed', () => {
    withFixture(
      {
        notes: { '2.2': ['- Edit the draft in place.'] },
        noteEdits: { '2.2': { original: ['- Edit the draft in place.'], at: 'x' } },
      },
      ({ out, md }) => {
        expect(out).toMatch(/nothing staged|applied 0/)
        expect(md).toMatch(/^- Edit the draft in place\.$/m)
      },
    )
  })

  // A plan written before the NOTES lane existed puts its instructions in
  // `**VIDEO**` blocks, and the desk's Notes column shows them because
  // `laneLines` merges the two. Editing that column staged an edit whose number
  // came from `buildBeats` (`1.1`, `2.1`) while `apply` looked it up in
  // `buildEditModel`, which numbers `####` headings positionally (`6`, `7`). The
  // lookup missed EVERY time, the edit was pushed onto `skipped`, and the run
  // printed a count. Measured 2026-09-01 against the owner's real store:
  // `0 edit(s) would be applied; 4 skipped`.
  it('APPLY_VIDEO_LANE: an edit to a VIDEO-lane body card is applied, not skipped', () => {
    withFixture(
      {
        notes: { '2.1': ['- Rewritten through the desk.'] },
        noteEdits: { '2.1': { original: [], at: 'x' } },
      },
      ({ md, out }) => {
        const byNum = Object.fromEntries(buildBeatsOf(md))
        expect(out, 'the edit was skipped instead of applied').not.toMatch(/SKIPPED/)
        expect(shown(byNum['2.1'])).toEqual(['- Rewritten through the desk.'])
      },
      VIDEO_PLAN,
    )
  })

  it('APPLY_VIDEO_LANE_HEADER: it writes back under **VIDEO**, not a new **NOTES**', () => {
    withFixture(
      { notes: { '2.1': ['- Rewritten.'] }, noteEdits: { '2.1': { original: [], at: 'x' } } },
      ({ md }) => {
        expect(md).toMatch(/\*\*VIDEO\*\*\n- Rewritten\./)
        expect(md.includes('**NOTES**'), 'grew a NOTES lane the plan never had').toBe(false)
      },
      VIDEO_PLAN,
    )
  })

  // The block parser collects an unquoted lane until the first EMPTY line, so a
  // blank written into the middle of one truncates it on the next read — and the
  // file still parses, so nothing complained. The owner separates his bullets
  // with blank lines: 37 lines went in, 9 came back.
  it('APPLY_BLANK_LINE: a blank line inside a staged note cannot truncate the block', () => {
    withFixture(
      {
        notes: { '2.1': ['- first', '', '- second', '', '- third'] },
        noteEdits: { '2.1': { original: [], at: 'x' } },
      },
      ({ md }) => {
        const byNum = Object.fromEntries(buildBeatsOf(md))
        expect(shown(byNum['2.1'])).toEqual(['- first', '- second', '- third'])
      },
      VIDEO_PLAN,
    )
  })

  // The guard that matters most, because it is the only one that catches the
  // NEXT bug of this shape rather than the three already found. Every one of them
  // wrote a file that parsed perfectly and had lost the edit anyway.
  it('APPLY_ROUND_TRIP: what goes in is what reads back, on every applied edit', () => {
    const staged = {
      notes: { '2.1': ['- a', '- b'] },
      noteEdits: { '2.1': { original: [], at: 'x' } },
      says: { A1: ['Spoken one.', '', 'Spoken two.'] },
      edits: { A1: { original: ['The first line.', 'The second line.'], at: 'x' } },
    }
    withFixture(staged, ({ md }) => {
      const byNum = Object.fromEntries(buildBeatsOf(md))
      expect(shown(byNum['2.1'])).toEqual(['- a', '- b'])
      expect(byNum['A1'].say).toEqual(['Spoken one.', '', 'Spoken two.'])
    }, VIDEO_PLAN)
  })

})
