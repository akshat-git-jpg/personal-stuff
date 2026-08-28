import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WriteView } from '../WriteView'
import { makeReadBeat, makeWriteBeat } from '../../test/fixtures'
import type { Prefs } from '../../hooks/usePrefs'

const allOnPrefs: Prefs = {
  instructions: true,
  whatToCover: true,
  videoNotes: true,
  generalNotes: true,
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

describe('WriteView', () => {
  it('never puts an instruction into the left track', () => {
    const beat = makeWriteBeat()
    renderView([beat])

    const leftText = screen.getAllByTestId('left-cell').map((c) => c.textContent ?? '').join(' ')
    const instructionStrings = [...beat.video, ...beat.facts, ...(beat.angle ?? [])]
    for (const s of instructionStrings) {
      expect(leftText.includes(s), `INSTRUCTION_IN_SCRIPT_TRACK: found "${s}" in the left track`).toBe(false)
    }
  })

  it('renders say paragraphs and no textarea for a read beat', () => {
    const beat = makeReadBeat({ say: ['Hello there.'] })
    renderView([beat])

    expect(screen.getByText('Hello there.')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('renders a textarea and no say text for a write beat', () => {
    const beat = makeWriteBeat({ angle: ['Draft angle text that must not leak.'] })
    renderView([beat])

    const leftCell = screen.getByTestId('left-cell')
    expect(leftCell.querySelector('textarea')).not.toBeNull()
    expect(leftCell.textContent).not.toContain('Draft angle text that must not leak.')
  })

  it('turns an empty string in say[] into a second paragraph', () => {
    const beat = makeReadBeat({ say: ['First paragraph.', '', 'Second paragraph.'] })
    renderView([beat])

    const leftCell = screen.getByTestId('left-cell')
    expect(leftCell.querySelectorAll('.say p').length).toBe(2)
  })

  it('hides General Notes when its toggle is off, and drops right cells entirely when Instructions is off', () => {
    const beat = makeReadBeat({ facts: ['A fact line.'] })
    const { rerender } = renderView([beat], { ...allOnPrefs, generalNotes: false })
    expect(screen.queryByText('A fact line.')).toBeNull()

    rerender(
      <WriteView
        beats={[beat]}
        prefs={{ ...allOnPrefs, instructions: false }}
        draft={{}}
        edits={{}}
        says={{}}
        onDraftSave={noop}
        onSaySave={noop}
        onSayRestore={noop}
      />,
    )
    expect(screen.queryByTestId('right-cell')).toBeNull()
  })

  // Owner 2026-08-23: no length number anywhere in the desk. A word count on a
  // write box reads as a target even when none is set, and he does not want one.
  it('shows the save state and never a word count', () => {
    const beat = makeWriteBeat()
    renderView([beat])

    const textarea = screen.getByPlaceholderText('Write what you saw…')
    fireEvent.change(textarea, { target: { value: 'three word count' } })
    const footer = textarea.closest('.write-box')?.querySelector('.write-box-footer')

    expect(
      footer?.textContent ?? '',
      'WORD_COUNT_BACK: the write box is showing a length number again',
    ).not.toMatch(/\d+\s*words?/i)
    expect(footer?.textContent).toMatch(/Saved|Saving|Not saved/)
  })
})
