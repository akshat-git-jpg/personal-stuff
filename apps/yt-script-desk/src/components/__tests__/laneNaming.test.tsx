// The owner's rule, 2026-08-23: "whatever is in toggles, same thing in right
// view." Before this, the chip said "Recording notes" and the block header said
// "RECORDING", three of four chips were called "notes", and nothing said which
// chip hid which block. These tests make the rule machine-checkable so a future
// rename of one side alone fails instead of quietly drifting.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WriteView } from '../WriteView'
import { ToggleRail } from '../ToggleRail'
import { makeReadBeat, makeWriteBeat } from '../../test/fixtures'
import type { Prefs } from '../../hooks/usePrefs'

const ALL_ON: Prefs = {
  instructions: true,
  whatToCover: true,
  videoNotes: true,
  generalNotes: true,
  beatLabels: true,
  scriptNotes: false,
}

// The master is deliberately NOT here — it names the column, not a block.
const LANE_LABELS = ['What to cover', 'Video notes', 'General notes']

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

describe('a toggle and its block say the same words', () => {
  it('every lane chip in the rail names a block the right column can render', () => {
    render(<ToggleRail prefs={ALL_ON} setPrefs={noop} />)
    const labels = railLabels()

    expect(labels[0], 'the master chip must come first').toBe('Instructions')
    expect(
      labels.slice(1),
      'LANE_NAME_DRIFT: the rail chips no longer match the right-column block headers',
    ).toEqual(LANE_LABELS)
  })

  it('renders each block under exactly the label its chip uses', () => {
    const beat = makeWriteBeat({
      angle: ['Say roughly this.'],
      video: ['Film the panel, then trim the pause.'],
      rules: ['No scores yet.'],
      facts: ['It launched in 2024.'],
    })
    renderView([beat])

    for (const label of LANE_LABELS) {
      expect(screen.getByText(label), `LANE_NAME_DRIFT: no block headed "${label}"`).toBeTruthy()
    }
  })
})

describe('General notes merges the section rules with the beat facts', () => {
  it('shows both under one header', () => {
    const beat = makeWriteBeat({ rules: ['No scores yet.'], facts: ['It launched in 2024.'], angle: [], video: [] })
    renderView([beat])

    expect(screen.getByText('General notes')).toBeTruthy()
    expect(screen.getByText('No scores yet.')).toBeTruthy()
    expect(screen.getByText('It launched in 2024.')).toBeTruthy()
    expect(screen.queryByText('Rules')).toBeNull()
    expect(screen.queryByText('Facts')).toBeNull()
  })

  it('hides both when the toggle is off', () => {
    const beat = makeWriteBeat({ rules: ['No scores yet.'], facts: ['It launched in 2024.'], angle: [], video: [] })
    renderView([beat], { ...ALL_ON, generalNotes: false })

    expect(screen.queryByText('No scores yet.')).toBeNull()
    expect(screen.queryByText('It launched in 2024.')).toBeNull()
  })
})

describe('What to cover is the body brief and has its own switch', () => {
  it('shows the angle when on and hides it when off', () => {
    const beat = makeWriteBeat({ angle: ['Say roughly this.'], video: [], rules: [], facts: [] })

    const { unmount } = renderView([beat])
    expect(screen.getByText('Say roughly this.')).toBeTruthy()
    unmount()

    renderView([beat], { ...ALL_ON, whatToCover: false })
    expect(screen.queryByText('Say roughly this.')).toBeNull()
  })
})

describe('Instructions is a master switch, and looks like one', () => {
  it('disables every lane chip while it is off', () => {
    render(<ToggleRail prefs={{ ...ALL_ON, instructions: false }} setPrefs={noop} />)
    const chips = Array.from(document.querySelectorAll('.chip')) as HTMLButtonElement[]

    expect(chips[0].disabled, 'the master itself must stay clickable').toBe(false)
    for (const chip of chips.slice(1)) {
      expect(
        chip.disabled,
        `MASTER_NOT_ENFORCED: "${chip.textContent?.trim()}" is clickable while Instructions is off, and changes nothing`,
      ).toBe(true)
    }
  })

  it('leaves every lane chip clickable while it is on', () => {
    render(<ToggleRail prefs={ALL_ON} setPrefs={noop} />)
    const chips = Array.from(document.querySelectorAll('.chip')) as HTMLButtonElement[]
    for (const chip of chips) expect(chip.disabled).toBe(false)
  })

  it('drops the whole right column when off', () => {
    const beat = makeWriteBeat({ video: ['Film the panel.'] })
    renderView([beat], { ...ALL_ON, instructions: false })
    expect(document.querySelectorAll('[data-testid="right-cell"]').length).toBe(0)
  })
})

// Owner 2026-08-23: "remove word count from everywhere. i dont want to show
// anywhere" — and, shown the full-script subtitle, "remove this as well" for
// "about 6 min read aloud". Both screens. A length number is pressure; the only
// progress signal left is how many BEATS are written.
describe('no length number appears on either screen', () => {
  const LENGTH_NUMBER = /\d+\s*(words?|min\b|minutes?)/i

  it('the write screen shows no word count and no read time', () => {
    const beat = makeWriteBeat({ angle: ['Say roughly this.'] })
    renderView([beat])
    expect(
      document.body.textContent ?? '',
      'LENGTH_NUMBER_SHOWN: the write screen is displaying a word count or read time',
    ).not.toMatch(LENGTH_NUMBER)
  })

  it('the beat progress counter survives, because it counts beats not words', () => {
    const beat = makeWriteBeat({ angle: ['Say roughly this.'] })
    renderView([beat])
    expect(document.body.textContent ?? '').not.toMatch(/\bwords\b/i)
  })
})

// Outline authors write "**This is the one demo block of the video.**" in a
// RULES lane. The instruction track printed the asterisks literally, which read
// as broken text in the middle of General Notes (seen live 2026-08-23).
describe('markdown emphasis in an instruction line', () => {
  it('renders bold instead of printing asterisks', () => {
    const beat = makeWriteBeat({
      rules: ['**This is the one demo block.** Everything else references it.'],
      facts: [],
      angle: [],
      video: [],
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
