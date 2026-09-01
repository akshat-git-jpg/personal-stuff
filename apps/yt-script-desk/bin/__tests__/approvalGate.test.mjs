// The gate has to FIRE, not just be correct in isolation.
//
// This repo has three logged cases of a gate that passed its own unit suite while being
// unable to fire (2026-08-02 twice, 2026-07-21), so the ASK gate is tested by spawning
// the real CLI with no admin secret and no --base: if the refusal did not happen first,
// the command would reach the network and fail differently. Same method here.
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { buildBeats } from '../../../../pipelines/youtube/yt-script/lib/beats.mjs'
import { effectiveBeats, fingerprint } from '../../lib/approval.mjs'

const VIDEOS = join(process.cwd(), '..', '..', 'pipelines', 'youtube', 'yt-script', 'videos')
const CLI = join(process.cwd(), 'bin', 'desk.mjs')

const PLAN = [
  '# Gate test',
  '',
  '## 1 · INTRODUCTION',
  '',
  '#### A1 · Cold open',
  '',
  '**SAY**',
  '> A spoken line.',
  '',
  '**VIDEO**',
  'Film the thing.',
  '',
  '## 2 · BODY',
  '',
  '### SECTION: A section',
  '',
  '**NOTES**',
  '- Cover the thing.',
  '',
].join('\n')

function withVideo(name, draft, fn) {
  const key = `zz-${name}-${process.pid}`
  const dir = join(VIDEOS, key)
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'script-plan.md'), PLAN)
    if (draft) writeFileSync(join(dir, 'desk-draft.json'), JSON.stringify(draft, null, 2))
    return fn(key)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const publish = (key) =>
  spawnSync(process.execPath, [CLI, 'publish', key], { encoding: 'utf8', cwd: process.cwd() })

describe('publish refuses an unapproved plan', () => {
  it('exits 3 and points at the local desk', () => {
    withVideo('noapprove', null, (key) => {
      const res = publish(key)
      expect(res.status, 'GATE_DID_NOT_FIRE: publish reached the network unapproved').toBe(3)
      expect(res.stderr).toContain('has not been approved')
      expect(res.stderr).toContain(`localhost:5175/?key=${key}`)
    })
  })

  it('exits 3 when the approval is for a different version of the plan', () => {
    withVideo('stale', { approved: { at: '2026-09-01T10:00:00Z', fingerprint: 'nope' } }, (key) => {
      const res = publish(key)
      expect(res.status).toBe(3)
      expect(res.stderr).toContain('stale')
    })
  })
})

// A genuine sign-off for a given staging state, computed the way the server computes it.
function approvalFor(staged) {
  const { title, beats } = buildBeats(PLAN)
  return { at: new Date().toISOString(), fingerprint: fingerprint(title, effectiveBeats(beats, staged)) }
}

describe('publish refuses to ship a plan whose edits are still staged', () => {
  // The trap the owner walked up to on 2026-09-01: publish snapshots script-plan.md and
  // nothing else, so an unapplied desk edit would have shipped the PRE-edit text while he
  // believed he had shipped his changes. Nothing warned him.
  it('exits 4 and names the apply command, even though the approval is valid', () => {
    const staged = { notes: { A1: ['Rewritten.'] } }
    withVideo('staged', { ...staged, approved: approvalFor(staged) }, (key) => {
      const res = publish(key)
      expect(res.status, 'STAGING_GATE_DID_NOT_FIRE: the maker would get the pre-edit text').toBe(4)
      expect(res.stderr).toContain('not in script-plan.md yet')
      expect(res.stderr).toContain(`node bin/desk.mjs apply ${key}`)
    })
  })
})

describe('a real approval lets publish through both gates', () => {
  it('gets past the gates and only then tries the network', () => {
    // Nothing staged and a valid sign-off: both gates pass, so the CLI proceeds to the
    // admin call and fails on the MISSING SECRET instead. That distinction is the proof
    // the gates are not simply refusing everything.
    withVideo('approved', { approved: approvalFor({}) }, (key) => {
      const res = publish(key)
      expect(res.status).not.toBe(3)
      expect(res.status).not.toBe(4)
      expect(res.stderr).not.toContain('has not been approved')
    })
  })
})
