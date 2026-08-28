// The right column is ONE block, headed `Notes`.
//
// It was three — `What to cover`, `Video notes`, `General notes` — one per lane
// in the markdown, each with its own chip on the rail. Owner, 2026-08-29:
// *"remove those sections about video notes separately, general notes
// separately, everything else. Just need a simple bullet points on what to do
// inside that video, and let the freelancer who will be working on this script
// and video take care of the things."*
//
// These tests hold that shape. The old rule they replace — "whatever is in
// toggles, same thing in right view" (2026-08-23) — is not gone: with one block
// and no lane chips there is nothing left to drift apart.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WriteView } from '../WriteView'
import { ToggleRail } from '../ToggleRail'
import { makeReadBeat, makeWriteBeat, makeCardBeat } from '../../test/fixtures'
import type { Prefs } from '../../hooks/usePrefs'

const ALL_ON: Prefs = {
  instructions: true,
  beatLabels: true,
  scriptNotes: false,
}

function noop() {}

function renderView(beats: ReturnType<typeof makeReadBeat>[], prefs: Prefs = ALL_ON) {
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

function railLabels(): string[] {
  return Array.from(document.querySelectorAll('.chip')).map((c) => (c.textContent ?? '').trim())
}

describe('the rail carries one switch, and it names the column', () => {
  it('has Instructions and nothing else', () => {
    render(<ToggleRail prefs={ALL_ON} setPrefs={noop} />)
    expect(
      railLabels(),
      'LANE_CHIPS_BACK: a per-lane chip has returned, but the column is one block',
    ).toEqual(['Instructions'])
  })

  it('drops the whole right column when it is off', () => {
    const beat = makeWriteBeat({ video: ['Film the panel.'] })
    renderView([beat], { ...ALL_ON, instructions: false })
    expect(document.querySelectorAll('[data-testid="right-cell"]').length).toBe(0)
  })
})

describe('a body section card', () => {
  it('shows its bullets under one header called Notes', () => {
    renderView([makeCardBeat()])

    expect(screen.getByText('Notes')).toBeTruthy()
    expect(screen.getByText(/Show what the style actually is/)).toBeTruthy()
    expect(screen.getByText(/The background never moves/)).toBeTruthy()
  })

  it('is headed by the section name, and gives the maker one write box', () => {
    renderView([makeCardBeat()])

    // Twice on purpose: the group heading above the card, and the card's own
    // margin label. Both read the section name, because the card IS the section.
    expect(screen.getAllByText('What makes it look like Vox').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('textarea').length).toBe(1)
  })

  it('never splits the brief into more than one block', () => {
    renderView([makeCardBeat()])
    const cell = document.querySelector('[data-testid="right-cell"]')
    expect(cell?.querySelectorAll('.lane-label, h3, h4').length ?? 0).toBeLessThanOrEqual(1)
  })
})

describe('a plan written in the older lane shape still reaches the reader', () => {
  // SAY / VIDEO / FACTS / RULES lanes are still parsed, so an older
  // script-plan.md must not lose a single line just because the column merged.
  it('folds every old lane into the same Notes block', () => {
    const beat = makeWriteBeat({
      angle: ['Say roughly this.'],
      video: ['Film the panel, then trim the pause.'],
      rules: ['No scores yet.'],
      facts: ['It launched in 2024.'],
    })
    renderView([beat])

    expect(screen.getByText('Notes')).toBeTruthy()
    for (const line of [
      'Say roughly this.',
      'Film the panel, then trim the pause.',
      'No scores yet.',
      'It launched in 2024.',
    ]) {
      expect(screen.getByText(line), `LINE_LOST: "${line}" never reached the column`).toBeTruthy()
    }
    expect(screen.queryByText('What to cover')).toBeNull()
    expect(screen.queryByText('Video notes')).toBeNull()
    expect(screen.queryByText('General notes')).toBeNull()
  })
})

// Owner 2026-08-23: "remove word count from everywhere. i dont want to show
// anywhere" — and, shown the full-script subtitle, "remove this as well" for
// "about 6 min read aloud". Both screens. A length number is pressure; the only
// progress signal left is how many BEATS are written.
describe('no length number appears on either screen', () => {
  const LENGTH_NUMBER = /\d+\s*(words?|min\b|minutes?)/i

  it('the write screen shows no word count and no read time', () => {
    renderView([makeCardBeat()])
    expect(
      document.body.textContent ?? '',
      'LENGTH_NUMBER_SHOWN: the write screen is displaying a word count or read time',
    ).not.toMatch(LENGTH_NUMBER)
  })

  it('the beat progress counter survives, because it counts beats not words', () => {
    renderView([makeCardBeat()])
    expect(document.body.textContent ?? '').not.toMatch(/\bwords\b/i)
  })
})

// Plan authors write "**This is the one demo block of the video.**" in a note.
// The instruction track printed the asterisks literally, which read as broken
// text in the middle of the column (seen live 2026-08-23).
describe('markdown emphasis in an instruction line', () => {
  it('renders bold instead of printing asterisks', () => {
    const beat = makeCardBeat({
      notes: ['- **This is the one demo block.** Everything else references it.'],
    })
    renderView([beat])

    const cell = document.querySelector('[data-testid="right-cell"]')
    expect(
      cell?.textContent ?? '',
      'RAW_MARKDOWN_SHOWN: literal ** asterisks reached the instruction track',
    ).not.toContain('**')
    expect(cell?.querySelector('strong')?.textContent).toBe('This is the one demo block.')
    expect(cell?.textContent).toContain('Everything else references it.')
  })
})
