// Publishing over an unanswered ASK is publishing a review that never finished.
//
// The gate refuses BEFORE any network call, and the `ask` field is stripped
// unconditionally — `--force` included. That second part is the one that must never
// regress: --force is about the owner's own workflow, not about letting his private
// question reach the freelancer's snapshot.
//
// Tested through exported helpers rather than only the CLI because this repo has
// three logged cases of a gate that passed its own suite while being unable to fire
// (2026-08-02 twice, 2026-07-21). A pure function that takes beats and returns the
// refusal is a gate a mutation can actually break.
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { openAsks, formatAskRefusal, stripAsks } from '../desk.mjs'

const VIDEOS = join(process.cwd(), '..', '..', 'pipelines', 'youtube', 'yt-script', 'videos')

const beats = [
  { num: '1.1', section: null, ask: ['Cut this to two sentences.'], say: ['A line.'] },
  { num: '2.1', section: 'Locking the look', ask: [], say: null },
  { num: '2.4', section: 'Locking the look', ask: ['Is 200% too close?', 'Try 150%.'], say: null },
]

describe('the ASK publish gate', () => {
  it('finds every beat carrying an open question, and no others', () => {
    expect(openAsks(beats).map((b) => b.num)).toEqual(['1.1', '2.4'])
  })

  it('survives a beat with no ask field at all', () => {
    expect(openAsks([{ num: '1.1' }])).toEqual([])
    expect(stripAsks([{ num: '1.1' }])).toEqual([{ num: '1.1' }])
  })

  it('names the beat, its section, and every line of the question', () => {
    const msg = formatAskRefusal('vox-style-video-ai', openAsks(beats))
    expect(msg).toContain('REFUSED: 2 unanswered ASK notes in vox-style-video-ai')
    expect(msg).toContain('2.4  Locking the look')
    expect(msg).toContain('Is 200% too close?')
    expect(msg).toContain('Try 150%.')
    expect(
      msg,
      'GATE_GIVES_NO_WAY_OUT: a refusal that does not say how to proceed gets worked ' +
        'around with --force every time',
    ).toContain('--force')
  })

  it('says "note" not "notes" for exactly one', () => {
    expect(formatAskRefusal('k', [beats[0]])).toContain('1 unanswered ASK note in k')
  })

  it('strips ask from every beat, keeping everything else byte-identical', () => {
    const clean = stripAsks(beats)
    expect(
      clean.some((b) => 'ask' in b),
      'ASK_PUBLISHED: the owner\'s private question would reach the freelancer snapshot',
    ).toBe(false)
    expect(clean[0]).toEqual({ num: '1.1', section: null, say: ['A line.'] })
    expect(clean[2].section).toBe('Locking the look')
  })
})

describe('the CLI refuses before it reaches the network', () => {
  const key = `zz-asktest-${process.pid}`
  const dir = join(VIDEOS, key)

  it('exits 2 and prints the open questions', () => {
    try {
      mkdirSync(dir, { recursive: true })
      writeFileSync(
        join(dir, 'script-plan.md'),
        [
          '# Gate test',
          '',
          '## 1 · INTRODUCTION',
          '',
          '#### 1.1 · Open',
          '',
          '**SAY** — final',
          '> A spoken line.',
          '',
          '**ASK**',
          'Cut this to two sentences.',
          '',
          // buildBeats refuses a plan with no body part (NO_BODY_PART), so the
          // fixture carries one. Caught by this test on 2026-08-28 — the parser
          // guard fired before the ASK gate, which is the correct order.
          '## 2 \u00b7 BODY',
          '',
          '### SECTION: A section',
          '',
          '#### 2.1 \u00b7 First',
          '',
          '**SAY**',
          'Cover the thing.',
          '',
        ].join('\n'),
      )
      // No --base and no admin secret: if the gate did not fire first this would
      // fail on the network instead, with a different exit code and no ASK text.
      const r = spawnSync('node', ['bin/desk.mjs', 'publish', key], {
        cwd: process.cwd(),
        encoding: 'utf8',
      })
      expect(r.status, `stdout=${r.stdout} stderr=${r.stderr}`).toBe(2)
      expect(r.stderr).toContain('REFUSED: 1 unanswered ASK note')
      expect(r.stderr).toContain('Cut this to two sentences.')
      expect(
        r.stdout,
        'GATE_LEAKED_A_URL: publish printed a link even though it refused',
      ).toBe('')
    } finally {
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
    }
  })
})
