// AN APPROVAL MUST SURVIVE `apply`. THROUGH THE REAL `apply`.
//
// There was already a test called "survives apply" in lib/__tests__/approval.test.mjs and
// it passed the whole time this was broken, because it hand-built the post-apply beats
// instead of running the command. It proved the hash function was consistent with itself.
//
// This one shells out to `desk.mjs apply` and re-parses what it wrote, so the thing under
// test is the actual path the owner walks: type into the desk, approve, apply, publish.
//
// The failure it guards, 2026-09-02: staged text is RAW browser text and file text is
// PARSER-NORMALISED. The parser drops blank lines (a blank line ends an unquoted lane), so
// a brief typed with blank lines between bullets came back one line shorter and the
// approval died. The owner was asked to re-approve a script he had just approved:
// *"this time I won't tolerate this thing please fix this thing for the long run."*
import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { buildBeats } from '../../../../pipelines/youtube/yt-script/lib/beats.mjs'
import { effectiveBeats, fingerprint, plannedNotes } from '../../lib/approval.mjs'

const DESK = join(dirname(fileURLToPath(import.meta.url)), '..', 'desk.mjs')

const PLAN = `# Round Trip Plan

## Contents
1. First Section
2. Second Section
   2.1 Step One

## 1 · INTRODUCTION

#### A1 · Cold open

**SAY**
> Intro line one.
> Intro line two.

## 2 · BODY

### SECTION: First Section

**NOTES**
- One narrator has to carry it.
- The background never moves.

### SECTION: Second Section

#### Step One

**SAY** - final
> A spoken line.

**NOTES**
- Step one instruction.

## 3 · CONCLUSION

#### C1 · Sign-off

**SAY**
> Thanks for watching.
`

// Approve, apply, re-read: the hash the gate recomputes must equal the one it stored.
function roundTrip(staged) {
  const { title, beats } = buildBeats(PLAN)
  const before = fingerprint(title, effectiveBeats(beats, staged))

  const root = mkdtempSync(join(tmpdir(), 'desk-rt-'))
  const dir = join(root, 'k')
  mkdirSync(dir, { recursive: true })
  try {
    writeFileSync(join(dir, 'script-plan.md'), PLAN)
    writeFileSync(
      join(dir, 'desk-draft.json'),
      JSON.stringify({ notes: {}, says: {}, noteEdits: {}, edits: {}, draft: {}, ...staged }),
    )
    const out = execFileSync('node', [DESK, 'apply', 'k'], {
      encoding: 'utf8',
      env: { ...process.env, DESK_VIDEOS_ROOT: root },
    })
    const applied = readFileSync(join(dir, 'script-plan.md'), 'utf8')
    const p2 = buildBeats(applied)
    const after = fingerprint(p2.title, effectiveBeats(p2.beats, {}))
    return { before, after, out, dir, applied }
  } finally {
    if (!process.env.KEEP_RT) rmSync(root, { recursive: true, force: true })
  }
}

const NOTE = ['- One narrator has to carry it.', '- The background never moves.']

describe('an approval survives apply, through the real command', () => {
  it('holds for a plain instruction edit', () => {
    const { before, after, out } = roundTrip({ notes: { 1: ['- Rewritten instruction.'] } })
    expect(out).not.toContain('SKIPPED')
    expect(after, 'APPROVAL_DIED_ON_APPLY').toBe(before)
  })

  it('holds for a plain spoken edit on a body beat', () => {
    const { before, after, out } = roundTrip({ says: { '2.1': ['> A rewritten spoken line.'] } })
    expect(out).not.toContain('SKIPPED')
    expect(after, 'APPROVAL_DIED_ON_APPLY').toBe(before)
  })

  // The four shapes measured on the owner's real plan. Only the first was ever safe.
  it.each([
    ['a trailing space on a line', [NOTE[0] + ' ', NOTE[1]]],
    ['an interior blank line', [NOTE[0], '', NOTE[1]]],
    ['a trailing blank line', [...NOTE, '']],
    ['a leading blank line', ['', ...NOTE]],
  ])('holds when the typed text carries %s', (_label, lines) => {
    const { before, after } = roundTrip({ notes: { 1: lines } })
    expect(
      after,
      'BLANK_LINE_VOIDS_APPROVAL: the owner is asked to re-approve a script he did not change',
    ).toBe(before)
  })

  it('holds when both tracks are edited at once', () => {
    const { before, after, out } = roundTrip({
      notes: { '2.1': ['- New instruction.', '', '- Another one.'] },
      says: { '2.1': ['> New spoken line.'] },
    })
    expect(out).toContain('applied 2 edit')
    expect(after).toBe(before)
  })

})

// The two above prove an approval is not destroyed by a no-op rewrite. These prove the
// opposite half — that it is still destroyed by a REAL one. Both are needed: normalising
// whitespace to stop false alarms is only safe while genuine edits still trip the gate.
//
// The comparison here is deliberately different: an approval taken on the plan as it
// stands, checked against the plan once an edit is staged. That is what the owner's
// sign-off actually guards.
describe('the gate still catches a real change', () => {
  const { title, beats } = buildBeats(PLAN)
  const asApproved = fingerprint(title, effectiveBeats(beats, {}))
  const withEdit = (staged) => fingerprint(title, effectiveBeats(beats, staged))

  it('a reworded instruction invalidates the approval', () => {
    expect(
      withEdit({ notes: { 1: ['- A genuinely different instruction.'] } }),
      'GATE_IS_BLIND: an edited brief would publish under an old sign-off',
    ).not.toBe(asApproved)
  })

  it('a deleted line invalidates the approval', () => {
    expect(withEdit({ notes: { 1: [NOTE[0]] } })).not.toBe(asApproved)
  })

  it('a reworded spoken line invalidates the approval', () => {
    expect(withEdit({ says: { '2.1': ['Something else entirely.'] } })).not.toBe(asApproved)
  })

  it('reordering two lines invalidates the approval', () => {
    expect(withEdit({ notes: { 1: [NOTE[1], NOTE[0]] } })).not.toBe(asApproved)
  })

  it('but adding only a blank line does NOT, because it cannot reach the file', () => {
    expect(withEdit({ notes: { 1: [NOTE[0], '', NOTE[1]] } })).toBe(asApproved)
  })
})

describe('apply keeps the last good version', () => {
  it('writes a backup before overwriting the plan', () => {
    const root = mkdtempSync(join(tmpdir(), 'desk-bk-'))
    const dir = join(root, 'k')
    mkdirSync(dir, { recursive: true })
    try {
      writeFileSync(join(dir, 'script-plan.md'), PLAN)
      writeFileSync(
        join(dir, 'desk-draft.json'),
        JSON.stringify({ notes: { 1: ['- Rewritten.'] }, says: {}, noteEdits: {}, edits: {}, draft: {} }),
      )
      execFileSync('node', [DESK, 'apply', 'k'], {
        encoding: 'utf8',
        env: { ...process.env, DESK_VIDEOS_ROOT: root },
      })
      const backups = join(dir, '.desk-backups')
      expect(existsSync(backups), 'NO_BACKUP: apply overwrote hours of work with no copy kept').toBe(true)
      const files = readdirSync(backups)
      expect(files.length).toBe(1)
      expect(
        readFileSync(join(backups, files[0]), 'utf8'),
        'the backup is not the PRE-apply file',
      ).toBe(PLAN)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
