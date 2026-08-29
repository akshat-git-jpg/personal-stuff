// Notes are edited IN PLACE, and the edit is STAGED.
//
// Owner, 2026-08-29: *"make the edit in place for script and instructions"* and,
// on where it saves: *"can we do commit in 1 go. i will edit wherever required
// and tell you once all are reviewed and done. then you can update/edit in 1
// go."*
//
// Two things must hold and neither is visible from the markup alone: the pencil
// must not exist on the hosted freelancer link, and an edit must be flagged as
// not-yet-in-the-file so a review can end knowing what is still outstanding.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WriteView } from '../WriteView'
import { makeCardBeat } from '../../test/fixtures'
import type { Prefs } from '../../hooks/usePrefs'
import type { Edit } from '../../types'

const PREFS: Prefs = { instructions: true, beatLabels: true, scriptNotes: false }

function noop() {}

function renderView(opts: {
  onNotesSave?: (num: string, lines: string[]) => void
  onNotesRestore?: (num: string) => void
  noteEdits?: Record<string, Edit>
} = {}) {
  return render(
    <WriteView
      beats={[makeCardBeat()]}
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

describe('editing a note in place', () => {
  it('offers no pencil at all when notes are read-only', () => {
    // The hosted freelancer link passes no handler. He reads his brief; he does
    // not get to rewrite it.
    renderView()
    expect(
      screen.queryByLabelText('Edit notes'),
      'HOSTED_NOTES_EDITABLE: the freelancer can rewrite his own instructions',
    ).toBeNull()
  })

  it('opens a textarea and saves the edited lines on blur', () => {
    const onNotesSave = vi.fn()
    renderView({ onNotesSave })

    fireEvent.click(screen.getByLabelText('Edit notes'))
    // Scoped to the instruction column on purpose: the card also has the maker's
    // own write box, which is a textarea too, and blurring that one proves
    // nothing about this editor.
    const area = document.querySelector('[data-testid="right-cell"] textarea') as HTMLTextAreaElement
    expect(area, 'NO_EDITOR: the pencil did not open an editor').not.toBeNull()

    fireEvent.change(area, { target: { value: '- One.\n- Two.' } })
    fireEvent.blur(area)

    expect(onNotesSave).toHaveBeenCalledWith('2.1', ['- One.', '- Two.'])
  })

  it('flags an edit that has not reached script-plan.md yet', () => {
    // The whole point of staging is that the file and the desk disagree for a
    // while. Nothing else on the page says so.
    renderView({
      onNotesSave: noop,
      noteEdits: { '2.1': { original: ['- old'], at: '2026-08-29T00:00:00.000Z' } },
    })
    expect(
      screen.getByText('edited, not yet applied'),
      'UNFLAGGED_STAGED_EDIT: a staged edit looks identical to the file',
    ).toBeTruthy()
  })

  it('offers an undo only once something is staged', () => {
    const { unmount } = renderView({ onNotesSave: noop, onNotesRestore: noop })
    expect(screen.queryByLabelText('Undo note edit')).toBeNull()
    unmount()

    renderView({
      onNotesSave: noop,
      onNotesRestore: noop,
      noteEdits: { '2.1': { original: ['- old'], at: 'x' } },
    })
    expect(screen.getByLabelText('Undo note edit')).toBeTruthy()
  })
})
