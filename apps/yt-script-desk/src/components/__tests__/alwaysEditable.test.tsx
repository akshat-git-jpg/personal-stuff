// On the OWNER's local desk every box is live. No pencil, no confirmation —
// click the words and type. Owner, 2026-08-29: *"i think its better if we can
// have entire flow editable in place - on local. no need to click pencil."*
//
// On the HOSTED freelancer link nothing about this changes. He still gets the
// pencil and the confirm dialog on spoken copy, and no way at all to edit the
// notes. That gate is not friction for its own sake: the spoken copy is locked
// copy somebody else wrote, and it exists so a change is a decision he took
// rather than a stray keystroke.
//
// The pair of describes below is the whole point of the file — the same
// component, the two modes, checked against each other.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { WriteView } from '../WriteView'
import { makeCardBeat, makeReadBeat } from '../../test/fixtures'
import type { Prefs } from '../../hooks/usePrefs'

const PREFS: Prefs = { instructions: true, beatLabels: true, scriptNotes: false }

function noop() {}

function renderView(
  beats: ReturnType<typeof makeCardBeat>[],
  opts: Partial<React.ComponentProps<typeof WriteView>> = {},
) {
  return render(
    <WriteView
      beats={beats}
      prefs={PREFS}
      draft={{}}
      edits={{}}
      says={{}}
      onDraftSave={noop}
      onSaySave={noop}
      onSayRestore={noop}
      {...opts}
    />,
  )
}

describe('local mode: the whole page is editable in place', () => {
  it('shows no pencil anywhere', () => {
    renderView([makeReadBeat(), makeCardBeat()], {
      alwaysEditable: true,
      onNotesSave: noop,
    })
    expect(
      screen.queryByLabelText('Edit'),
      'PENCIL_BACK: the spoken card still needs a click before it can be typed in',
    ).toBeNull()
    expect(
      screen.queryByLabelText('Edit notes'),
      'PENCIL_BACK: the notes still need a click before they can be typed in',
    ).toBeNull()
  })

  it('renders the spoken copy and the notes as live boxes straight away', () => {
    renderView([makeReadBeat(), makeCardBeat()], {
      alwaysEditable: true,
      onNotesSave: noop,
    })
    expect(
      document.querySelector('.say-textarea'),
      'NOT_LIVE: the spoken card is still read-only until something is clicked',
    ).not.toBeNull()
    expect(
      document.querySelector('.right-block-area'),
      'NOT_LIVE: the notes are still read-only until something is clicked',
    ).not.toBeNull()
  })

  it('keeps the undo control on a staged note edit', () => {
    renderView([makeCardBeat()], {
      alwaysEditable: true,
      onNotesSave: noop,
      onNotesRestore: noop,
      noteEdits: { '2.1': { original: ['- old'], at: 'x' } },
    })
    expect(screen.getByText('edited, not yet applied')).toBeTruthy()
    expect(screen.getByLabelText('Undo note edit')).toBeTruthy()
  })
})

describe('hosted mode is untouched', () => {
  it('still gates the spoken card behind a pencil and a confirmation', () => {
    renderView([makeReadBeat()])
    expect(
      screen.getByLabelText('Edit'),
      'HOSTED_UNGATED: the freelancer can now type over locked copy with no decision',
    ).toBeTruthy()
    expect(document.querySelector('.say-textarea')).toBeNull()

    fireEvent.click(screen.getByLabelText('Edit'))
    expect(
      document.querySelector('.btn-accent'),
      'HOSTED_UNGATED: the confirmation is gone',
    ).not.toBeNull()
  })

  it('still gives the freelancer no way to edit his own notes', () => {
    renderView([makeCardBeat()])
    expect(screen.queryByLabelText('Edit notes')).toBeNull()
    expect(document.querySelector('.right-block-area')).toBeNull()
  })
})

// An always-open box may never be blurred at all — he can type and close the
// tab. Blur alone was enough while the box opened and closed on purpose.
describe('an always-open box saves what was typed without being blurred', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('saves the spoken copy on a pause in typing', () => {
    const onSaySave = vi.fn()
    renderView([makeReadBeat()], { alwaysEditable: true, onSaySave })

    const area = document.querySelector('.say-textarea') as HTMLTextAreaElement
    fireEvent.change(area, { target: { value: 'A rewritten line.' } })
    expect(onSaySave, 'saved on every keystroke instead of on a pause').not.toHaveBeenCalled()

    act(() => void vi.advanceTimersByTime(600))
    expect(onSaySave, 'TYPED_EDIT_LOST: nothing was saved without a blur').toHaveBeenCalledWith(
      '1.1',
      ['A rewritten line.'],
    )
  })

  it('saves the notes on a pause in typing', () => {
    const onNotesSave = vi.fn()
    renderView([makeCardBeat()], { alwaysEditable: true, onNotesSave })

    const area = document.querySelector('.right-block-area') as HTMLTextAreaElement
    fireEvent.change(area, { target: { value: '- One.\n- Two.' } })

    act(() => void vi.advanceTimersByTime(600))
    expect(onNotesSave, 'TYPED_EDIT_LOST: nothing was saved without a blur').toHaveBeenCalledWith(
      '2.1',
      ['- One.', '- Two.'],
    )
  })
})
