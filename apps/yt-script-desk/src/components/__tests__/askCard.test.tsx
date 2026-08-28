// An `**ASK**` lane renders as the owner's own open question, in the LEFT track,
// and can never be mistaken for script.
//
// Added 2026-08-28 in place of a whole browser markup UI. The owner edits the
// markdown in his own editor; the one thing the editor could not do was leave a
// question in place that the desk shows back. Owner: *"I have the entire thing as
// a text in my MD file, which I can easily cut paste everything. I can't do that
// easily on the UI."*
//
// The load-bearing property is SEPARATION: nothing purple is ever on paper, so a
// note to Claude is never read aloud. These tests exist because the obvious
// refactor — "it's a note, put it in the notes track with the others" — would put
// the owner's private question in front of the freelancer.
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { WriteView } from '../WriteView'
import { makeReadBeat } from '../../test/fixtures'
import type { Prefs } from '../../hooks/usePrefs'

const allOn: Prefs = {
  instructions: true,
  whatToCover: true,
  videoNotes: true,
  generalNotes: true,
  beatLabels: true,
  scriptNotes: false,
}
const notesOff: Prefs = { ...allOn, instructions: false }

function noop() {}

function renderWith(prefs: Prefs, ask: string[]) {
  return render(
    <WriteView
      beats={[makeReadBeat({ ask, say: ['A spoken line.'] })]}
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

describe('an open question for Claude', () => {
  it('renders, and says who it is addressed to', () => {
    renderWith(allOn, ['Cut this to two sentences.'])
    const card = document.querySelector('[data-testid="ask-card"]')
    expect(card, 'ASK_NOT_RENDERED: the owner wrote a question and the desk does not show it').not.toBeNull()
    expect(card?.textContent ?? '').toContain('Asked Claude')
    expect(card?.textContent ?? '').toContain('Cut this to two sentences.')
  })

  it('lives in the LEFT track, never in the instruction track', () => {
    renderWith(allOn, ['Cut this to two sentences.'])
    const left = document.querySelector('[data-testid="left-cell"]')
    expect(
      left?.querySelector('[data-testid="ask-card"]'),
      'ASK_IN_WRONG_TRACK: the question moved to the instruction track, which is the ' +
        'document the freelancer reads. It is addressed to Claude, not to him.',
    ).not.toBeNull()
  })

  it('is never inside the spoken card', () => {
    renderWith(allOn, ['Cut this to two sentences.'])
    const say = document.querySelector('.say')
    expect(
      say?.textContent ?? '',
      'ASK_ON_PAPER: the question rendered inside the spoken card, so it would be read aloud',
    ).not.toContain('Cut this to two sentences.')
  })

  it('still shows when the instruction track is switched off', () => {
    renderWith(notesOff, ['Cut this to two sentences.'])
    expect(
      document.querySelector('[data-testid="ask-card"]'),
      'ASK_HIDDEN_BY_TOGGLE: the owner turned off the notes track and lost his own ' +
        'open questions. They are not notes and not his freelancer\'s business.',
    ).not.toBeNull()
  })

  it('renders nothing at all when there is no question', () => {
    renderWith(allOn, [])
    expect(document.querySelector('[data-testid="ask-card"]')).toBeNull()
  })

  it('keeps each line of a multi-line question separate', () => {
    renderWith(allOn, ['Cut this to two sentences.', 'The After Effects line does the work.'])
    const lines = [...document.querySelectorAll('.ask-card-line')].map((n) => n.textContent)
    expect(lines).toEqual([
      'Cut this to two sentences.',
      'The After Effects line does the work.',
    ])
  })
})
