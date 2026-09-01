// THE APPROVAL GATE. Publishing mints a live secret URL and hands the script to a
// freelancer — the one irreversible step in the flow — and until 2026-09-01 the only
// thing in front of it was the ASK gate.
//
// Owner: *"when I click on approve and when I tell you in the terminal that I have
// approved the script, you should go ahead and publish that using my latest changes."*
//
// The load-bearing property is the one in `survives apply`. "Publish my latest changes"
// means running `apply` (staged edits -> script-plan.md) and then `publish`. If applying
// moved the fingerprint, the approval would be void by the time publish read it, and the
// gate would refuse every single real publish. It is fingerprinted over the EFFECTIVE
// plan for exactly that reason.
import { describe, it, expect } from 'vitest'
import {
  effectiveBeats,
  fingerprint,
  approvalState,
  formatApprovalRefusal,
  stagedCount,
  formatStagedRefusal,
  plannedNotes,
} from '../approval.mjs'

const PLAN = [
  { num: 'A1', title: 'Cold open', section: null, say: ['A line.'], notes: [], video: ['Film the thing.'], rules: [], facts: [] },
  { num: '1.1', title: 'First', section: 'Quick Overview', say: [], notes: ['Show the dashboards.'], video: [], rules: [], facts: [] },
]

describe('the effective plan', () => {
  it('folds a staged note over the whole merged block', () => {
    const out = effectiveBeats(PLAN, { notes: { A1: ['Rewritten.'] } })
    expect(plannedNotes(out[0])).toEqual(['Rewritten.'])
    expect(out[0].video, 'LANE_SURVIVED: the box would render the old text again').toEqual([])
  })

  it('leaves untouched beats alone', () => {
    const out = effectiveBeats(PLAN, { notes: { A1: ['x'] } })
    expect(plannedNotes(out[1])).toEqual(['Show the dashboards.'])
  })

  it('folds staged spoken lines too', () => {
    const out = effectiveBeats(PLAN, { says: { A1: ['A better line.'] } })
    expect(out[0].say).toEqual(['A better line.'])
  })
})

describe('the fingerprint', () => {
  it('survives apply — the same content staged or written in hashes identically', () => {
    const before = fingerprint('T', effectiveBeats(PLAN, { notes: { A1: ['Rewritten.'] } }))
    const applied = [{ ...PLAN[0], notes: ['Rewritten.'], video: [] }, PLAN[1]]
    const after = fingerprint('T', effectiveBeats(applied, {}))
    expect(
      after,
      'APPROVAL_DIES_ON_APPLY: approve -> apply -> publish would refuse every real publish',
    ).toBe(before)
  })

  it('moves when the spoken script changes', () => {
    const a = fingerprint('T', effectiveBeats(PLAN, {}))
    const b = fingerprint('T', effectiveBeats(PLAN, { says: { A1: ['Different.'] } }))
    expect(b).not.toBe(a)
  })

  it('moves when an instruction changes', () => {
    const a = fingerprint('T', effectiveBeats(PLAN, {}))
    const b = fingerprint('T', effectiveBeats(PLAN, { notes: { '1.1': ['Different.'] } }))
    expect(b).not.toBe(a)
  })

  it('moves when the title changes', () => {
    expect(fingerprint('T2', effectiveBeats(PLAN, {}))).not.toBe(fingerprint('T', effectiveBeats(PLAN, {})))
  })

  it('ignores the owner private ASK lane, so answering one does not void a sign-off', () => {
    const withAsk = [{ ...PLAN[0], ask: ['Is this too long?'] }, PLAN[1]]
    expect(fingerprint('T', withAsk)).toBe(fingerprint('T', PLAN))
  })
})

describe('approval state', () => {
  const fp = fingerprint('T', effectiveBeats(PLAN, {}))

  it('is none when never approved', () => {
    expect(approvalState(null, fp).state).toBe('none')
    expect(approvalState({ at: 'x' }, fp).state).toBe('none')
  })

  it('is ok when the plan has not moved', () => {
    expect(approvalState({ at: 'x', fingerprint: fp }, fp).state).toBe('ok')
  })

  it('is stale when it has', () => {
    const s = approvalState({ at: 'x', fingerprint: 'old' }, fp)
    expect(s.state).toBe('stale')
    expect(s.at).toBe('x')
  })
})

describe('the refusals tell you what to do', () => {
  it('names the desk URL when nothing was approved', () => {
    const msg = formatApprovalRefusal('vox-style-video-ai', { state: 'none' })
    expect(msg).toContain('has not been approved')
    expect(msg).toContain('localhost:5175/?key=vox-style-video-ai')
    expect(msg, 'GATE_GIVES_NO_WAY_OUT').toContain('--force')
  })

  it('says when a stale approval was given', () => {
    const msg = formatApprovalRefusal('k', { state: 'stale', at: '2026-09-01T10:00:00Z', fingerprint: 'o' })
    expect(msg).toContain('stale')
    expect(msg).toContain('2026-09-01T10:00:00Z')
  })

  it('counts staged edits and names the apply command', () => {
    expect(stagedCount({ notes: { a: [], b: [] }, says: { c: [] } })).toBe(3)
    expect(stagedCount({})).toBe(0)
    const msg = formatStagedRefusal('k', 3)
    expect(msg).toContain('3 desk edits in k are not in script-plan.md yet')
    expect(msg, 'the maker would silently get the pre-edit text').toContain('BEFORE you edited it')
    expect(msg).toContain('node bin/desk.mjs apply k')
  })

  it('says "edit is" for exactly one', () => {
    expect(formatStagedRefusal('k', 1)).toContain('1 desk edit in k is not')
  })
})
