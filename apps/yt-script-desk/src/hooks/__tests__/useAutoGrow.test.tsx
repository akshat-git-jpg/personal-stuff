// Every edit box is exactly as tall as its text.
//
// Owner, 2026-08-29, opening the pencil on a five-paragraph conclusion:
// *"whenever I click on pencil button and edit it opens the small box and inside
// I have to go up and down to go to the text. Can we make the edit box dynamic
// to cover the entire text so that I can see the entire text in one go."*
//
// jsdom does not lay text out, so `scrollHeight` is always 0 and nothing here
// would be measurable. These tests stub it on the prototype — the number is
// fake, but WHICH number gets written to `style.height`, and whether the box is
// reset to `auto` before measuring, are exactly the two things that break.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SayCard } from '../../components/SayCard'
import { WriteBox } from '../../components/WriteBox'
import { WriteView } from '../../components/WriteView'
import { makeCardBeat } from '../../test/fixtures'
import type { Prefs } from '../usePrefs'

const PREFS: Prefs = { instructions: true, beatLabels: true, scriptNotes: false }
const FAKE_SCROLL_HEIGHT = 742

let original: PropertyDescriptor | undefined

beforeAll(() => {
  original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight')
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => FAKE_SCROLL_HEIGHT,
  })
})

afterAll(() => {
  if (original) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', original)
})

function noop() {}

describe('an edit box is as tall as its text', () => {
  it('sizes the spoken card to its whole copy the moment it opens', () => {
    render(<SayCard lines={['One.', '', 'Two.', '', 'Three.']} onSave={noop} />)

    fireEvent.click(screen.getByLabelText('Edit'))
    // The edit is gated behind a confirmation, which is a separate rule. The
    // accent button is Yes.
    fireEvent.click(document.querySelector('.btn-accent') as HTMLButtonElement)

    const area = document.querySelector('.say-textarea') as HTMLTextAreaElement
    expect(area, 'NO_EDITOR: the confirm did not open the box').not.toBeNull()
    expect(
      area.style.height,
      'FIXED_HEIGHT_BOX: the box opened at its CSS height and scrolls inside itself',
    ).toBe(`${FAKE_SCROLL_HEIGHT}px`)
  })

  it("sizes the maker's write box to what he has typed", () => {
    render(<WriteBox value={'a\nb\nc'} onSave={noop} />)
    const area = document.querySelector('.write-box-textarea') as HTMLTextAreaElement
    expect(area.style.height).toBe(`${FAKE_SCROLL_HEIGHT}px`)
  })

  it('sizes the notes editor when the pencil opens it', () => {
    render(
      <WriteView
        beats={[makeCardBeat()]}
        prefs={PREFS}
        draft={{}}
        edits={{}}
        says={{}}
        onDraftSave={noop}
        onSaySave={noop}
        onSayRestore={noop}
        onNotesSave={noop}
      />,
    )

    fireEvent.click(screen.getByLabelText('Edit notes'))
    const area = document.querySelector('.right-block-area') as HTMLTextAreaElement
    expect(area.style.height).toBe(`${FAKE_SCROLL_HEIGHT}px`)
  })

  it('resets to auto before measuring, so deleting text SHRINKS the box', () => {
    // Without the reset, `scrollHeight` reads back the box's own height and the
    // box can only ever grow: delete a paragraph and the empty space stays.
    const heights: string[] = []
    const spy = vi
      .spyOn(HTMLTextAreaElement.prototype, 'style', 'get')
      .mockImplementation(function (this: HTMLTextAreaElement) {
        return new Proxy(
          {},
          {
            set: (_t, prop, value) => {
              if (prop === 'height') heights.push(String(value))
              return true
            },
            get: () => '',
          },
        ) as CSSStyleDeclaration
      })

    render(<WriteBox value={'a'} onSave={noop} />)
    spy.mockRestore()

    expect(heights[0], 'NO_AUTO_RESET: the box was measured without being reset first').toBe('auto')
    expect(heights[1]).toBe(`${FAKE_SCROLL_HEIGHT}px`)
  })
})
