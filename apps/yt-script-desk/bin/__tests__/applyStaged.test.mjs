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

// `DESK_VIDEOS_ROOT` points desk.mjs at a scratch tree. The fixture never goes
// near the real `videos/` directory, which every plan-walking test iterates.
function withFixture(staged, fn) {
  const root = mkdtempSync(join(tmpdir(), 'desk-apply-'))
  const key = 'fixture'
  const dir = join(root, key)
  mkdirSync(dir, { recursive: true })
  try {
    writeFileSync(join(dir, 'script-plan.md'), PLAN)
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
})
