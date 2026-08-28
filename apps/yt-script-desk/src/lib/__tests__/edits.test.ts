// A wrong splice eats part of a script the owner spent hours on, and the damage
// is invisible until he scrolls to the missing part. So the bar here is higher
// than "the happy path works": the round-trip test at the bottom drives a real
// 1000-line plan through every operation and re-parses it each time.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deleteRange, replaceRange, insertAt, moveRange, moveSibling, normalize } from '../edits'

const DOC = ['# T', '', '**A**', 'a1', 'a2', '', '**B**', 'b1', '', '**C**', 'c1', ''].join('\n')
// line:      0      1   2        3     4     5   6        7     8   9        10    11
const A = { line: 2, endLine: 5 }
const B = { line: 6, endLine: 8 }
const C = { line: 9, endLine: 11 }

const lanes = (t: string) => t.split('\n').filter((l) => /^\*\*[A-Z]\*\*$/.test(l)).join(',')

describe('normalize', () => {
  it('collapses blank runs and ends with exactly one newline', () => {
    expect(normalize('a\n\n\n\n\nb\n\n\n')).toBe('a\n\nb\n')
  })
  it('leaves a single blank line between blocks alone', () => {
    expect(normalize('a\n\nb\n')).toBe('a\n\nb\n')
  })
})

describe('deleteRange', () => {
  it('removes exactly the range and nothing else', () => {
    const out = deleteRange(DOC, B)
    expect(lanes(out)).toBe('**A**,**C**')
    expect(out).toContain('a2')
    expect(out).toContain('c1')
    expect(out).not.toContain('b1')
  })
  it('leaves the document parseable when the LAST block goes', () => {
    const out = deleteRange(DOC, C)
    expect(lanes(out)).toBe('**A**,**B**')
    expect(out.endsWith('\n')).toBe(true)
  })
})

describe('replaceRange', () => {
  it('swaps the block contents and keeps its neighbours', () => {
    const out = replaceRange(DOC, B, '**B**\nrewritten')
    expect(out).toContain('rewritten')
    expect(out).not.toContain('b1')
    expect(lanes(out)).toBe('**A**,**B**,**C**')
  })
  it('accepts a replacement with more lines than the original', () => {
    const out = replaceRange(DOC, B, '**B**\nx\ny\nz')
    expect(out).toContain('x\ny\nz')
    expect(lanes(out)).toBe('**A**,**B**,**C**')
  })
})

describe('insertAt', () => {
  it('puts the new block exactly where asked', () => {
    const out = insertAt(DOC, B.line, '**NEW**\nn1')
    expect(lanes(out)).toBe('**A**,**B**,**C**')
    expect(out.split('\n').indexOf('**NEW**')).toBeLessThan(out.split('\n').indexOf('**B**'))
  })
})

describe('moveRange', () => {
  it('moves a block DOWN past its neighbour', () => {
    const out = moveRange(DOC, A, C.line)
    expect(lanes(out)).toBe('**B**,**A**,**C**')
    expect(out).toContain('a1')
    expect(out).toContain('a2')
  })
  it('moves a block UP past its neighbour', () => {
    const out = moveRange(DOC, C, B.line)
    expect(lanes(out)).toBe('**A**,**C**,**B**')
  })
  it('DROPPING A BLOCK ONTO ITSELF changes nothing instead of eating it', () => {
    const out = moveRange(DOC, A, A.line + 1)
    expect(lanes(out)).toBe('**A**,**B**,**C**')
    expect(out).toContain('a1')
    expect(out).toContain('a2')
  })
  it('never loses a line, whatever the target', () => {
    const body = (t: string) => t.split('\n').filter((l) => l.trim()).sort().join('|')
    for (let target = 0; target <= 12; target++) {
      const out = moveRange(DOC, B, target)
      expect(body(out), `LINE_LOST moving B to line ${target}`).toBe(body(DOC))
    }
  })
})

describe('moveSibling', () => {
  const sibs = [A, B, C]
  it('moves the first sibling to last', () => {
    expect(lanes(moveSibling(DOC, sibs, 0, 2))).toBe('**B**,**C**,**A**')
  })
  it('moves the last sibling to first', () => {
    expect(lanes(moveSibling(DOC, sibs, 2, 0))).toBe('**C**,**A**,**B**')
  })
  it('moving to its own position is a no-op', () => {
    expect(lanes(moveSibling(DOC, sibs, 1, 1))).toBe('**A**,**B**,**C**')
  })
})

// The real thing. `script-plan.md` is the document these operations exist for,
// and it is the one that must survive them.
describe('the real script plan survives every operation', () => {
  const PLAN = resolve(__dirname, '../../../../../pipelines/youtube/yt-script/videos/vox-style-video-ai/script-plan.md')
  const md = readFileSync(PLAN, 'utf8')

  // Imported lazily and by relative path so this test fails loudly if the
  // parser moves, rather than silently testing nothing.
  async function model(text: string) {
    const mod = await import('../../../../../pipelines/youtube/yt-script/lib/beats.mjs')
    return { edit: mod.buildEditModel(text), read: mod.buildBeats(text) }
  }

  it('the fixture is the real plan, not a stub', async () => {
    const { read } = await model(md)
    expect(read.beats.length).toBeGreaterThan(50)
  })

  it('deleting one note leaves every other beat intact and the file parseable', async () => {
    const { edit, read } = await model(md)
    const beat = edit.beats.find((b: { blocks: unknown[] }) => b.blocks.length > 1)!
    const victim = beat.blocks[beat.blocks.length - 1]
    const after = await model(deleteRange(md, victim))
    expect(after.read.beats.length).toBe(read.beats.length)
    expect(after.edit.beats.find((b: { num: string }) => b.num === beat.num)!.blocks.length).toBe(
      beat.blocks.length - 1,
    )
  })

  it('MOVING A WHOLE SECTION keeps every beat in the document', async () => {
    const { edit, read } = await model(md)
    const src = edit.sections[2]
    const dst = edit.sections[7]
    const moved = moveRange(md, { line: src.line, endLine: src.endLine }, dst.endLine)
    const after = await model(moved)

    expect(after.read.beats.length, 'BEATS_LOST: moving a section dropped beats').toBe(read.beats.length)
    expect(after.edit.sections.length).toBe(edit.sections.length)
    // the moved section really did change position
    const order = (m: { sections: { name: string }[] }) => m.sections.map((x) => x.name)
    expect(order(after.edit)).not.toEqual(order(edit))
    expect(order(after.edit).sort()).toEqual(order(edit).sort())
  })

  it('MOVING A BEAT between sections re-parents it and loses nothing', async () => {
    const { edit, read } = await model(md)
    const beat = edit.beats.find((b: { section: string | null }) => b.section === edit.sections[1].name)!
    const target = edit.sections[5]
    const moved = moveRange(md, { line: beat.line, endLine: beat.endLine }, target.endLine)
    const after = await model(moved)

    expect(after.read.beats.length).toBe(read.beats.length)
    const now = after.edit.beats.find((b: { num: string }) => b.num === beat.num)!
    expect(now.section, 'the moved beat did not re-parent to its new section').toBe(target.name)
  })

  it('every spoken line survives a delete, a move and an edit in sequence', async () => {
    const { edit, read } = await model(md)
    const spokenBefore = JSON.stringify(read.beats.map((b: { say: string[] | null }) => b.say))

    // a note goes, a section moves, a note is rewritten — none touch spoken copy
    let text = md
    const note = edit.beats.find((b: { blocks: { kind: string }[] }) =>
      b.blocks.some((x) => x.kind === 'VIDEO'),
    )!.blocks.find((x: { kind: string }) => x.kind === 'VIDEO')!
    text = deleteRange(text, note)

    const m2 = await model(text)
    text = moveRange(text, { line: m2.edit.sections[3].line, endLine: m2.edit.sections[3].endLine }, m2.edit.sections[6].endLine)

    const m3 = await model(text)
    const target = m3.edit.beats.find((b: { blocks: { kind: string }[] }) =>
      b.blocks.some((x) => x.kind === 'VIDEO'),
    )!.blocks.find((x: { kind: string }) => x.kind === 'VIDEO')!
    text = replaceRange(text, target, '**VIDEO**\nrewritten in the browser')

    const after = await model(text)
    const spokenAfter = JSON.stringify(
      after.read.beats
        .slice()
        .sort((a: { num: string }, b: { num: string }) => a.num.localeCompare(b.num))
        .map((b: { say: string[] | null }) => b.say),
    )
    const expected = JSON.stringify(
      read.beats
        .slice()
        .sort((a: { num: string }, b: { num: string }) => a.num.localeCompare(b.num))
        .map((b: { say: string[] | null }) => b.say),
    )
    expect(spokenAfter, 'SPOKEN_COPY_CHANGED: an edit-mode operation altered approved script').toBe(expected)
    expect(spokenBefore.length).toBeGreaterThan(100)
    expect(after.read.beats.length).toBe(read.beats.length)
  })
})
