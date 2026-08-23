import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { emitDraft, resolveLines } from '../desk.mjs'

function runPull(outPath) {
  return spawnSync(
    'node',
    ['bin/desk.mjs', 'pull', '--fixture', 'test/fixtures/pulled.json', '--out', outPath],
    { cwd: process.cwd(), encoding: 'utf8' },
  )
}

describe('desk.mjs pull (CLI, offline fixture)', () => {
  it('the fixture pull output equals expected-draft.md byte for byte', () => {
    const out = join(tmpdir(), `sd-emit-test-${process.pid}.md`)
    try {
      const result = runPull(out)
      expect(result.status, result.stderr).toBe(0)
      const actual = readFileSync(out, 'utf8')
      const expected = readFileSync('test/fixtures/expected-draft.md', 'utf8')
      expect(actual).toBe(expected)
    } finally {
      rmSync(out, { force: true })
    }
  })

  it('reports the edited beat on stderr, one line per edit', () => {
    const out = join(tmpdir(), `sd-emit-test-stderr-${process.pid}.md`)
    try {
      const result = runPull(out)
      expect(result.status, result.stderr).toBe(0)
      expect(result.stderr.trim().split('\n')).toEqual(['edited B2 · The pick'])
      expect(result.stdout).toBe('')
    } finally {
      rmSync(out, { force: true })
    }
  })
})

describe('emitDraft', () => {
  const base = { title: 'T', pulledAt: '2026-01-01T00:00:00.000Z' }

  it('emits "> [not written]" for a beat with no say, no says override, and no draft', () => {
    const beats = [{ num: '1', title: 'Empty beat', part: null, say: null }]
    const { markdown } = emitDraft({ ...base, beats, draft: {}, says: {}, edits: {} })
    expect(markdown).toContain('> [not written]')
  })

  it('emits exactly one "<!-- edited by the maker" comment for an edited beat', () => {
    const beats = [{ num: '1', title: 'Edited beat', part: null, say: ['original'] }]
    const edits = { '1': { original: ['original'], at: '2026-01-01T00:00:00.000Z' } }
    const { markdown, edited } = emitDraft({ ...base, beats, draft: {}, says: { '1': ['new line'] }, edits })
    const matches = markdown.match(/<!-- edited by the maker/g) ?? []
    expect(matches).toHaveLength(1)
    expect(edited).toEqual([{ num: '1', title: 'Edited beat' }])
  })

  it('emits a bare ">" for a blank string inside a lines array', () => {
    const beats = [{ num: '1', title: 'Paragraph break', part: null, say: ['first', '', 'second'] }]
    const { markdown } = emitDraft({ ...base, beats, draft: {}, says: {}, edits: {} })
    const lines = markdown.split('\n')
    expect(lines).toContain('>')
    expect(lines).not.toContain('> ')
  })

  it('resolves spoken text in order says -> say -> draft', () => {
    const withAllThree = { num: '1', title: 'B', part: null, say: ['from say'] }
    expect(resolveLines(withAllThree, { '1': 'from draft' }, { '1': ['from says'] })).toEqual(['from says'])

    const withSayAndDraft = { num: '1', title: 'B', part: null, say: ['from say'] }
    expect(resolveLines(withSayAndDraft, { '1': 'from draft' }, {})).toEqual(['from say'])

    const withDraftOnly = { num: '1', title: 'B', part: null, say: null }
    expect(resolveLines(withDraftOnly, { '1': 'from draft' }, {})).toEqual(['from draft'])

    const withNothing = { num: '1', title: 'B', part: null, say: null }
    expect(resolveLines(withNothing, {}, {})).toBeNull()
  })
})
