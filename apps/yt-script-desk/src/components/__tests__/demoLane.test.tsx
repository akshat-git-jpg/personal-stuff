// The DEMO lane marks a stretch where something plays and nobody speaks.
//
// Why it needs its own test file: DEMO is the one thing that renders in the LEFT
// track without being spoken copy, so it sits against the desk's core rule
// ("instructions never enter the left track", apps/yt-script-desk/CLAUDE.md).
// The exception is deliberate — a silent stretch is timeline content — but it is
// exactly the kind of exception a later refactor "tidies up" back into the right
// track, which would restore the bug it was added to fix: a 12-second cold open
// with no voiceover was invisible in the timeline, so the video read as if it
// started on the first spoken line (owner, 2026-08-27).
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { WriteView } from '../WriteView'
import { FullScript } from '../FullScript'
import { makeReadBeat, makeWriteBeat, makeDemoBeat } from '../../test/fixtures'
import type { Prefs } from '../../hooks/usePrefs'
import type { VideoDoc } from '../../types'

const allOnPrefs: Prefs = {
  instructions: true,
  whatToCover: true,
  screenRecording: true,
  generalNotes: true,
  videoEditor: true,
  beatLabels: true,
  scriptNotes: false,
}

function noop() {}

function renderView(beats: ReturnType<typeof makeReadBeat>[], prefs: Prefs = allOnPrefs) {
  return render(
    <WriteView
      beats={beats}
      prefs={prefs}
      draft={{}}
      edits={{}}
      says={{}}
      onDraftSave={noop}
      onSaySave={noop}
      onSayRestore={noop}
    />,
  )
}

function docOf(beats: ReturnType<typeof makeReadBeat>[]): VideoDoc {
  return { key: 'k', title: 'T', beats, draft: {}, edits: {}, says: {}, finished: false }
}

describe('the DEMO lane in the write view', () => {
  it('renders a silent stretch in the LEFT track, not the right one', () => {
    renderView([makeDemoBeat()])

    const left = document.querySelector('[data-testid="left-cell"]')
    const right = document.querySelector('[data-testid="right-cell"]')

    expect(
      left?.textContent ?? '',
      'DEMO_NOT_IN_TIMELINE: the silent stretch is missing from the left track, so the cold open is invisible in the timeline',
    ).toContain('The finished shot plays. No voiceover.')
    expect(
      right?.textContent ?? '',
      'DEMO_IN_INSTRUCTIONS: a silent stretch is timeline content and must not be filed as an instruction',
    ).not.toContain('The finished shot plays')
  })

  it('labels it so nobody mistakes it for a line to read', () => {
    renderView([makeDemoBeat()])
    const card = document.querySelector('[data-testid="demo-card"]')
    expect(card, 'DEMO_CARD_MISSING: no demo card rendered').not.toBeNull()
    expect(
      card?.textContent ?? '',
      'DEMO_UNLABELLED: without the label the block reads as spoken copy',
    ).toContain('No voiceover')
  })

  it('is not a SayCard, so it carries no edit control', () => {
    renderView([makeDemoBeat({ say: [] })])
    const card = document.querySelector('[data-testid="demo-card"]')
    expect(
      card?.querySelector('button'),
      'DEMO_EDITABLE: a silent stretch has nothing to edit — no pencil belongs on it',
    ).toBeNull()
  })

  it('still shows the beat spoken copy after the silence', () => {
    // DEMO is a property of a beat, not a beat of its own (owner decision,
    // 2026-08-27), so a beat can open silent and then be spoken.
    renderView([makeDemoBeat()])
    const left = document.querySelector('[data-testid="left-cell"]')?.textContent ?? ''
    expect(left).toContain('No voiceover')
    expect(left, 'DEMO_ATE_THE_SAY: the spoken copy vanished when a demo lane was present').toContain(
      'This is the spoken line.',
    )
  })

  it('leaves a beat with no demo lane completely unchanged', () => {
    renderView([makeReadBeat(), makeWriteBeat()])
    expect(
      document.querySelector('[data-testid="demo-card"]'),
      'DEMO_CARD_ALWAYS_ON: a demo card rendered for beats that have no DEMO lane',
    ).toBeNull()
  })

  it('does not give the maker a write box for it', () => {
    // A silent stretch has nothing for him to write, and it must not change the
    // beat's mode — otherwise it lands in his "N of N written" count.
    const beat = makeDemoBeat()
    expect(beat.mode, 'DEMO_CHANGED_MODE: a demo lane must not flip a beat to write mode').toBe('read')
    renderView([beat])
    expect(
      document.querySelector('textarea'),
      'DEMO_WRITE_BOX: the maker was given a box to fill for a stretch with no words',
    ).toBeNull()
  })
})

describe('the DEMO lane in the full script', () => {
  it('renders as a bracketed stage direction', () => {
    render(
      <FullScript doc={docOf([makeDemoBeat()])} loadError={null} beatLabels onRetry={noop} onFinish={noop} />,
    )
    const el = document.querySelector('[data-testid="fs-demo"]')
    expect(el, 'FS_DEMO_MISSING: the read-through skipped the silent stretch entirely').not.toBeNull()
    expect(el?.textContent ?? '').toContain('The finished shot plays. No voiceover.')
    expect(el?.textContent ?? '', 'FS_DEMO_UNBRACKETED: it must not read as a line to say').toContain('[')
  })

  it('a demo-only beat does not read as unwritten', () => {
    // Before this, a beat carrying only a silent stretch printed "Not written
    // yet." — there is nothing to write.
    render(
      <FullScript
        doc={docOf([makeDemoBeat({ say: [], mode: 'read' })])}
        loadError={null}
        beatLabels
        onRetry={noop}
        onFinish={noop}
      />,
    )
    expect(
      document.body.textContent ?? '',
      'FS_DEMO_UNWRITTEN: a silent stretch was counted as missing copy',
    ).not.toContain('Not written yet.')
  })
})
