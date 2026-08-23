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
  screenRecording: true,
  generalNotes: true,
  videoEditor: true,
  beatLabels: true,
  scriptNotes: false,
}

// The master is deliberately NOT here — it names the column, not a block.
const LANE_LABELS = ['What to cover', 'Screen Recording notes', 'General Notes', 'Video Editor Notes']

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
      show: ['Film the panel.'],
      rules: ['No scores yet.'],
      facts: ['It launched in 2024.'],
      edit: ['Trim the pause.'],
    })
    renderView([beat])

    for (const label of LANE_LABELS) {
      expect(screen.getByText(label), `LANE_NAME_DRIFT: no block headed "${label}"`).toBeTruthy()
    }
  })
})

describe('General Notes merges the section rules with the beat facts', () => {
  it('shows both under one header', () => {
    const beat = makeWriteBeat({ rules: ['No scores yet.'], facts: ['It launched in 2024.'], angle: [], show: [], edit: [] })
    renderView([beat])

    expect(screen.getByText('General Notes')).toBeTruthy()
    expect(screen.getByText('No scores yet.')).toBeTruthy()
    expect(screen.getByText('It launched in 2024.')).toBeTruthy()
    expect(screen.queryByText('Rules')).toBeNull()
    expect(screen.queryByText('Facts')).toBeNull()
  })

  it('hides both when the toggle is off', () => {
    const beat = makeWriteBeat({ rules: ['No scores yet.'], facts: ['It launched in 2024.'], angle: [], show: [], edit: [] })
    renderView([beat], { ...ALL_ON, generalNotes: false })

    expect(screen.queryByText('No scores yet.')).toBeNull()
    expect(screen.queryByText('It launched in 2024.')).toBeNull()
  })
})

describe('What to cover is the body brief and has its own switch', () => {
  it('shows the angle when on and hides it when off', () => {
    const beat = makeWriteBeat({ angle: ['Say roughly this.'], show: [], rules: [], facts: [], edit: [] })

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
    const beat = makeWriteBeat({ show: ['Film the panel.'] })
    renderView([beat], { ...ALL_ON, instructions: false })
    expect(document.querySelectorAll('[data-testid="right-cell"]').length).toBe(0)
  })
})
