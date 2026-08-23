// "i need auto save better UI. currently its not intuitive whether whatever
// text i have typed got saved or not" — owner, 2026-08-23.
//
// Two things had to be true for the badge to actually answer that, and both are
// gated here:
//   1. typing marks the page unsaved IMMEDIATELY. The old box waited out its
//      600ms debounce before saying anything, so for that window the screen
//      claimed "Saved" while the text existed only in the browser.
//   2. the worst state wins. One beat failing to save must not be hidden by the
//      other fourteen being fine.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { WriteBox } from '../WriteBox'
import { Header } from '../Header'
import { SaveStatusProvider } from '../../hooks/useSaveStatus'

function noop() {}

function renderPage(boxes: Array<{ onSave: (t: string) => Promise<void> | void }>) {
  return render(
    <SaveStatusProvider>
      <Header title="A script" beatCount={3} writtenCount={0} totalWritable={3} tab="write" onTabChange={noop} />
      {boxes.map((b, i) => (
        <WriteBox key={i} value="" onSave={b.onSave} />
      ))}
    </SaveStatusProvider>,
  )
}

function type(index: number, value: string) {
  const areas = screen.getAllByPlaceholderText('Write what you saw…')
  fireEvent.change(areas[index], { target: { value } })
}

describe('the save badge at the top', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('starts at All saved when nothing has been typed', () => {
    renderPage([{ onSave: noop }])
    expect(screen.getByText('All saved')).toBeTruthy()
  })

  it('turns to Saving the instant a key is pressed, before the debounce fires', () => {
    renderPage([{ onSave: noop }])
    type(0, 'a first line')

    // No timers advanced: the debounce has NOT run and nothing has been sent.
    expect(
      screen.queryByText('All saved'),
      'SAVE_BADGE_LIES: the page claimed everything was saved while text was still only local',
    ).toBeNull()
    expect(screen.getByText('Saving')).toBeTruthy()
  })

  it('returns to All saved once the save resolves', async () => {
    const onSave = vi.fn(async () => {})
    renderPage([{ onSave }])
    type(0, 'a first line')

    await act(async () => {
      vi.advanceTimersByTime(700)
    })
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('All saved')).toBeTruthy())
  })

  it('shows Not saved when a save fails, and one failure outranks a healthy box', async () => {
    const ok = vi.fn(async () => {})
    const bad = vi.fn(async () => {
      throw new Error('offline')
    })
    renderPage([{ onSave: ok }, { onSave: bad }])

    type(0, 'this one is fine')
    type(1, 'this one will fail')

    await act(async () => {
      vi.advanceTimersByTime(700)
    })

    await waitFor(() =>
      expect(
        screen.getByText('Not saved'),
        'SAVE_BADGE_HIDES_FAILURE: a failed beat was masked by the beats that saved fine',
      ).toBeTruthy(),
    )
    expect(screen.queryByText('All saved')).toBeNull()
  })
})
